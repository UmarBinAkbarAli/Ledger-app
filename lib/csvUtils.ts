/**
 * CSV Utility Functions
 * Handle CSV export and import for bulk operations
 */

// ============================================
// EXPORT: Convert data to CSV
// ============================================

export function generateCSV<T extends Record<string, any>>(
  data: T[],
  headers: (keyof T)[]
): string {
  if (data.length === 0) {
    return headers.map(h => String(h)).join(',');
  }

  // Create header row
  const headerRow = headers.map(h => escapeCSVValue(String(h))).join(',');

  // Create data rows
  const dataRows = data.map(row =>
    headers
      .map(header => escapeCSVValue(String(row[header] ?? '')))
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

function escapeCSVValue(value: string): string {
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================
// IMPORT: Parse CSV to data
// ============================================

export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = parseCSVLine(lines[0]);
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // Skip empty lines

    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });

    data.push(row);
  }

  return data;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// ============================================
// DOWNLOAD: Trigger browser download
// ============================================

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadZip(zipData: Uint8Array, filename: string): void {
  const normalized = new Uint8Array(zipData);
  const blob = new Blob([normalized.buffer], { type: 'application/zip' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// CUSTOMER-SPECIFIC HELPERS
// ============================================

export interface CustomerData {
  name: string;
  company?: string;
  phone?: string;
  address?: string;
  previousBalance?: number;
}

export function exportCustomers(customers: any[]): string {
  const data = customers.map(c => ({
    name: c.name || '',
    company: c.company || '',
    phone: c.phone || '',
    address: c.address || '',
    previousBalance: String(c.previousBalance || '0'),
  }));

  return generateCSV(data, ['name', 'company', 'phone', 'address', 'previousBalance']);
}

export function validateCustomerData(rows: Record<string, string>[]): {
  valid: CustomerData[];
  errors: Array<{ row: number; error: string }>;
} {
  const valid: CustomerData[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2 because 1-indexed and header row
    const errors_for_row: string[] = [];

    // Validate required fields
    if (!row.name || row.name.trim() === '') {
      errors_for_row.push('Name is required');
    }

    // Validate previousBalance is a number
    if (row.previousBalance && isNaN(Number(row.previousBalance))) {
      errors_for_row.push('Previous Balance must be a number');
    }

    if (errors_for_row.length > 0) {
      errors.push({ row: rowNum, error: errors_for_row.join('; ') });
    } else {
      valid.push({
        name: row.name.trim(),
        company: row.company?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        address: row.address?.trim() || undefined,
        previousBalance: row.previousBalance ? parseFloat(row.previousBalance) : undefined,
      });
    }
  });

  return { valid, errors };
}

// ============================================
// SUPPLIER-SPECIFIC HELPERS
// ============================================

export interface SupplierData {
  name: string;
  company?: string;
  phone?: string;
  address?: string;
}

export function exportSuppliers(suppliers: any[]): string {
  const data = suppliers.map(s => ({
    name: s.name || '',
    company: s.company || '',
    phone: s.phone || '',
    address: s.address || '',
  }));

  return generateCSV(data, ['name', 'company', 'phone', 'address']);
}

export function validateSupplierData(rows: Record<string, string>[]): {
  valid: SupplierData[];
  errors: Array<{ row: number; error: string }>;
} {
  const valid: SupplierData[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errors_for_row: string[] = [];

    if (!row.name || row.name.trim() === '') {
      errors_for_row.push('Name is required');
    }

    if (errors_for_row.length > 0) {
      errors.push({ row: rowNum, error: errors_for_row.join('; ') });
    } else {
      valid.push({
        name: row.name.trim(),
        company: row.company?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        address: row.address?.trim() || undefined,
      });
    }
  });

  return { valid, errors };
}

// ============================================
// SALES-SPECIFIC HELPERS
// ============================================

export interface SalesData {
  customerId: string;
  customerName: string;
  billNumber: string;
  date: string;
  terms?: string;
  total: string;
}

export function exportSales(sales: any[]): string {
  const data = sales.map(s => ({
    customerId: s.customerId || '',
    customerName: s.customerName || '',
    billNumber: s.billNumber || '',
    date: s.date || '',
    terms: s.terms || 'CASH',
    total: String(s.total || 0),
  }));

  return generateCSV(data, ['customerId', 'customerName', 'billNumber', 'date', 'terms', 'total']);
}

export function validateSalesData(rows: Record<string, string>[]): {
  valid: SalesData[];
  errors: Array<{ row: number; error: string }>;
} {
  const valid: SalesData[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errors_for_row: string[] = [];

    if (!row.customerName || row.customerName.trim() === '') {
      errors_for_row.push('Customer Name is required');
    }
    if (!row.billNumber || row.billNumber.trim() === '') {
      errors_for_row.push('Bill Number is required');
    }
    if (!row.date || row.date.trim() === '') {
      errors_for_row.push('Date is required');
    }
    if (row.total && isNaN(Number(row.total))) {
      errors_for_row.push('Total must be a number');
    }

    if (errors_for_row.length > 0) {
      errors.push({ row: rowNum, error: errors_for_row.join('; ') });
    } else {
      valid.push({
        customerId: row.customerId?.trim() || '',
        customerName: row.customerName.trim(),
        billNumber: row.billNumber.trim(),
        date: row.date.trim(),
        terms: row.terms?.trim() || 'CASH',
        total: row.total?.trim() || '0',
      });
    }
  });

  return { valid, errors };
}

