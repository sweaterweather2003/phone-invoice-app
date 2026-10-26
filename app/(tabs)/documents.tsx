import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCompany } from '../../src/hooks/useCompany';
import * as db from '../../src/db/firebaseDb';
import type { Document } from '../../src/types';
import { Screen, Card, Badge, EmptyState, FAB } from '../../src/components/ui';
import { colors, spacing, radius, typography } from '../../src/theme';
import { formatCurrency, formatShortDate, DOC_TYPE_LABELS, STATUS_LABELS } from '../../src/utils/format';

const STATUS_COLORS: Record<string, { color: string; soft: string }> = {
  paid: { color: colors.success, soft: colors.successSoft },
  sent: { color: colors.accent, soft: colors.accentSoft },
  waiting_for_approval: { color: colors.accent, soft: colors.accentSoft },
  draft: { color: colors.textSecondary, soft: colors.surfaceAlt },
  overdue: { color: colors.danger, soft: colors.dangerSoft },
  cancelled: { color: colors.textMuted, soft: colors.surfaceAlt },
  accepted: { color: colors.success, soft: colors.successSoft },
  rejected: { color: colors.danger, soft: colors.dangerSoft },
};

const FILTERS = ['all', 'invoice', 'proforma', 'credit_note', 'debit_note', 'rfq', 'purchase_order'] as const;

export default function DocumentsScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    const list = await db.getDocuments(company.id);
    setDocs(list);
  }, [company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = filter === 'all' ? docs : docs.filter((d) => d.type === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll style={{ paddingTop: spacing.md }}>
        {/* Filters */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'All' : DOC_TYPE_LABELS[f] || f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!filtered.length ? (
          <EmptyState
            icon="document-text-outline"
            title="No documents"
            subtitle="Create invoices, proformas, credit notes and more"
            actionLabel="New Document"
            onAction={() => router.push({ pathname: '/document-form', params: { type: 'invoice' } })}
          />
        ) : (
          filtered.map((doc) => {
            const sc = STATUS_COLORS[doc.status] || STATUS_COLORS.draft;
            return (
              <Card
                key={doc.id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/document-detail', params: { id: doc.id } })}
              >
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.number}>{doc.number}</Text>
                    <Text style={styles.client}>{doc.clientName || '—'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>{formatCurrency(doc.total)}</Text>
                    <Badge label={STATUS_LABELS[doc.status] || doc.status} color={sc.color} softColor={sc.soft} />
                  </View>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.type}>{DOC_TYPE_LABELS[doc.type] || doc.type}</Text>
                  <Text style={styles.date}>{formatShortDate(doc.createdAt)}</Text>
                </View>
              </Card>
            );
          })
        )}
      </Screen>
      <FAB onPress={() => router.push({ pathname: '/document-form', params: { type: 'invoice' } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  number: { ...typography.bodyBold, color: colors.text },
  client: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.bodyBold, color: colors.text, marginBottom: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { ...typography.small, color: colors.textMuted, textTransform: 'uppercase' },
  date: { ...typography.small, color: colors.textMuted },
});
