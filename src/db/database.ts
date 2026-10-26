import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../utils/id';
import { getAuthSync } from '../firebase';
import type {
  Company,
  Client,
  Product,
  Expense,
  Document,
  LineItem,
  RecurringDocument,
  DocumentType,
  DocumentStatus,
  DashboardStats,
} from '../types';

const KEYS = {
  companies: '@inv/companies',
  clients: '@inv/clients',
  products: '@inv/products',
  expenses: '@inv/expenses',
  documents: '@inv/documents',
  lineItems: '@inv/lineItems',
  recurring: '@inv/recurring',
  settings: '@inv/settings',
};

function scopedKey(key: string): string {
  const userId = getAuthSync().currentUser?.uid;
  return userId ? `${key}/${userId}` : key;
}

async function load<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(scopedKey(key));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function save<T>(key: string, data: T[]) {
  await AsyncStorage.setItem(scopedKey(key), JSON.stringify(data));
}

async function loadSettings(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(scopedKey(KEYS.settings));
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveSettings(s: Record<string, string>) {
  await AsyncStorage.setItem(scopedKey(KEYS.settings), JSON.stringify(s));
}

// No-op for compatibility with _layout.tsx
export async function getDb() {
  return null as any;
}

// ─── Settings ───────────────────────────────────────────────
export async function setSetting(key: string, value: string) {
  const s = await loadSettings();
  s[key] = value;
  await saveSettings(s);
}

export async function getSetting(key: string): Promise<string | null> {
  const s = await loadSettings();
  return s[key] ?? null;
}

// ─── Companies ──────────────────────────────────────────────
export async function createCompany(
  data: Omit<Company, 'id' | 'createdAt'>
): Promise<Company> {
  const list = await load<Company>(KEYS.companies);
  const company: Company = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  list.push(company);
  await save(KEYS.companies, list);
  return company;
}

export async function getCompanies(): Promise<Company[]> {
  const list = await load<Company>(KEYS.companies);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function replaceCompanies(companies: Company[]) {
  const list = [...companies].sort((a, b) => a.name.localeCompare(b.name));
  await save(KEYS.companies, list);
}

export async function getCompany(id: string): Promise<Company | null> {
  const list = await load<Company>(KEYS.companies);
  return list.find((c) => c.id === id) ?? null;
}

export async function updateCompany(id: string, data: Partial<Company>) {
  const list = await load<Company>(KEYS.companies);
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...data, id: list[i].id, createdAt: list[i].createdAt };
  await save(KEYS.companies, list);
}

export async function deleteCompany(id: string) {
  let list = await load<Company>(KEYS.companies);
  list = list.filter((c) => c.id !== id);
  await save(KEYS.companies, list);
}

// ─── Clients ────────────────────────────────────────────────
export async function createClient(
  data: Omit<Client, 'id' | 'createdAt'>
): Promise<Client> {
  const list = await load<Client>(KEYS.clients);
  const client: Client = {
    ...data,
    type: data.type ?? 'client',
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  list.push(client);
  await save(KEYS.clients, list);
  return client;
}

export async function getClients(companyId: string): Promise<Client[]> {
  const list = await load<Client>(KEYS.clients);
  return list
    .filter((c) => c.companyId === companyId && (c.type ?? 'client') === 'client')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSuppliers(companyId: string): Promise<Client[]> {
  const list = await load<Client>(KEYS.clients);
  return list
    .filter((c) => c.companyId === companyId && (c.type ?? 'client') === 'supplier')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClient(id: string): Promise<Client | null> {
  const list = await load<Client>(KEYS.clients);
  return list.find((c) => c.id === id) ?? null;
}

export async function updateClient(id: string, data: Partial<Client>) {
  const list = await load<Client>(KEYS.clients);
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...data, id: list[i].id, createdAt: list[i].createdAt, companyId: list[i].companyId };
  await save(KEYS.clients, list);
}

export async function deleteClient(id: string) {
  let list = await load<Client>(KEYS.clients);
  list = list.filter((c) => c.id !== id);
  await save(KEYS.clients, list);
}

// ─── Products ───────────────────────────────────────────────
export async function createProduct(
  data: Omit<Product, 'id' | 'createdAt'>
): Promise<Product> {
  const list = await load<Product>(KEYS.products);
  const product: Product = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  list.push(product);
  await save(KEYS.products, list);
  return product;
}

export async function getProducts(companyId: string): Promise<Product[]> {
  const list = await load<Product>(KEYS.products);
  return list
    .filter((p) => p.companyId === companyId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

const INVENTORY_DELTA_BY_TYPE: Record<DocumentType, number> = {
  invoice: -1,
  proforma: -1,
  credit_note: 1,
  debit_note: -1,
  rfq: 0,
  purchase_order: 1,
  quote: -1,
  inbound_document: 0,
};

export async function syncInventoryForDocument(document: {
  companyId: string;
  type: DocumentType;
  items: Array<{ name: string; qty: number }>;
}): Promise<string[]> {
  const delta = INVENTORY_DELTA_BY_TYPE[document.type] ?? 0;
  if (!document.items.length || delta === 0) return [];

  const products = await load<Product>(KEYS.products);
  const exhausted: string[] = [];

  for (const item of document.items) {
    const name = item.name?.trim();
    if (!name) continue;

    const product = products.find(
      (p) => p.companyId === document.companyId && p.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (!product) continue;

    const qty = Number(item.qty) || 1;
    product.stock = Math.max(0, (product.stock || 0) + qty * delta);

    if (product.stock <= 0) {
      exhausted.push(product.name);
    }
  }

  await save(KEYS.products, products);
  return exhausted;
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const list = await load<Product>(KEYS.products);
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...data, id: list[i].id, createdAt: list[i].createdAt, companyId: list[i].companyId };
  await save(KEYS.products, list);
}

export async function deleteProduct(id: string) {
  let list = await load<Product>(KEYS.products);
  list = list.filter((p) => p.id !== id);
  await save(KEYS.products, list);
}

// ─── Expenses ───────────────────────────────────────────────
export async function createExpense(
  data: Omit<Expense, 'id' | 'createdAt'>
): Promise<Expense> {
  const list = await load<Expense>(KEYS.expenses);
  const expense: Expense = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  list.push(expense);
  await save(KEYS.expenses, list);
  return expense;
}

export async function getExpenses(companyId: string): Promise<Expense[]> {
  const list = await load<Expense>(KEYS.expenses);
  return list
    .filter((e) => e.companyId === companyId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function deleteExpense(id: string) {
  let list = await load<Expense>(KEYS.expenses);
  list = list.filter((e) => e.id !== id);
  await save(KEYS.expenses, list);
}

// ─── Documents ──────────────────────────────────────────────
export async function getNextDocNumber(
  companyId: string,
  type: DocumentType
): Promise<string> {
  const prefixMap: Record<DocumentType, string> = {
    invoice: 'INV',
    proforma: 'PRO',
    credit_note: 'CN',
    debit_note: 'DN',
    rfq: 'RFQ',
    purchase_order: 'PO',
    quote: 'QT',
    inbound_document: 'IN',
  };
  const prefix = prefixMap[type] || 'DOC';
  const year = new Date().getFullYear();
  const list = await load<Document>(KEYS.documents);
  const count = list.filter((d) => d.companyId === companyId && d.type === type).length;
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function createDocument(
  data: Omit<Document, 'id' | 'createdAt' | 'number' | 'items'> & {
    items: Omit<LineItem, 'id' | 'documentId'>[];
  }
): Promise<Document> {
  const number = await getNextDocNumber(data.companyId, data.type);
  const id = generateId();
  const createdAt = new Date().toISOString();

  const docs = await load<Document>(KEYS.documents);
  const doc: Document = {
    id,
    number,
    createdAt,
    type: data.type,
    total: data.total,
    subtotal: data.subtotal,
    taxRate: data.taxRate,
    taxAmount: data.taxAmount,
    status: data.status,
    notes: data.notes ?? null,
    dueDate: data.dueDate ?? null,
    companyId: data.companyId,
    clientId: data.clientId,
    sourceName: data.sourceName ?? null,
    sourceType: data.sourceType ?? null,
  };
  docs.push(doc);
  await save(KEYS.documents, docs);

  const items = await load<LineItem>(KEYS.lineItems);
  for (const item of data.items) {
    items.push({
      id: generateId(),
      name: item.name,
      qty: item.qty,
      price: item.price,
      documentId: id,
    });
  }
  await save(KEYS.lineItems, items);

  const exhausted = await syncInventoryForDocument({
    companyId: doc.companyId,
    type: doc.type,
    items: data.items.map((item) => ({ name: item.name, qty: item.qty })),
  });

  if (exhausted.length) {
    console.warn(`Inventory exhausted for: ${exhausted.join(', ')}`);
  }

  return { ...doc, items: data.items as LineItem[] };
}

export async function getDocuments(companyId: string): Promise<Document[]> {
  const docs = await load<Document>(KEYS.documents);
  const clients = await load<Client>(KEYS.clients);
  return docs
    .filter((d) => d.companyId === companyId)
    .map((d) => ({
      ...d,
      clientName: clients.find((c) => c.id === d.clientId)?.name,
    }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getDocument(id: string): Promise<Document | null> {
  const docs = await load<Document>(KEYS.documents);
  const clients = await load<Client>(KEYS.clients);
  const items = await load<LineItem>(KEYS.lineItems);
  const doc = docs.find((d) => d.id === id);
  if (!doc) return null;
  return {
    ...doc,
    clientName: clients.find((c) => c.id === doc.clientId)?.name,
    items: items.filter((i) => i.documentId === id),
  };
}

export async function updateDocumentStatus(id: string, status: DocumentStatus) {
  const docs = await load<Document>(KEYS.documents);
  const i = docs.findIndex((d) => d.id === id);
  if (i < 0) return;
  docs[i] = { ...docs[i], status };
  await save(KEYS.documents, docs);
}

export async function updateDocument(id: string, data: Partial<Document>) {
  const docs = await load<Document>(KEYS.documents);
  const i = docs.findIndex((d) => d.id === id);
  if (i < 0) return;
  docs[i] = { ...docs[i], ...data, id: docs[i].id, createdAt: docs[i].createdAt };
  await save(KEYS.documents, docs);
}

export async function createLineItem(item: Omit<LineItem, 'id'>): Promise<LineItem> {
  const items = await load<LineItem>(KEYS.lineItems);
  const lineItem: LineItem = {
    ...item,
    id: generateId(),
  };
  items.push(lineItem);
  await save(KEYS.lineItems, items);
  return lineItem;
}

export async function deleteDocument(id: string) {
  let docs = await load<Document>(KEYS.documents);
  docs = docs.filter((d) => d.id !== id);
  await save(KEYS.documents, docs);
  let items = await load<LineItem>(KEYS.lineItems);
  items = items.filter((i) => i.documentId !== id);
  await save(KEYS.lineItems, items);
}

// ─── Recurring ──────────────────────────────────────────────
export async function createRecurring(
  data: Omit<RecurringDocument, 'id' | 'createdAt'>
): Promise<RecurringDocument> {
  const list = await load<RecurringDocument>(KEYS.recurring);
  const rec: RecurringDocument = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  list.push(rec);
  await save(KEYS.recurring, list);
  return rec;
}

export async function getRecurring(companyId: string): Promise<RecurringDocument[]> {
  const list = await load<RecurringDocument>(KEYS.recurring);
  const clients = await load<Client>(KEYS.clients);
  return list
    .filter((r) => r.companyId === companyId)
    .map((r) => ({
      ...r,
      clientName: clients.find((c) => c.id === r.clientId)?.name,
    }))
    .sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
}

export async function deleteRecurring(id: string) {
  let list = await load<RecurringDocument>(KEYS.recurring);
  list = list.filter((r) => r.id !== id);
  await save(KEYS.recurring, list);
}

// ─── Dashboard ──────────────────────────────────────────────
export async function getDashboardStats(companyId: string): Promise<DashboardStats> {
  const products = await getProducts(companyId);
  const expenses = await getExpenses(companyId);
  const documents = await getDocuments(companyId);

  const activeSkuCount = products.length;
  const totalValuation = products.reduce((s, p) => s + p.price * p.stock, 0);
  const outstandingBilling = documents
    .filter((d) => d.type === 'invoice' && ['sent', 'overdue', 'draft'].includes(d.status))
    .reduce((s, d) => s + d.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    activeSkuCount,
    totalValuation,
    outstandingBilling,
    totalExpenses,
    recentDocuments: documents.slice(0, 10),
  };
}

// Seed demo data on first launch
export async function seedIfEmpty() {
  const companies = await getCompanies();
  if (companies.length > 0) return;

  const company = await createCompany({
    name: 'Kerabeaute',
    tagline: 'Art of Flawless Haircare',
    brandColor: '#0F172A',
    email: 'hello@kerabeaute.com',
    phone: '+91 98765 43210',
  });

  await createClient({
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    phone: '+91 99887 76655',
    group: 'Retail',
    companyId: company.id,
  });
  await createClient({
    name: 'Priya Salon Chain',
    email: 'priya@salon.com',
    phone: '+91 88776 65544',
    group: 'Wholesale',
    companyId: company.id,
  });

  await createProduct({
    name: 'Hydrating Silk Cleanser',
    price: 1250,
    stock: 120,
    leadTime: '3-5 Days',
    sku: 'HSC-001',
    companyId: company.id,
  });
  await createProduct({
    name: 'Keratin Repair Mask',
    price: 1899,
    stock: 85,
    leadTime: '5-7 Days',
    sku: 'KRM-002',
    companyId: company.id,
  });
  await createProduct({
    name: 'Argan Oil Serum 50ml',
    price: 999,
    stock: 200,
    leadTime: '2-4 Days',
    sku: 'AOS-003',
    companyId: company.id,
  });

  await setSetting('activeCompanyId', company.id);
}