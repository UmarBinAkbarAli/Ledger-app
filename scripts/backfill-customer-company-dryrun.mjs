import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { FieldPath } from "firebase-admin/firestore";

const serviceKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "service-key.json");
if (!fs.existsSync(serviceKeyPath)) {
  console.error("Service key not found. Set GOOGLE_APPLICATION_CREDENTIALS or place service-key.json in project root.");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceKeyPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function loadCustomers() {
  const customers = new Map();
  let lastDoc = null;
  const pageSize = 500;

  while (true) {
    let q = db.collection("customers").orderBy(FieldPath.documentId()).limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    snap.docs.forEach((doc) => {
      const data = doc.data() || {};
      const company = (data.company || "").toString().trim();
      customers.set(doc.id, company);
    });

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return customers;
}

async function scanCollection(name, customers) {
  let lastDoc = null;
  const pageSize = 500;

  let total = 0;
  let missingCompany = 0;
  let missingCustomerId = 0;
  let missingCustomerDoc = 0;
  let customerCompanyEmpty = 0;
  let wouldUpdate = 0;

  while (true) {
    let q = db.collection(name).orderBy(FieldPath.documentId()).limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      total += 1;
      const data = doc.data() || {};
      const currentCompany = (data.customerCompany || "").toString().trim();
      if (currentCompany) {
        continue;
      }

      missingCompany += 1;
      const customerId = (data.customerId || "").toString().trim();
      if (!customerId) {
        missingCustomerId += 1;
        continue;
      }

      if (!customers.has(customerId)) {
        missingCustomerDoc += 1;
        continue;
      }

      const customerCompany = (customers.get(customerId) || "").toString().trim();
      if (!customerCompany) {
        customerCompanyEmpty += 1;
        continue;
      }

      wouldUpdate += 1;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return {
    total,
    missingCompany,
    missingCustomerId,
    missingCustomerDoc,
    customerCompanyEmpty,
    wouldUpdate,
  };
}

async function main() {
  console.log("Dry run: backfill customerCompany for sales and income (no writes).\n");

  const customers = await loadCustomers();
  console.log(`Customers loaded: ${customers.size}`);

  const sales = await scanCollection("sales", customers);
  const income = await scanCollection("income", customers);

  console.log("\nSales:");
  console.log(sales);
  console.log("\nIncome:");
  console.log(income);
}

main().catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});
