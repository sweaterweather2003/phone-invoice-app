import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../../src/hooks/useCompany';
import * as db from '../../src/db/firebaseDb';
import type { Client } from '../../src/types';
import { Screen, Card, EmptyState, FAB } from '../../src/components/ui';
import { colors, spacing, radius, typography } from '../../src/theme';

export default function ClientsScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [tab, setTab] = useState<'client' | 'supplier'>('client');

  const load = useCallback(async () => {
    if (!company) return;
    const [clientsList, suppliersList] = await Promise.all([
      db.getClients(company.id),
      db.getSuppliers(company.id),
    ]);
    setClients([...clientsList, ...suppliersList]);
  }, [company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const displayClients = clients.filter((c) => (c.type ?? 'client') === tab);

  const onDelete = (c: Client) => {
    Alert.alert(tab === 'client' ? 'Delete client?' : 'Delete supplier?', c.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await db.deleteClient(c.id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll style={{ paddingTop: spacing.md }}>
        <View style={styles.tabs}>
          <Ionicons name="people-outline" size={16} color={tab === 'client' ? colors.primary : colors.textMuted} />
          <Text onPress={() => setTab('client')} style={[styles.tabText, tab === 'client' && styles.tabTextActive]}>
            Clients
          </Text>
          <Text onPress={() => setTab('supplier')} style={[styles.tabText, tab === 'supplier' && styles.tabTextActive]}>
            Suppliers
          </Text>
        </View>

        {!displayClients.length ? (
          <EmptyState
            icon="people-outline"
            title={tab === 'client' ? 'No clients yet' : 'No suppliers yet'}
            subtitle={tab === 'client' ? 'Add customers and parties you bill' : 'Add suppliers and parties you buy from'}
            actionLabel={tab === 'client' ? 'Add Client' : 'Add Supplier'}
            onAction={() => router.push({ pathname: '/client-form', params: { role: tab } })}
          />
        ) : (
          displayClients.map((c) => (
            <Card key={c.id} style={styles.card} onPress={() => router.push({ pathname: '/client-form', params: { id: c.id, role: tab } })}>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  {c.email ? <Text style={styles.meta}>{c.email}</Text> : null}
                  {c.phone ? <Text style={styles.meta}>{c.phone}</Text> : null}
                  {c.group ? (
                    <View style={styles.groupBadge}>
                      <Text style={styles.groupText}>{c.group}</Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          ))
        )}
      </Screen>
      <FAB onPress={() => router.push({ pathname: '/client-form', params: { role: tab } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabText: {
    ...typography.bodyBold,
    color: colors.textMuted,
    paddingVertical: 4,
  },
  tabTextActive: {
    color: colors.primary,
  },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  name: { ...typography.bodyBold, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  groupBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  groupText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
});
