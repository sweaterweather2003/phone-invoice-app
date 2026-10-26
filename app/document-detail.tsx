import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as db from '../src/db/firebaseDb';
import { useCompany } from '../src/hooks/useCompany';
import type { Document, DocumentStatus } from '../src/types';
import { Screen, Card, Badge, Button } from '../src/components/ui';
import { colors, spacing, radius, typography } from '../src/theme';
import { formatCurrency, formatDate, DOC_TYPE_LABELS, STATUS_LABELS } from '../src/utils/format';
import { downloadDocumentPdf } from '../src/utils/pdf';
import { sendDocumentEmail } from '../src/api/email';

const STATUS_COLORS: Record<string, { color: string; soft: string }> = {
  paid: { color: colors.success, soft: colors.successSoft },
  sent: { color: colors.accent, soft: colors.accentSoft },
  waiting_for_approval: { color: colors.accent, soft: colors.accentSoft },
  draft: { color: colors.textSecondary, soft: colors.surfaceAlt },
  overdue: { color: colors.danger, soft: colors.dangerSoft },
  cancelled: { color: colors.textMuted, soft: colors.surfaceAlt },
};

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { company } = useCompany();
  const [doc, setDoc] = useState<Document | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const document = await db.getDocument(id);
    setDoc(document);
    if (document) {
      const client = await db.getClient(document.clientId);
      setRecipientEmail(client?.email || null);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!doc) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  const sc = STATUS_COLORS[doc.status] || STATUS_COLORS.draft;

  const setStatus = async (status: DocumentStatus) => {
    await db.updateDocumentStatus(doc.id, status);
    load();
  };

  const onDelete = () => {
    Alert.alert('Delete document?', doc.number, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await db.deleteDocument(doc.id);
          router.back();
        },
      },
    ]);
  };

  const onShare = async () => {
    const lines = [
      `${DOC_TYPE_LABELS[doc.type]} ${doc.number}`,
      `${doc.type === 'purchase_order' ? 'Vendor' : 'Buyer'}: ${doc.clientName || '—'}`,
      `Status: ${STATUS_LABELS[doc.status]}`,
      `Date: ${formatDate(doc.createdAt)}`,
      '',
      ...(doc.items || []).map((i) => `• ${i.name} × ${i.qty} @ ${formatCurrency(i.price)}`),
      '',
      `Subtotal: ${formatCurrency(doc.subtotal)}`,
      `Tax (${doc.taxRate}%): ${formatCurrency(doc.taxAmount)}`,
      `Total: ${formatCurrency(doc.total)}`,
    ];
    await Share.share({ message: lines.join('\n') });
  };

  const onDownloadPdf = async () => {
    try {
      await downloadDocumentPdf(doc, company || undefined);
    } catch (error) {
      Alert.alert('PDF Error', 'Could not generate the PDF for this document.');
    }
  };

  const onSendEmail = async () => {
    if (!recipientEmail) {
      Alert.alert('Email required', 'Add an email address to this buyer or supplier before sending.');
      return;
    }

    setSending(true);
    try {
      await sendDocumentEmail(doc.id);
      await load();
      Alert.alert('Email sent', `Document sent to ${recipientEmail}.`);
    } catch (error) {
      Alert.alert('Email not sent', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen scroll style={{ paddingTop: spacing.md }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.number}>{doc.number}</Text>
          <Text style={styles.type}>{DOC_TYPE_LABELS[doc.type]}</Text>
        </View>
        <Badge label={STATUS_LABELS[doc.status]} color={sc.color} softColor={sc.soft} />
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>{doc.type === 'purchase_order' ? 'Vendor' : 'Buyer'}</Text>
        <Text style={styles.value}>{doc.clientName || '—'}</Text>
        {recipientEmail ? (
          <>
            <Text style={[styles.label, { marginTop: spacing.md }]}>Email</Text>
            <Text style={styles.value}>{recipientEmail}</Text>
          </>
        ) : null}
        <Text style={[styles.label, { marginTop: spacing.md }]}>Date</Text>
        <Text style={styles.value}>{formatDate(doc.createdAt)}</Text>
        {doc.dueDate && (
          <>
            <Text style={[styles.label, { marginTop: spacing.md }]}>Due Date</Text>
            <Text style={styles.value}>{formatDate(doc.dueDate)}</Text>
          </>
        )}
      </Card>

      <Text style={styles.section}>Line Items</Text>
      {(doc.items || []).map((item, index) => (
        <Card key={`${item.id || item.name}-${index}`} style={styles.itemCard}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemMeta}>
              {item.qty} × {formatCurrency(item.price)}
            </Text>
            <Text style={styles.itemTotal}>{formatCurrency(item.qty * item.price)}</Text>
          </View>
        </Card>
      ))}

      <Card style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalVal}>{formatCurrency(doc.subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax ({doc.taxRate}%)</Text>
          <Text style={styles.totalVal}>{formatCurrency(doc.taxAmount)}</Text>
        </View>
        <View style={[styles.totalRow, { marginTop: 8 }]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandVal}>{formatCurrency(doc.total)}</Text>
        </View>
      </Card>

      {doc.notes ? (
        <Card style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <Text style={styles.value}>{doc.notes}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {doc.type !== 'inbound_document' && (
          <Button
            title={recipientEmail ? `Email ${doc.type === 'purchase_order' ? 'supplier' : 'buyer'}` : 'Add buyer/supplier email to send'}
            onPress={onSendEmail}
            loading={sending}
            variant="primary"
            icon="mail"
            style={{ marginBottom: spacing.sm }}
          />
        )}
        {doc.status === 'draft' && (
          <Button
            title={
              doc.type === 'rfq'
                ? 'Send for approval'
                : doc.type === 'purchase_order'
                  ? 'Mark PO as sent without emailing'
                  : 'Mark as Sent without emailing'
            }
            onPress={() => setStatus(doc.type === 'rfq' ? 'waiting_for_approval' : 'sent')}
            style={{ marginBottom: spacing.sm }}
          />
        )}
        {doc.status === 'waiting_for_approval' && (
          <Button
            title="Send later"
            variant="outline"
            onPress={() => setStatus('draft')}
            style={{ marginBottom: spacing.sm }}
          />
        )}
        {(doc.status === 'sent' || doc.status === 'overdue' || doc.status === 'waiting_for_approval') && (
          <Button title="Mark as Paid" variant="secondary" onPress={() => setStatus('paid')} style={{ marginBottom: spacing.sm }} />
        )}
        <Button title="Download PDF" variant="outline" icon="download-outline" onPress={onDownloadPdf} style={{ marginBottom: spacing.sm }} />
        <Button title="Share" variant="outline" icon="share-outline" onPress={onShare} style={{ marginBottom: spacing.sm }} />
        <Button title="Delete" variant="danger" onPress={onDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  number: { ...typography.h2, color: colors.text },
  type: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  card: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textMuted },
  value: { ...typography.bodyBold, color: colors.text, marginTop: 2 },
  section: { ...typography.h3, color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },
  itemCard: { marginBottom: spacing.sm, paddingVertical: spacing.md },
  itemName: { ...typography.bodyBold, color: colors.text },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  itemMeta: { ...typography.caption, color: colors.textSecondary },
  itemTotal: { ...typography.bodyBold, color: colors.text },
  totals: { marginTop: spacing.md, marginBottom: spacing.lg },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { ...typography.body, color: colors.textSecondary },
  totalVal: { ...typography.body, color: colors.text },
  grandLabel: { ...typography.h3, color: colors.text },
  grandVal: { ...typography.h3, color: colors.primary },
  actions: { marginTop: spacing.md, marginBottom: spacing.xxxl },
});
