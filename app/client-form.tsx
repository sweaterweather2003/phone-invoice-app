import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import { Screen, Input, Button } from '../src/components/ui';
import { spacing } from '../src/theme';

export default function ClientFormScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const { id, role } = useLocalSearchParams<{ id?: string; role?: 'client' | 'supplier' }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [group, setGroup] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [partyType, setPartyType] = useState<'client' | 'supplier'>(role === 'supplier' ? 'supplier' : 'client');

  useEffect(() => {
    if (id) {
      db.getClient(id).then((c) => {
        if (c) {
          setName(c.name);
          setEmail(c.email || '');
          setPhone(c.phone || '');
          setGroup(c.group || '');
          setAddress(c.address || '');
          setPartyType(c.type ?? 'client');
        }
      });
    }
  }, [id]);

  const onSave = async () => {
    if (!name.trim() || !company) {
      Alert.alert('Required', `${partyType === 'supplier' ? 'Supplier' : 'Client'} name is required`);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        group: group.trim() || null,
        address: address.trim() || null,
        type: partyType,
      };

      if (id) {
        await db.updateClient(id, payload);
      } else {
        await db.createClient({ ...payload, companyId: company.id });
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert('Delete client?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await db.deleteClient(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll style={{ paddingTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
          <Button
            title="Client"
            variant={partyType === 'client' ? 'primary' : 'outline'}
            onPress={() => setPartyType('client')}
            style={{ flex: 1 }}
          />
          <Button
            title="Supplier"
            variant={partyType === 'supplier' ? 'primary' : 'outline'}
            onPress={() => setPartyType('supplier')}
            style={{ flex: 1 }}
          />
        </View>
        <Input label="Name *" value={name} onChangeText={setName} placeholder={partyType === 'supplier' ? 'Supplier / Vendor name' : 'Client / Customer name'} />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 ..." keyboardType="phone-pad" />
        <Input label="Group" value={group} onChangeText={setGroup} placeholder="Retail / Wholesale / VIP" />
        <Input label="Address" value={address} onChangeText={setAddress} placeholder={partyType === 'supplier' ? 'Supplier address' : 'Billing address'} multiline />
        <Button title={id ? `Update ${partyType === 'supplier' ? 'Supplier' : 'Client'}` : `Add ${partyType === 'supplier' ? 'Supplier' : 'Client'}`} onPress={onSave} loading={loading} style={{ marginTop: spacing.md }} />
        {id && (
          <Button title="Delete" variant="danger" onPress={onDelete} style={{ marginTop: spacing.md }} />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
