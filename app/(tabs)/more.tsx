import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../../src/hooks/useCompany';
import { useAuth } from '../../src/hooks/useAuth';
import * as db from '../../src/db/firebaseDb';
import type { Expense, RecurringDocument } from '../../src/types';
import { Screen, Card, SectionHeader, EmptyState } from '../../src/components/ui';
import { colors, spacing, radius, typography } from '../../src/theme';
import { formatCurrency, formatDate } from '../../src/utils/format';

export default function MoreScreen() {
  const { company } = useCompany();
  const { logout } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringDocument[]>([]);
  const [section, setSection] = useState<'menu' | 'expenses' | 'recurring' | 'reports'>('menu');

  const load = useCallback(async () => {
    if (!company) return;
    setExpenses(await db.getExpenses(company.id));
    setRecurring(await db.getRecurring(company.id));
  }, [company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime on this or another phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/login');
          } catch (error: any) {
            Alert.alert('Sign out failed', error?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  if (section === 'expenses') {
    return (
      <Screen scroll style={{ paddingTop: spacing.md }}>
        <TouchableOpacity onPress={() => setSection('menu')} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <SectionHeader
          title="Expenses"
          actionLabel="+ Add"
          onAction={() => router.push('/expense-form')}
        />
        {!expenses.length ? (
          <EmptyState icon="card-outline" title="No expenses" subtitle="Track business outlays here" />
        ) : (
          expenses.map((e) => (
            <Card key={e.id} style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{e.description}</Text>
                  <Text style={styles.meta}>
                    {formatDate(e.date)}
                    {e.vendor ? ` · ${e.vendor}` : ''}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatCurrency(e.amount)}</Text>
              </View>
            </Card>
          ))
        )}
      </Screen>
    );
  }

  if (section === 'recurring') {
    return (
      <Screen scroll style={{ paddingTop: spacing.md }}>
        <TouchableOpacity onPress={() => setSection('menu')} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <SectionHeader
          title="Recurring Billing"
          actionLabel="+ Add"
          onAction={() => router.push('/recurring-form')}
        />
        {!recurring.length ? (
          <EmptyState
            icon="repeat-outline"
            title="No recurring cycles"
            subtitle="Set up monthly or weekly auto-invoices"
          />
        ) : (
          recurring.map((r) => (
            <Card key={r.id} style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{r.clientName || 'Client'}</Text>
                  <Text style={styles.meta}>
                    {r.frequency} · Next: {formatDate(r.nextDate)}
                  </Text>
                  {r.description ? <Text style={styles.meta}>{r.description}</Text> : null}
                </View>
                <Text style={styles.amount}>{formatCurrency(r.amount)}</Text>
              </View>
            </Card>
          ))
        )}
      </Screen>
    );
  }

  if (section === 'reports') {
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    return (
      <Screen scroll style={{ paddingTop: spacing.md }}>
        <TouchableOpacity onPress={() => setSection('menu')} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <SectionHeader title="P&L Snapshot" />
        <Card style={styles.card}>
          <Text style={styles.reportLabel}>Total Expenses Logged</Text>
          <Text style={styles.reportValue}>{formatCurrency(totalExp)}</Text>
        </Card>
        <Card style={styles.card}>
          <Text style={styles.reportLabel}>Active Recurring Revenue</Text>
          <Text style={styles.reportValue}>
            {formatCurrency(recurring.reduce((s, r) => s + r.amount, 0))}
          </Text>
        </Card>
        <Text style={styles.hint}>
          Full P&L with invoice revenue appears on the Dashboard. Export and advanced reports can be
          added later.
        </Text>
      </Screen>
    );
  }

  // Main menu
  const menuItems = [
    {
      icon: 'receipt-outline' as const,
      label: 'Customer Invoices',
      desc: 'Create and manage customer billing',
      onPress: () => router.push({ pathname: '/document-form', params: { type: 'invoice' } }),
      color: colors.primary,
    },
    {
      icon: 'document-text-outline' as const,
      label: 'Proforma Bills',
      desc: 'Draft commercial estimates',
      onPress: () => router.push({ pathname: '/document-form', params: { type: 'proforma' } }),
      color: colors.accent,
    },
    {
      icon: 'card-outline' as const,
      label: 'Expenses & Vendors',
      desc: 'Log & track outlays',
      onPress: () => setSection('expenses'),
      color: colors.danger,
    },
    {
      icon: 'repeat-outline' as const,
      label: 'Recurring Cycles',
      desc: 'Auto-billing schedules',
      onPress: () => setSection('recurring'),
      color: colors.info,
    },
    {
      icon: 'bar-chart-outline' as const,
      label: 'Reports & P&L Analysis',
      desc: 'Financial overview',
      onPress: () => setSection('reports'),
      color: colors.success,
    },
    {
      icon: 'paper-plane-outline' as const,
      label: 'RFQ Pipelines',
      desc: 'Inbound & outbound quotations',
      onPress: () => router.push('/rfq-pipeline'),
      color: colors.accent,
    },
    {
      icon: 'pricetag-outline' as const,
      label: 'Vendor Quotations',
      desc: 'Review supplier offers',
      onPress: () => router.push('/vendor-quotations'),
      color: colors.warning,
    },
    {
      icon: 'remove-circle-outline' as const,
      label: 'Credit Notes',
      desc: 'Adjust customer balances',
      onPress: () => router.push({ pathname: '/document-form', params: { type: 'credit_note' } }),
      color: colors.danger,
    },
    {
      icon: 'add-circle-outline' as const,
      label: 'Debit Notes',
      desc: 'Add supplemental charges',
      onPress: () => router.push({ pathname: '/document-form', params: { type: 'debit_note' } }),
      color: colors.info,
    },
    {
      icon: 'time-outline' as const,
      label: 'Document History',
      desc: 'See past records and statuses',
      onPress: () => router.push('/documents'),
      color: colors.primary,
    },
    {
      icon: 'business-outline' as const,
      label: 'Switch Workspace',
      desc: 'Change brand / company',
      onPress: () => router.push('/company-select'),
      color: colors.accent,
    },
    ...(company
      ? [{
          icon: 'settings-outline' as const,
          label: 'Company Settings',
          desc: 'Edit logo, tagline & contact details',
          onPress: () => router.push({ pathname: '/company-create', params: { id: company.id } }),
          color: colors.textSecondary,
        }]
      : []),
    {
      icon: 'add-circle-outline' as const,
      label: 'New Brand',
      desc: 'Create another company',
      onPress: () => router.push('/company-create'),
      color: colors.primary,
    },
    {
      icon: 'log-out-outline' as const,
      label: 'Sign Out Workspace',
      desc: 'Log out of this device',
      onPress: onSignOut,
      color: colors.danger,
    },
  ];

  return (
    <Screen scroll style={{ paddingTop: spacing.md }}>
      <Text style={styles.heading}>More Tools</Text>
      {menuItems.map((item) => (
        <Card key={item.label} style={styles.menuCard} onPress={item.onPress}>
          <View style={styles.row}>
            <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  menuCard: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { ...typography.bodyBold, color: colors.text },
  menuDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  backText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  card: { marginBottom: spacing.md },
  title: { ...typography.bodyBold, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.bodyBold, color: colors.text },
  reportLabel: { ...typography.caption, color: colors.textSecondary },
  reportValue: { ...typography.h2, color: colors.text, marginTop: 4 },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});