// ============================================
// PURCHASE-SPECIFIC HELPERS
// ============================================

export interface PurchaseData {
  supplierId: string;
  supplierName: string;
  billNumber: string;
  date: string;
  terms?: string;
  total: string;
}

export function exportPurchases(purchases: any[]): string {
  const data = purchases.map(p => ({
    supplierId: p.supplierId || '',
    supplierName: p.supplierName || '',
    billNumber: p.billNumber || '',
    date: p.date || '',
    terms: p.terms || 'CASH',
    total: String(p.total || 0),
  }));

  return generateCSV(data, ['supplierId', 'supplierName', 'billNumber', 'date', 'terms', 'total']);
}

export function validatePurchaseData(rows: Record<string, string>[]): {
  valid: PurchaseData[];
  errors: Array<{ row: number; error: string }>;
} {
  const valid: PurchaseData[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errors_for_row: string[] = [];

    if (!row.supplierName || row.supplierName.trim() === '') {
      errors_for_row.push('Supplier Name is required');
    }
    if (!row.billNumber || row.billNumber.trim() === '') {
      errors_for_row.push('Bill Number is required');
    }
    if (!row.date || row.date.trim() === '') {
      errors_for_row.push('Date is required');
    }
    if (row.total && isNaN(Number(row.total))) {
      errors_for_row.push('Total must be a number');
    }

    if (errors_for_row.length > 0) {
      errors.push({ row: rowNum, error: errors_for_row.join('; ') });
    } else {
      valid.push({
        supplierId: row.supplierId?.trim() || '',
        supplierName: row.supplierName.trim(),
        billNumber: row.billNumber.trim(),
        date: row.date.trim(),
        terms: row.terms?.trim() || 'CASH',
        total: row.total?.trim() || '0',
      });
    }
  });

  return { valid, errors };
}

// ============================================
// INCOME-SPECIFIC HELPERS
// ============================================

export interface IncomeData {
  customerId: string;
  customerName: string;
  billNumber?: string;
  date: string;
  amount: string;
  paymentMethod?: string;
  bankName?: string;
  notes?: string;
}

export function exportIncome(income: any[]): string {
  const data = income.map(i => ({
    customerId: i.customerId || '',
    customerName: i.customerName || '',
    billNumber: i.billNumber || '',
    date: i.date || '',
    amount: String(i.amount || 0),
    paymentMethod: i.paymentMethod || 'CASH',
    bankName: i.bankName || '',
    notes: i.notes || '',
  }));

  return generateCSV(data, [
    'customerId',
    'customerName',
    'billNumber',
    'date',
    'amount',
    'paymentMethod',
    'bankName',
    'notes',
  ]);
}

