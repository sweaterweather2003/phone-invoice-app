import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import type { Client } from '../src/types';
import { Screen, Input, Button } from '../src/components/ui';
import { colors, spacing, radius, typography } from '../src/theme';

const FREQS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

export default function RecurringFormScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<(typeof FREQS)[number]>('monthly');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (company) db.getClients(company.id).then(setClients);
  }, [company]);

  const onSave = async () => {
    if (!company || !clientId || !amount) {
      Alert.alert('Required', 'Buyer and amount are required');
      return;
    }
    setLoading(true);
    try {
      const next = new Date();
      if (frequency === 'weekly') next.setDate(next.getDate() + 7);
      else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
      else next.setFullYear(next.getFullYear() + 1);

      await db.createRecurring({
        clientId,
        amount: parseFloat(amount) || 0,
        frequency,
        nextDate: next.toISOString(),
        description: description.trim() || null,
        companyId: company.id,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll style={{ paddingTop: spacing.lg }}>
        <Text style={styles.label}>BUYER *</Text>
        <View style={styles.chipRow}>
          {clients.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setClientId(c.id)}
              style={[styles.chip, clientId === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, clientId === c.id && { color: '#fff' }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input label="Amount (₹) *" value={amount} onChangeText={setAmount} placeholder="10000" keyboardType="decimal-pad" />

        <Text style={styles.label}>FREQUENCY</Text>
        <View style={styles.chipRow}>
          {FREQS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFrequency(f)}
              style={[styles.chip, frequency === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, frequency === f && { color: '#fff' }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Optional note" />
        <Button title="Create Recurring" onPress={onSave} loading={loading} style={{ marginTop: spacing.md }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
});
