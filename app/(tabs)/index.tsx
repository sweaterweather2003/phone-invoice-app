import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../../src/hooks/useCompany';
import * as db from '../../src/db/firebaseDb';
import type { DashboardStats } from '../../src/types';
import { Screen, Card, StatCard, SectionHeader, Badge, EmptyState } from '../../src/components/ui';
import { colors, spacing, radius, typography } from '../../src/theme';
import { formatCurrency, formatShortDate, DOC_TYPE_LABELS, STATUS_LABELS } from '../../src/utils/format';

const STATUS_COLORS: Record<string, { color: string; soft: string }> = {
  paid: { color: colors.success, soft: colors.successSoft },
  sent: { color: colors.accent, soft: colors.accentSoft },
  draft: { color: colors.textSecondary, soft: colors.surfaceAlt },
  overdue: { color: colors.danger, soft: colors.dangerSoft },
  cancelled: { color: colors.textMuted, soft: colors.surfaceAlt },
};

export default function DashboardScreen() {
  const { company, loading: companyLoading } = useCompany();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    const s = await db.getDashboardStats(company.id);
    setStats(s);
  }, [company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (companyLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!company) {
    return (
      <Screen style={{ paddingTop: spacing.md }}>
        <EmptyState
          icon="briefcase-outline"
          title="No Workspace"
          subtitle="Create your first brand to get started"
          actionLabel="Create Brand"
          onAction={() => router.push('/company-create')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      style={{ paddingTop: spacing.md }}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandIdentity}>
          {company.logo ? (
            <Image source={{ uri: company.logo }} style={styles.companyLogo} resizeMode="contain" />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoInitial}>{company.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.brandDetails}>
            <Text style={styles.greeting}>Workspace</Text>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.tagline ? <Text style={styles.tagline}>{company.tagline}</Text> : null}
          </View>
        </View>
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => router.push('/company-select')}
        >
          <Ionicons name="swap-horizontal" size={18} color={colors.accent} />
          <Text style={styles.switchText}>Switch</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Active SKUs"
          value={String(stats?.activeSkuCount ?? 0)}
          icon="cube-outline"
          color={colors.success}
          softColor={colors.successSoft}
        />
        <StatCard
          label="Stock Value"
          value={formatCurrency(stats?.totalValuation ?? 0)}
          icon="trending-up-outline"
          color={colors.accent}
          softColor={colors.accentSoft}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats?.outstandingBilling ?? 0)}
          icon="wallet-outline"
          color={colors.warning}
          softColor={colors.warningSoft}
        />
        <StatCard
          label="Expenses"
          value={formatCurrency(stats?.totalExpenses ?? 0)}
          icon="card-outline"
          color={colors.danger}
          softColor={colors.dangerSoft}
        />
      </View>

      {/* Quick Actions */}
      <SectionHeader title="Quick Create" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickScroll}
      >
        {[
          { label: 'Invoice', type: 'invoice', icon: 'receipt-outline' as const, color: colors.invoice },
          { label: 'Proforma', type: 'proforma', icon: 'document-outline' as const, color: colors.proforma },
          { label: 'RFQ', type: 'rfq', icon: 'help-circle-outline' as const, color: colors.rfq },
          { label: 'Purchase Order', type: 'purchase_order', icon: 'cart-outline' as const, color: colors.accent },
          { label: 'Vendor Quote', type: 'quote', icon: 'pricetag-outline' as const, color: colors.warning },
          { label: 'Credit Note', type: 'credit_note', icon: 'remove-circle-outline' as const, color: colors.danger },
          { label: 'Debit Note', type: 'debit_note', icon: 'add-circle-outline' as const, color: colors.info },
          { label: 'Expense', type: 'expense', icon: 'cash-outline' as const, color: colors.danger },
        ].map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.quickItem}
            onPress={() => {
              if (a.type === 'expense') router.push('/expense-form');
              else router.push({ pathname: '/document-form', params: { type: a.type } });
            }}
          >
            <View style={[styles.quickIcon, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon} size={22} color={a.color} />
            </View>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recent Documents */}
      <SectionHeader
        title="Recent Activity"
        actionLabel="See all"
        onAction={() => router.push('/(tabs)/documents')}
      />

      {!stats?.recentDocuments?.length ? (
        <EmptyState
          icon="document-text-outline"
          title="No documents yet"
          subtitle="Create your first invoice or proforma"
          actionLabel="New Invoice"
          onAction={() => router.push({ pathname: '/document-form', params: { type: 'invoice' } })}
        />
      ) : (
        stats.recentDocuments.map((doc) => {
          const sc = STATUS_COLORS[doc.status] || STATUS_COLORS.draft;
          return (
            <Card
              key={doc.id}
              style={styles.docCard}
              onPress={() => router.push({ pathname: '/document-detail', params: { id: doc.id } })}
            >
              <View style={styles.docRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docNumber}>{doc.number}</Text>
                  <Text style={styles.docClient}>{doc.clientName || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.docAmount}>{formatCurrency(doc.total)}</Text>
                  <Badge label={STATUS_LABELS[doc.status] || doc.status} color={sc.color} softColor={sc.soft} />
                </View>
              </View>
              <View style={styles.docMeta}>
                <Text style={styles.docType}>{DOC_TYPE_LABELS[doc.type] || doc.type}</Text>
                <Text style={styles.docDate}>{formatShortDate(doc.createdAt)}</Text>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  brandIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandDetails: { flex: 1, minWidth: 0 },
  companyLogo: {
    width: 84,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: { color: colors.textInverse, fontSize: 22, fontWeight: '700' },
  greeting: { ...typography.label, color: colors.textMuted },
  companyName: { ...typography.h1, color: colors.text, marginTop: 2 },
  tagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  switchText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickScroll: {
    paddingBottom: spacing.sm,
    paddingRight: spacing.sm,
  },
  quickItem: {
    alignItems: 'center',
    marginRight: spacing.md,
    minWidth: 84,
  },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  docCard: { marginBottom: spacing.md },
  docRow: { flexDirection: 'row', marginBottom: spacing.sm },
  docNumber: { ...typography.bodyBold, color: colors.text },
  docClient: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  docAmount: { ...typography.bodyBold, color: colors.text, marginBottom: 4 },
  docMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  docType: { ...typography.small, color: colors.textMuted, textTransform: 'uppercase' },
  docDate: { ...typography.small, color: colors.textMuted },
});
