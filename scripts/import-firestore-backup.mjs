import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_VALUES = new Set(["admin", "accountant", "sales_user", "viewer"]);
const STATUS_VALUES = new Set(["active", "inactive", "pending", "deactivated"]);
const BUSINESS_STATUS_VALUES = new Set(["active", "suspended", "deleted"]);
const AUDIT_ACTIONS = new Set([
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "ROLE_CHANGED",
  "PASSWORD_RESET",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
]);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toDate(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") return new Date(value);
  if (typeof value === "object" && value._seconds != null) {
    const ms = value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1e6);
    return new Date(ms);
  }
  return undefined;
}

function toDecimal(value) {
  if (value === null || value === undefined || value === "") return undefined;
  return new Prisma.Decimal(value);
}

function normalizeRole(value) {
  return ROLE_VALUES.has(value) ? value : "viewer";
}

function normalizeStatus(value) {
  return STATUS_VALUES.has(value) ? value : "active";
}

function normalizeBusinessStatus(value) {
  return BUSINESS_STATUS_VALUES.has(value) ? value : "active";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { backupPath: null };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!opts.backupPath) {
      opts.backupPath = arg;
    }
  }

  if (!opts.backupPath) {
    throw new Error("Provide backup path: node scripts/import-firestore-backup.mjs <backup.json>");
  }

  return opts;
}

