export type DocumentType =
  | 'invoice'
  | 'proforma'
  | 'credit_note'
  | 'debit_note'
  | 'rfq'
  | 'purchase_order'
  | 'quote'
  | 'inbound_document';

export type DocumentStatus =
  | 'draft'
  | 'sent'
  | 'waiting_for_approval'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'accepted'
  | 'rejected';

export interface Company {
  id: string;
  name: string;
  logo?: string | null;
  tagline?: string | null;
  brandColor?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  createdAt: string;
}

export type ContactType = 'client' | 'supplier';

export interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  group?: string | null;
  address?: string | null;
  type?: ContactType;
  companyId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  leadTime?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  companyId: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  vendor?: string | null;
  category?: string | null;
  companyId: string;
  createdAt: string;
}

export interface LineItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  documentId: string;
}

export interface Document {
  id: string;
  type: DocumentType;
  number: string;
  total: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  status: DocumentStatus;
  notes?: string | null;
  createdAt: string;
  dueDate?: string | null;
  companyId: string;
  clientId: string;
  clientName?: string;
  sourceName?: string | null;
  sourceUri?: string | null;
  sourceType?: 'pdf' | 'word' | 'excel' | 'csv' | 'other' | null;
  items?: LineItem[];
}

export interface RecurringDocument {
  id: string;
  clientId: string;
  clientName?: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDate: string;
  description?: string | null;
  companyId: string;
  createdAt: string;
}

export interface DashboardStats {
  activeSkuCount: number;
  totalValuation: number;
  outstandingBilling: number;
  totalExpenses: number;
  recentDocuments: Document[];
}
