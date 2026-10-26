import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getAuthSync as getAuthInstance, getDb as getDbInstance } from '../firebase';
import type {
  Client,
  Product,
  Expense,
  Document,
  RecurringDocument,
  DashboardStats,
  DocumentStatus,
  DocumentType,
  Company,
} from '../types';

function uid() {
  const auth = getAuthInstance();
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  return u.uid;
}

function col(name: string) {
  const db = getDbInstance();
  return collection(db, 'users', uid(), name);
}

export async function setSetting(key: string, value: string) {
  await setDoc(doc(getDbInstance(), 'users', uid(), 'settings', key), { value });
}

export async function getSetting(key: string): Promise<string | null> {
  const snap = await getDoc(doc(getDbInstance(), 'users', uid(), 'settings', key));
  return snap.exists() ? ((snap.data().value as string) ?? null) : null;
}

export async function getCompanies(): Promise<Company[]> {
  const snap = await getDocs(col('companies'));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as Company))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompany(id: string): Promise<Company | null> {
  const snap = await getDoc(doc(getDbInstance(), 'users', uid(), 'companies', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Company) : null;
}

export async function createCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
  const payload = { ...data, createdAt: new Date().toISOString() };
  const ref = await addDoc(col('companies'), payload);
  return { id: ref.id, ...payload };
}

export async function updateCompany(id: string, data: Partial<Company>) {
  const { id: _id, createdAt: _createdAt, ...changes } = data;
  await updateDoc(doc(getDbInstance(), 'users', uid(), 'companies', id), changes);
}

function publicBrandLogoId(name: string) {
  const normalized = name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized ? encodeURIComponent(normalized) : null;
}

export async function getSharedBrandLogo(name: string): Promise<string | null> {
  const brandId = publicBrandLogoId(name);
  if (!brandId) return null;

  const snapshot = await getDoc(doc(getDbInstance(), 'publicBrandLogos', brandId));
  if (!snapshot.exists()) return null;
  const logoUrl = snapshot.data().logoUrl;
  return typeof logoUrl === 'string' ? logoUrl : null;
}

export async function syncSharedBrandLogo(name: string, logoUrl: string | null) {
  const brandId = publicBrandLogoId(name);
  const brandName = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!brandId || !brandName) return;

  const ownerUid = uid();
  const brandRef = doc(getDbInstance(), 'publicBrandLogos', brandId);
  await runTransaction(getDbInstance(), async (transaction) => {
    const snapshot = await transaction.get(brandRef);
    if (snapshot.exists() && snapshot.data().ownerUid !== ownerUid) return;

    if (!logoUrl) {
      if (snapshot.exists()) transaction.delete(brandRef);
      return;
    }

    if (snapshot.exists() && snapshot.data().logoUrl === logoUrl && snapshot.data().brandName === brandName) {
      return;
    }

    transaction.set(brandRef, {
      brandName,
      logoUrl,
      ownerUid,
      updatedAt: new Date().toISOString(),
    });
  });
}

// ─── Clients ────────────────────────────────────────────────
export async function getClients(companyId?: string): Promise<Client[]> {
  const snap = await getDocs(query(col('clients'), orderBy('name')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Client))
    .filter((client) => !companyId || client.companyId === companyId);
}

export async function getSuppliers(companyId?: string): Promise<Client[]> {
  const clients = await getClients(companyId);
  return clients.filter((client) => (client.type ?? 'client') === 'supplier');
}