async function main() {
  const { backupPath } = parseArgs();
  const resolvedPath = path.resolve(process.cwd(), backupPath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const backup = JSON.parse(raw);
  const collections = backup.collections || {};

  const businesses = toArray(collections.businesses);
  const users = toArray(collections.users);
  const customers = toArray(collections.customers);
  const suppliers = toArray(collections.suppliers);
  const sales = toArray(collections.sales);
  const purchases = toArray(collections.purchases);
  const income = toArray(collections.income);
  const expenses = toArray(collections.expenses);
  const operationalExpenses = toArray(collections.operationalExpenses);
  const transfers = toArray(collections.transfers);
  const expenseCategories = toArray(collections.expenseCategories);
  const pettyCashOpening = toArray(collections.pettyCashOpening);
  const deliveryChallans = toArray(collections.deliveryChallans);
  const auditLogs = toArray(collections.auditLogs);

  if (!businesses.length) {
    throw new Error("No businesses found in backup.");
  }

  console.log("Importing businesses...");
  await prisma.business.createMany({
    data: businesses.map((b) => ({
      id: b.id,
      name: b.name || "Unnamed Business",
      tradeName: b.tradeName || null,
      email: b.email || "unknown@example.com",
      phone: b.phone || null,
      address: b.address || null,
      city: b.city || null,
      country: b.country || null,
      logoUrl: b.logoUrl || null,
      tagline: b.tagline || null,
      ownerId: b.ownerId || "",
      status: normalizeBusinessStatus(b.status),
      settings: b.settings || null,
      metadata: b.metadata || null,
      createdAt: toDate(b.createdAt) || new Date(),
      updatedAt: toDate(b.updatedAt) || null,
    })),
    skipDuplicates: true,
  });

  console.log("Importing users (skipping rows without businessId)...");
  await prisma.user.createMany({
    data: users
      .filter((u) => u.businessId)
      .map((u) => ({
      id: u.id || u.uid,
      uid: u.uid || null,
      email: u.email || "unknown@example.com",
      displayName: u.displayName || u.ownerName || u.email || "User",
      photoUrl: u.photoUrl || null,
      role: normalizeRole(u.role),
      status: normalizeStatus(u.status),
      businessId: u.businessId,
      isOwner: u.isOwner ?? null,
      companyId: u.companyId || null,
      ownerName: u.ownerName || null,
      companyName: u.companyName || null,
      website: u.website || null,
      address: u.address || null,
      phone: u.phone || null,
      logoPath: u.logoPath || null,
      logoUrl: u.logoUrl || null,
      tagline: u.tagline || null,
      type: u.type || null,
      deviceId: u.deviceId || null,
      version: u.version || null,
      isDeleted: u.isDeleted ?? null,
      lastMutationId: u.lastMutationId || null,
      createdAt: toDate(u.createdAt) || new Date(),
      updatedAt: toDate(u.updatedAt) || null,
      createdBy: u.createdBy || null,
      updatedBy: u.updatedBy || null,
      lastLogin: toDate(u.lastLogin) || null,
      metadata: u.metadata || null,
    })),
    skipDuplicates: true,
  });

  console.log("Importing customers (skipping rows without businessId)...");
  await prisma.customer.createMany({
    data: customers
      .filter((c) => c.businessId)
      .map((c) => ({
      id: c.id,
      name: c.name || "Unknown",
      company: c.company || null,
      address: c.address || null,
      phone: c.phone || null,
      chNo: c.chNo || null,
      userId: c.userId || "",
      businessId: c.businessId,
      createdAt: toDate(c.createdAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log("Importing suppliers (skipping rows without businessId)...");
  await prisma.supplier.createMany({
    data: suppliers
      .filter((s) => s.businessId)
      .map((s) => ({
      id: s.id,
      name: s.name || "Unknown",
      company: s.company || null,
      address: s.address || null,
      phone: s.phone || null,
      previousBalance: toDecimal(s.previousBalance),
      userId: s.userId || "",
      businessId: s.businessId,
      createdAt: toDate(s.createdAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log("Importing expense categories (skipping rows without businessId)...");
  await prisma.expenseCategory.createMany({
    data: expenseCategories
      .filter((c) => c.businessId)
      .map((c) => ({
      id: c.id,
      name: c.name || "Uncategorized",
      userId: c.userId || "",
      businessId: c.businessId,
      createdAt: toDate(c.createdAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log("Importing sales (skipping rows without businessId)...");
  await prisma.sale.createMany({
    data: sales
      .filter((s) => s.businessId)
      .map((s) => ({
      id: s.id,
      customerId: s.customerId || "",
      customerName: s.customerName || null,
      customerCompany: s.customerCompany || null,
      customerAddress: s.customerAddress || null,
      customerPhone: s.customerPhone || null,
      customerChNo: s.customerChNo || null,
      billNumber: s.billNumber || "",
      date: s.date || "",
      poNumber: s.poNumber || null,
      terms: s.terms || null,
      items: s.items || [],
      subtotal: toDecimal(s.subtotal) || new Prisma.Decimal(0),
      total: toDecimal(s.total) || new Prisma.Decimal(0),
      paidAmount: toDecimal(s.paidAmount) || new Prisma.Decimal(0),
      userId: s.userId || "",
      businessId: s.businessId,
      challanIds: s.challanIds || null,
      challanNumbers: s.challanNumbers || null,
      createdAt: toDate(s.createdAt) || new Date(),
      updatedAt: toDate(s.updatedAt) || null,
    })),
    skipDuplicates: true,
  });

  console.log("Importing purchases (skipping rows without businessId)...");
  await prisma.purchase.createMany({
    data: purchases
      .filter((p) => p.businessId)
      .map((p) => ({
      id: p.id,
      supplierId: p.supplierId || "",
      supplierName: p.supplierName || null,
      supplierCompany: p.supplierCompany || null,
      supplierAddress: p.supplierAddress || null,
      supplierPhone: p.supplierPhone || null,
      billNumber: p.billNumber || "",
      date: p.date || "",
      poNumber: p.poNumber || null,
      terms: p.terms || null,
      items: p.items || [],
      subtotal: toDecimal(p.subtotal) || new Prisma.Decimal(0),
      total: toDecimal(p.total) || new Prisma.Decimal(0),
      paidAmount: toDecimal(p.paidAmount) || new Prisma.Decimal(0),
      userId: p.userId || "",
      businessId: p.businessId,
      createdAt: toDate(p.createdAt) || new Date(),
      updatedAt: toDate(p.updatedAt) || null,
    })),
    skipDuplicates: true,
  });

  console.log("Importing income (skipping rows without businessId)...");
  await prisma.income.createMany({
    data: income
      .filter((i) => i.businessId)
      .map((i) => ({
      id: i.id,
      saleId: i.saleId || null,
      customerId: i.customerId || null,
      customerName: i.customerName || null,
      billNumber: i.billNumber || null,
      amount: toDecimal(i.amount) || new Prisma.Decimal(0),
      date: i.date || "",
      paymentMethod: i.paymentMethod || "CASH",
      bankName: i.bankName || null,
      notes: i.notes || null,
      userId: i.userId || "",
      businessId: i.businessId,
      createdAt: toDate(i.createdAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log("Importing expenses (skipping rows without businessId)...");
  await prisma.expense.createMany({
    data: expenses
      .filter((e) => e.businessId)
      .map((e) => ({
      id: e.id,
      supplierId: e.supplierId || null,
      supplierName: e.supplierName || null,
      amount: toDecimal(e.amount) || new Prisma.Decimal(0),
      date: e.date || "",
      paymentMethod: e.paymentMethod || "CASH",
      bankName: e.bankName || null,
      notes: e.notes || null,
      userId: e.userId || "",
      businessId: e.businessId,
      createdAt: toDate(e.createdAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log("Importing operational expenses (skipping rows without businessId)...");
  await prisma.operationalExpense.createMany({
    data: operationalExpenses
      .filter((o) => o.businessId)
      .map((o) => ({
      id: o.id,
      categoryId: o.categoryId || null,
      categoryName: o.categoryName || null,
      description: o.description || null,
      amount: toDecimal(o.amount) || new Prisma.Decimal(0),
      date: o.date || "",
      paymentMethod: o.paymentMethod || "CASH",
      bankName: o.bankName || null,
      userId: o.userId || "",
      businessId: o.businessId,
      createdAt: toDate(o.createdAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log("Importing transfers (skipping rows without businessId)...");
  await prisma.transfer.createMany({
    data: transfers
      .filter((t) => t.businessId)
      .map((t) => ({
      id: t.id,
      amount: toDecimal(t.amount) || new Prisma.Decimal(0),
      date: t.date || "",
      fromAccount: t.fromAccount || "",
      toAccount: t.toAccount || "",
      description: t.description || null,
      userId: t.userId || "",
      businessId: t.businessId,
      createdAt: toDate(t.createdAt) || new Date(),
    })),
    skipDuplicates: true,
  });

  console.log("Importing petty cash opening (skipping rows without businessId)...");
  await prisma.pettyCashOpening.createMany({
    data: pettyCashOpening
      .filter((p) => p.businessId)
      .map((p) => ({
      id: p.id,
      openingBalance: toDecimal(p.openingBalance) || new Prisma.Decimal(0),
      openingDate: p.openingDate || "",
      userId: p.userId || "",
      businessId: p.businessId,
      createdAt: toDate(p.createdAt) || new Date(),
      updatedAt: toDate(p.updatedAt) || null,
    })),
    skipDuplicates: true,
  });

  console.log("Importing delivery challans (skipping rows without businessId)...");
  await prisma.deliveryChallan.createMany({
    data: deliveryChallans
      .filter((d) => d.businessId)
      .map((d) => ({
      id: d.id,
      challanNumber: d.challanNumber || "",
      date: d.date || "",
      vehicle: d.vehicle || "",
      poNumber: d.poNumber || null,
      customerId: d.customerId || "",
      customerName: d.customerName || null,
      customerCompany: d.customerCompany || null,
      customerAddress: d.customerAddress || null,
      customerNote: d.customerNote || null,
      receiverName: d.receiverName || null,
      items: d.items || [],
      totalQuantity: toDecimal(d.totalQuantity) || new Prisma.Decimal(0),
      invoiceNumber: d.invoiceNumber || null,
      invoiceId: d.invoiceId || null,
      status: d.status || "pending",
      userId: d.userId || "",
      businessId: d.businessId,
      createdAt: toDate(d.createdAt) || new Date(),
      updatedAt: toDate(d.updatedAt) || null,
    })),
    skipDuplicates: true,
  });

  if (auditLogs.length) {
    console.log("Importing audit logs...");
    await prisma.auditLog.createMany({
      data: auditLogs
        .filter((a) => AUDIT_ACTIONS.has(a.action))
        .map((a) => ({
          action: a.action,
          actorUid: a.actorUid || "",
          actorEmail: a.actorEmail || null,
          targetUid: a.targetUid || null,
          targetEmail: a.targetEmail || null,
          details: a.details || null,
          ipAddress: a.ipAddress || null,
          userAgent: a.userAgent || null,
          timestamp: toDate(a.timestamp) || new Date(),
          success: Boolean(a.success),
          errorMessage: a.errorMessage || null,
        })),
      skipDuplicates: true,
    });
  }

  console.log("Import complete.");
}

main()
  .catch((err) => {
    console.error("Import failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