export function validateIncomeData(rows: Record<string, string>[]): {
  valid: IncomeData[];
  errors: Array<{ row: number; error: string }>;
} {
  const valid: IncomeData[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errors_for_row: string[] = [];

    if ((!row.customerId || row.customerId.trim() === '') &&
        (!row.customerName || row.customerName.trim() === '')) {
      errors_for_row.push('Customer ID or Customer Name is required');
    }
    if (!row.date || row.date.trim() === '') {
      errors_for_row.push('Date is required');
    }
    if (!row.amount || isNaN(Number(row.amount))) {
      errors_for_row.push('Amount must be a number');
    }

    if (errors_for_row.length > 0) {
      errors.push({ row: rowNum, error: errors_for_row.join('; ') });
    } else {
      valid.push({
        customerId: row.customerId?.trim() || '',
        customerName: row.customerName?.trim() || '',
        billNumber: row.billNumber?.trim() || '',
        date: row.date.trim(),
        amount: row.amount.trim(),
        paymentMethod: row.paymentMethod?.trim() || 'CASH',
        bankName: row.bankName?.trim() || '',
        notes: row.notes?.trim() || '',
      });
    }
  });

  return { valid, errors };
}

// ============================================
// EXPENSE-SPECIFIC HELPERS
// ============================================

export interface ExpenseData {
  supplierId: string;
  supplierName: string;
  date: string;
  amount: string;
  paymentMethod?: string;
  bankName?: string;
  notes?: string;
}

export function exportExpenses(expenses: any[]): string {
  const data = expenses.map(e => ({
    supplierId: e.supplierId || '',
    supplierName: e.supplierName || '',
    date: e.date || '',
    amount: String(e.amount || 0),
    paymentMethod: e.paymentMethod || 'CASH',
    bankName: e.bankName || '',
    notes: e.notes || '',
  }));

  return generateCSV(data, [
    'supplierId',
    'supplierName',
    'date',
    'amount',
    'paymentMethod',
    'bankName',
    'notes',
  ]);
}

export function validateExpenseData(rows: Record<string, string>[]): {
  valid: ExpenseData[];
  errors: Array<{ row: number; error: string }>;
} {
  const valid: ExpenseData[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errors_for_row: string[] = [];

    if ((!row.supplierId || row.supplierId.trim() === '') &&
        (!row.supplierName || row.supplierName.trim() === '')) {
      errors_for_row.push('Supplier ID or Supplier Name is required');
    }
    if (!row.date || row.date.trim() === '') {
      errors_for_row.push('Date is required');
    }
    if (!row.amount || isNaN(Number(row.amount))) {
      errors_for_row.push('Amount must be a number');
    }

    if (errors_for_row.length > 0) {
      errors.push({ row: rowNum, error: errors_for_row.join('; ') });
    } else {
      valid.push({
        supplierId: row.supplierId?.trim() || '',
        supplierName: row.supplierName?.trim() || '',
        date: row.date.trim(),
        amount: row.amount.trim(),
        paymentMethod: row.paymentMethod?.trim() || 'CASH',
        bankName: row.bankName?.trim() || '',
        notes: row.notes?.trim() || '',
      });
    }
  });

  return { valid, errors };
}

// ============================================
// SAMPLE TEMPLATES
// ============================================

export function getCustomerTemplate(): string {
  return "name,company,phone,address,previousBalance\nSample Customer,ABC Corp,03001234567,Karachi,0";
}

export function getSupplierTemplate(): string {
  return "name,company,phone,address\nSample Supplier,XYZ Corp,03001234567,Lahore";
}

export function getSalesTemplate(): string {
  return "customerId,customerName,billNumber,date,terms,total\n,Sample Customer,INV-001,2026-01-11,CASH,5000";
}

export function getPurchaseTemplate(): string {
  return "supplierId,supplierName,billNumber,date,terms,total\n,Sample Supplier,PUR-001,2026-01-11,CASH,3000";
}

export function getIncomeTemplate(): string {
  return "customerId,customerName,billNumber,date,amount,paymentMethod,bankName,notes\n,Sample Customer,RCV-001,2026-01-11,5000,CASH,,Payment received";
}

export function getExpenseTemplate(): string {
  return "supplierId,supplierName,date,amount,paymentMethod,bankName,notes\n,Sample Supplier,2026-01-11,2500,CASH,,Payment made";
}

// ============================================
// LEDGER EXPORT
// ============================================

export interface LedgerRow {
  date: string;
  type: string;
  particular: string;
  folio: string;
  debit: string;
  credit: string;
  balance: string;
}

export function exportLedger(ledgerData: LedgerRow[], entityName: string): string {
  return generateCSV(ledgerData, ['date', 'type', 'particular', 'folio', 'debit', 'credit', 'balance']);
}
