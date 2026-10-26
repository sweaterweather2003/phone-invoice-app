import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import { Screen, Input, Button } from '../src/components/ui';
import { colors, spacing } from '../src/theme';

export default function CompanyCreateScreen() {
  const { createCompany } = useCompany();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof id === 'string' && id ? id : null;
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [logo, setLogo] = useState('');
  const [brandColor, setBrandColor] = useState('#0F172A');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editingId) {
      setName('');
      setTagline('');
      setEmail('');
      setPhone('');
      setLogo('');
      setBrandColor('#0F172A');
      return;
    }

    db.getCompany(editingId).then((c) => {
      if (!c) return;
      setName(c.name || '');
      setTagline(c.tagline || '');
      setEmail(c.email || '');
      setPhone(c.phone || '');
      setLogo(c.logo || '');
      setBrandColor(c.brandColor || '#0F172A');
    });
  }, [editingId]);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Brand name is required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        tagline: tagline.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        logo: logo.trim() || null,
        brandColor: brandColor || '#0F172A',
      };

      if (editingId) {
        await db.updateCompany(editingId, payload);
      } else {
        await createCompany(payload);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save brand');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll style={{ paddingTop: spacing.lg }}>
        <Input label="Brand / Company Name *" value={name} onChangeText={setName} placeholder="e.g. Kerabeaute" />
        <Input label="Tagline" value={tagline} onChangeText={setTagline} placeholder="e.g. Art of Flawless Haircare" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="hello@company.com" keyboardType="email-address" />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 ..." keyboardType="phone-pad" />
        <Input label="Brand Logo URL" value={logo} onChangeText={setLogo} placeholder="https://example.com/logo.png" />
        <Input label="Brand Accent Color" value={brandColor} onChangeText={setBrandColor} placeholder="#0F172A" />
        <Button title={editingId ? 'Save Brand' : 'Create Brand'} onPress={onSave} loading={loading} style={{ marginTop: spacing.md }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
