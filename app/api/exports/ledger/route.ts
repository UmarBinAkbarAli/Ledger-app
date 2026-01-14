import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { extractBearerToken } from "@/lib/adminAuth";
import { logger } from "@/lib/logger";
import { exportLedger } from "@/lib/csvUtils";
import { hasPermission, Permission, UserRole } from "@/lib/roles";
import { zipSync, strToU8 } from "fflate";

const sanitizeFileName = (name: string) => {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return safe.slice(0, 60) || "ledger";
};

const ensureUniqueFileName = (base: string, used: Set<string>) => {
  const dotIndex = base.lastIndexOf(".");
  const namePart = dotIndex > 0 ? base.slice(0, dotIndex) : base;
  const ext = dotIndex > 0 ? base.slice(dotIndex) : "";
  let candidate = base;
  let suffix = 1;
  while (used.has(candidate)) {
    candidate = `${namePart}_${suffix}${ext}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
};

async function resolveBusinessId(adminDb: ReturnType<typeof getAdminFirestore>, uid: string, tokenBusinessId?: string) {
  if (tokenBusinessId) return tokenBusinessId;
  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data() || {};
    if (userData.businessId) return userData.businessId as string;
  }
  return uid;
}

async function requireExportAccess(request: NextRequest) {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();
  const idToken = extractBearerToken(request);
  if (!idToken) {
    return {
      errorResponse: NextResponse.json(
        { success: false, message: "Missing or invalid authorization header", error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const role = (userData.role || decodedToken.role || null) as UserRole | null;

    if (!role || !Object.values(UserRole).includes(role)) {
      return {
        errorResponse: NextResponse.json(
          { success: false, message: "Missing or invalid role", error: "Forbidden" },
          { status: 403 }
        ),
      };
    }

    if (!hasPermission(role, Permission.EXPORT_DATA)) {
      return {
        errorResponse: NextResponse.json(
          { success: false, message: "Insufficient permissions", error: "Forbidden" },
          { status: 403 }
        ),
      };
    }

    const businessId = await resolveBusinessId(
      adminDb,
      decodedToken.uid,
      decodedToken.businessId as string | undefined
    );

    return { decodedToken, businessId };
  } catch (error) {
    logger.error("Token verification failed for ledger export", error);
    return {
      errorResponse: NextResponse.json(
        { success: false, message: "Invalid or expired token", error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const adminDb = getAdminFirestore();
    const access = await requireExportAccess(request);
    if ("errorResponse" in access && access.errorResponse) {
      return access.errorResponse;
    }

    const { businessId } = access as { businessId: string };
    const type = request.nextUrl.searchParams.get("type");

    if (!type || (type !== "customers" && type !== "suppliers")) {
      return NextResponse.json(
        { success: false, message: "Invalid ledger export type", error: "Bad Request" },
        { status: 400 }
      );
    }

    const usedNames = new Set<string>();
    const files: Record<string, Uint8Array> = {};

    if (type === "customers") {
      const [customersSnap, salesSnap, incomeSnap] = await Promise.all([
        adminDb.collection("customers").where("businessId", "==", businessId).get(),
        adminDb.collection("sales").where("businessId", "==", businessId).get(),
        adminDb.collection("income").where("businessId", "==", businessId).get(),
      ]);

      const customerNameById = new Map<string, string>();
      customersSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const name = (data.name || "").toString();
        customerNameById.set(docSnap.id, name);
      });

      const salesByCustomer = new Map<string, any[]>();
      salesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const id = (data.customerId || "").toString();
        if (!id) return;
        if (!customerNameById.has(id) && data.customerName) {
          customerNameById.set(id, data.customerName);
        }
        const list = salesByCustomer.get(id) || [];
        list.push(data);
        salesByCustomer.set(id, list);
      });

      const incomeByCustomer = new Map<string, any[]>();
      incomeSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const id = (data.customerId || "").toString();
        if (!id) return;
        if (!customerNameById.has(id) && data.customerName) {
          customerNameById.set(id, data.customerName);
        }
        const list = incomeByCustomer.get(id) || [];
        list.push(data);
        incomeByCustomer.set(id, list);
      });

      const allCustomerIds = new Set<string>([
        ...salesByCustomer.keys(),
        ...incomeByCustomer.keys(),
      ]);

      allCustomerIds.forEach((customerId) => {
        const ledgerRows: any[] = [];
        const customerSales = salesByCustomer.get(customerId) || [];
        const customerIncome = incomeByCustomer.get(customerId) || [];

        customerSales.forEach((data) => {
          ledgerRows.push({
            date: data.date || "",
            type: "Sale",
            particular: data.billNumber || "",
            folio: "",
            debit: String(data.total || 0),
            credit: "0",
            balance: "",
          });
        });

        customerIncome.forEach((data) => {
          ledgerRows.push({
            date: data.date || "",
            type: "Payment",
            particular: data.billNumber || "Payment",
            folio: "",
            debit: "0",
            credit: String(data.amount || 0),
            balance: "",
          });
        });

        if (ledgerRows.length === 0) return;

        ledgerRows.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const customerName = customerNameById.get(customerId) || "Customer";
        const csv = exportLedger(ledgerRows, customerName);
        const base = `customer_ledger_${sanitizeFileName(customerName || customerId)}.csv`;
        const filename = ensureUniqueFileName(base, usedNames);
        files[filename] = strToU8(csv);
      });
    }

    if (type === "suppliers") {
      const [suppliersSnap, purchasesSnap, expensesSnap] = await Promise.all([
        adminDb.collection("suppliers").where("businessId", "==", businessId).get(),
        adminDb.collection("purchases").where("businessId", "==", businessId).get(),
        adminDb.collection("expenses").where("businessId", "==", businessId).get(),
      ]);

      const supplierNameById = new Map<string, string>();
      suppliersSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const name = (data.name || "").toString();
        supplierNameById.set(docSnap.id, name);
      });

      const purchasesBySupplier = new Map<string, any[]>();
      purchasesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const id = (data.supplierId || "").toString();
        if (!id) return;
        if (!supplierNameById.has(id) && data.supplierName) {
          supplierNameById.set(id, data.supplierName);
        }
        const list = purchasesBySupplier.get(id) || [];
        list.push(data);
        purchasesBySupplier.set(id, list);
      });

      const expensesBySupplier = new Map<string, any[]>();
      expensesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const id = (data.supplierId || "").toString();
        if (!id) return;
        if (!supplierNameById.has(id) && data.supplierName) {
          supplierNameById.set(id, data.supplierName);
        }
        const list = expensesBySupplier.get(id) || [];
        list.push(data);
        expensesBySupplier.set(id, list);
      });

      const allSupplierIds = new Set<string>([
        ...purchasesBySupplier.keys(),
        ...expensesBySupplier.keys(),
      ]);

      allSupplierIds.forEach((supplierId) => {
        const ledgerRows: any[] = [];
        const supplierPurchases = purchasesBySupplier.get(supplierId) || [];
        const supplierExpenses = expensesBySupplier.get(supplierId) || [];

        supplierPurchases.forEach((data) => {
          ledgerRows.push({
            date: data.date || "",
            type: "Purchase",
            particular: data.billNumber || "",
            folio: "",
            debit: "0",
            credit: String(data.total || 0),
            balance: "",
          });
        });

        supplierExpenses.forEach((data) => {
          ledgerRows.push({
            date: data.date || "",
            type: "Payment",
            particular: data.billNumber || "Payment",
            folio: "",
            debit: String(data.amount || 0),
            credit: "0",
            balance: "",
          });
        });

        if (ledgerRows.length === 0) return;

        ledgerRows.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const supplierName = supplierNameById.get(supplierId) || "Supplier";
        const csv = exportLedger(ledgerRows, supplierName);
        const base = `supplier_ledger_${sanitizeFileName(supplierName || supplierId)}.csv`;
        const filename = ensureUniqueFileName(base, usedNames);
        files[filename] = strToU8(csv);
      });
    }

    if (Object.keys(files).length === 0) {
      return NextResponse.json(
        { success: false, message: "No ledger data found", error: "Not Found" },
        { status: 404 }
      );
    }

    const zipData = zipSync(files);
    const fileName = `${type}_ledgers_${new Date().toISOString().split("T")[0]}.zip`;

    const zipBuffer = Buffer.from(zipData);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    logger.error("Error exporting ledgers", error);
    return NextResponse.json(
      { success: false, message: "Failed to export ledgers", error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
