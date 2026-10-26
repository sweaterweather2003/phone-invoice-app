export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Invoice',
  proforma: 'Proforma',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
  rfq: 'RFQ',
  purchase_order: 'Purchase Order',
  quote: 'Quote',
  inbound_document: 'Inbound File',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  waiting_for_approval: 'Waiting for approval',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  accepted: 'Accepted',
  rejected: 'Rejected',
};