export async function getClient(id: string): Promise<Client | null> {
  const db = getDbInstance();
  const snap = await getDoc(doc(db, 'users', uid(), 'clients', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Client;
}

export async function createClient(data: Omit<Client, 'id' | 'createdAt' | 'companyId'> & { companyId?: string }) {
  const payload = {
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    group: data.group ?? null,
    address: data.address ?? null,
    companyId: data.companyId ?? null,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(col('clients'), payload);
  return { id: ref.id, ...payload } as Client;
}

export async function updateClient(id: string, data: Partial<Client>) {
  const db = getDbInstance();
  const { id: _i, createdAt, companyId, ...rest } = data as any;
  await updateDoc(doc(db, 'users', uid(), 'clients', id), rest);
}

export async function deleteClient(id: string) {
  const db = getDbInstance();
  await deleteDoc(doc(db, 'users', uid(), 'clients', id));
}

// ─── Products ───────────────────────────────────────────────
export async function getProducts(companyId?: string): Promise<Product[]> {
  const snap = await getDocs(query(col('products'), orderBy('name')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Product))
    .filter((product) => !companyId || product.companyId === companyId);
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'companyId'> & { companyId?: string }) {
  const payload = {
    name: data.name,
    price: data.price || 0,
    stock: data.stock || 0,
    leadTime: data.leadTime ?? null,
    sku: data.sku ?? null,
    imageUrl: data.imageUrl ?? null,
    companyId: data.companyId ?? null,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(col('products'), payload);
  return { id: ref.id, ...payload } as Product;
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const db = getDbInstance();
  const { id: _i, createdAt, companyId, ...rest } = data as any;
  await updateDoc(doc(db, 'users', uid(), 'products', id), rest);
}

export async function deleteProduct(id: string) {
  const db = getDbInstance();
  await deleteDoc(doc(db, 'users', uid(), 'products', id));
}

// ─── Expenses ───────────────────────────────────────────────
export async function getExpenses(companyId?: string): Promise<Expense[]> {
  const snap = await getDocs(col('expenses'));
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Expense))
    .filter((expense) => !companyId || expense.companyId === companyId);
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function createExpense(data: Omit<Expense, 'id' | 'createdAt' | 'companyId'> & { companyId?: string }) {
  const payload = {
    description: data.description,
    amount: data.amount || 0,
    date: data.date || new Date().toISOString(),
    vendor: data.vendor ?? null,
    category: data.category ?? null,
    companyId: data.companyId ?? null,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(col('expenses'), payload);
  return { id: ref.id, ...payload } as Expense;
}

export async function deleteExpense(id: string) {
  const db = getDbInstance();
  await deleteDoc(doc(db, 'users', uid(), 'expenses', id));
}

// ─── Documents ──────────────────────────────────────────────
export async function getDocuments(companyId?: string): Promise<Document[]> {
  const snap = await getDocs(col('documents'));
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Document))
    .filter((document) => !companyId || document.companyId === companyId);
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getDocument(id: string): Promise<Document | null> {
  const db = getDbInstance();
  const snap = await getDoc(doc(db, 'users', uid(), 'documents', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Document;
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

async function syncInventoryForDocument(data: {
  companyId?: string;
  type: DocumentType;
  items: { name: string; qty: number }[];
}) {
  const delta = INVENTORY_DELTA_BY_TYPE[data.type] ?? 0;
  if (!data.companyId || delta === 0 || !data.items.length) return;

  const products = await getProducts(data.companyId);
  const quantityByProductId = new Map<string, number>();

  for (const item of data.items) {
    const name = item.name?.trim().toLowerCase();
    if (!name) continue;

    const product = products.find((candidate) => candidate.name.trim().toLowerCase() === name);
    if (!product) continue;

    quantityByProductId.set(
      product.id,
      (quantityByProductId.get(product.id) || 0) + (Number(item.qty) || 1)
    );
  }

  if (!quantityByProductId.size) return;

  const batch = writeBatch(getDbInstance());
  for (const [productId, quantity] of quantityByProductId) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) continue;

    batch.update(doc(getDbInstance(), 'users', uid(), 'products', productId), {
      stock: Math.max(0, (product.stock || 0) + quantity * delta),
    });
  }
  await batch.commit();
}

export async function createDocument(data: {
  type: DocumentType;
  clientId: string;
  total: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  status: DocumentStatus;
  notes?: string | null;
  dueDate?: string | null;
  sourceName?: string | null;
  sourceUri?: string | null;
  sourceType?: 'pdf' | 'word' | 'excel' | 'csv' | 'other' | null;
  items: { name: string; qty: number; price: number }[];
  companyId?: string;
}): Promise<Document> {
  const clients = await getClients();
  const clientName = clients.find((c) => c.id === data.clientId)?.name || '—';

  const existing = await getDocuments();
  const count = existing.filter((d) => d.type === data.type).length + 1;
  const prefix: Record<string, string> = {
    invoice: 'INV',
    proforma: 'PRO',
    credit_note: 'CN',
    debit_note: 'DN',
    rfq: 'RFQ',
    purchase_order: 'PO',
    quote: 'QT',
  };
  const number = `${prefix[data.type] || 'DOC'}-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

  const payload = {
    type: data.type,
    number,
    total: data.total,
    subtotal: data.subtotal,
    taxRate: data.taxRate,
    taxAmount: data.taxAmount,
    status: data.status,
    notes: data.notes ?? null,
    dueDate: data.dueDate ?? null,
    clientId: data.clientId,
    clientName,
    companyId: data.companyId ?? null,
    items: data.items,
    sourceName: (data as any).sourceName ?? null,
    sourceUri: (data as any).sourceUri ?? null,
    sourceType: (data as any).sourceType ?? null,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(col('documents'), payload);
  await syncInventoryForDocument(data);
  return { id: ref.id, ...payload } as Document;
}

export async function updateDocumentStatus(id: string, status: DocumentStatus) {
  const db = getDbInstance();
  await updateDoc(doc(db, 'users', uid(), 'documents', id), { status });
}

export async function deleteDocument(id: string) {
  const db = getDbInstance();
  await deleteDoc(doc(db, 'users', uid(), 'documents', id));
}

// ─── Recurring ──────────────────────────────────────────────
export async function getRecurring(companyId?: string): Promise<RecurringDocument[]> {
  const snap = await getDocs(col('recurring'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as RecurringDocument))
    .filter((recurring) => !companyId || recurring.companyId === companyId);
}

export async function createRecurring(data: {
  clientId: string;
  amount: number;
  frequency: string;
  nextDate: string;
  description?: string | null;
  companyId?: string;
}): Promise<RecurringDocument> {
  const clients = await getClients();
  const clientName = clients.find((c) => c.id === data.clientId)?.name || '—';
  const payload = {
    ...data,
    companyId: data.companyId ?? null,
    clientName,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(col('recurring'), payload);
  return { id: ref.id, ...payload } as RecurringDocument;
}

export async function deleteRecurring(id: string) {
  const db = getDbInstance();
  await deleteDoc(doc(db, 'users', uid(), 'recurring', id));
}

export async function updateDocument(id: string, data: Partial<Document>) {
  const { id: _id, createdAt: _createdAt, ...changes } = data;
  await updateDoc(doc(getDbInstance(), 'users', uid(), 'documents', id), changes);
}

// ─── Dashboard ──────────────────────────────────────────────
export async function getDashboardStats(companyId?: string): Promise<DashboardStats> {
  const [products, expenses, documents] = await Promise.all([
    getProducts(companyId),
    getExpenses(companyId),
    getDocuments(companyId),
  ]);
  return {
    activeSkuCount: products.length,
    totalValuation: products.reduce((s, p) => s + p.price * p.stock, 0),
    outstandingBilling: documents
      .filter((d) => d.type === 'invoice' && ['sent', 'overdue', 'draft'].includes(d.status))
      .reduce((s, d) => s + d.total, 0),
    totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
    recentDocuments: documents.slice(0, 10),
  };
}

// Compatibility stubs
export async function seedIfEmpty() {}
export async function getDb() {
  return null;
}