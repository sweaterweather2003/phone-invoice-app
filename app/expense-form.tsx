import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import { Screen, Input, Button } from '../src/components/ui';
import { spacing } from '../src/theme';

export default function ExpenseFormScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    if (!description.trim() || !amount || !company) {
      Alert.alert('Required', 'Description and amount are required');
      return;
    }
    setLoading(true);
    try {
      await db.createExpense({
        description: description.trim(),
        amount: parseFloat(amount) || 0,
        date: new Date().toISOString(),
        vendor: vendor.trim() || null,
        category: category.trim() || null,
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
        <Input label="Description *" value={description} onChangeText={setDescription} placeholder="What was this expense for?" />
        <Input label="Amount (₹) *" value={amount} onChangeText={setAmount} placeholder="5000" keyboardType="decimal-pad" />
        <Input label="Vendor" value={vendor} onChangeText={setVendor} placeholder="Supplier name" />
        <Input label="Category" value={category} onChangeText={setCategory} placeholder="Office / Travel / Marketing" />
        <Button title="Save Expense" onPress={onSave} loading={loading} style={{ marginTop: spacing.md }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
