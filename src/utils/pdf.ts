import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Company, Document, LineItem } from '../types';
import { DOC_TYPE_LABELS, formatCurrency } from './format';

export async function downloadDocumentPdf(doc: Document, company?: Company | string | null) {
  const companyName = typeof company === 'string' ? company : company?.name || 'Company';
  const companyLogo = typeof company === 'string' ? null : company?.logo || null;
  const itemRows = (doc.items || []).map((item: LineItem) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${formatCurrency(item.qty * item.price)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #111827; background: #fff; margin: 0; padding: 24px; }
          .container { max-width: 760px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
          .company { font-size: 28px; font-weight: 700; }
          .type { margin-top: 4px; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: #6b7280; }
          .meta { margin: 18px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; }
          th { background: #f3f4f6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; }
          .totals { margin-top: 18px; width: 260px; margin-left: auto; }
          .totals-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
          .grand { font-size: 20px; font-weight: 700; color: #059669; }
          .notes { margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 8px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="display:flex; align-items:center; gap:14px;">
              ${companyLogo ? `<img src="${companyLogo}" alt="Brand logo" style="width:56px;height:56px;border-radius:12px;object-fit:cover;border:1px solid #e5e7eb;" />` : ''}
              <div>
                <div class="company">${companyName}</div>
                <div class="type">${DOC_TYPE_LABELS[doc.type] || doc.type}</div>
              </div>
            </div>
            <div style="text-align:right; font-size:14px; color:#374151;">
              <div><strong>Document #</strong> ${doc.number}</div>
              <div><strong>Date</strong> ${new Date(doc.createdAt).toLocaleDateString('en-IN')}</div>
            </div>
          </div>

          <div class="meta">
            <div><strong>Client:</strong> ${doc.clientName || '—'}</div>
            <div><strong>Status:</strong> ${doc.status}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows || '<tr><td colspan="4">No items</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(doc.subtotal)}</span></div>
            <div class="totals-row"><span>Tax (${doc.taxRate}%)</span><span>${formatCurrency(doc.taxAmount)}</span></div>
            <div class="totals-row grand"><span>Total</span><span>${formatCurrency(doc.total)}</span></div>
          </div>

          ${doc.notes ? `<div class="notes"><strong>Notes:</strong><br>${doc.notes}</div>` : ''}
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      UTI: 'com.adobe.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `${DOC_TYPE_LABELS[doc.type] || doc.type} ${doc.number}`,
    });
  }

  return uri;
}
