import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import { Screen, Input, Button } from '../src/components/ui';
import { colors, radius, spacing, typography } from '../src/theme';

const CLOUDINARY_CLOUD_NAME = 'dvesaoteu';
const CLOUDINARY_UPLOAD_PRESET = 'invoicing-app';

async function uploadLogoToCloudinary(base64: string, contentType: string) {
  const formData = new FormData();
  formData.append('file', `data:${contentType};base64,${base64}`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );
  const result = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Logo upload failed. Please try again.');
  }

  return result.secure_url;
}

export default function CompanyCreateScreen() {
  const { createCompany, refresh } = useCompany();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof id === 'string' && id ? id : null;
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [tagline, setTagline] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [logo, setLogo] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoContentType, setLogoContentType] = useState('image/jpeg');
  const [sharedLogo, setSharedLogo] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState('#0F172A');
  const [loading, setLoading] = useState(false);
  const shouldLookupSharedLogo = !editingId || !logo;

  useEffect(() => {
    if (!editingId) {
      setName('');
      setOriginalName('');
      setTagline('');
      setEmail('');
      setPhone('');
      setLogo('');
      setLogoBase64(null);
      setBrandColor('#0F172A');
      setSharedLogo(null);
      return;
    }

    db.getCompany(editingId).then((c) => {
      if (!c) return;
      setName(c.name || '');
      setOriginalName(c.name || '');
      setTagline(c.tagline || '');
      setEmail(c.email || '');
      setPhone(c.phone || '');
      setLogo(c.logo || '');
      setLogoBase64(null);
      setBrandColor(c.brandColor || '#0F172A');
    });
  }, [editingId]);

  useEffect(() => {
    if (!shouldLookupSharedLogo || !name.trim()) {
      setSharedLogo(null);
      return;
    }

    setSharedLogo(null);
    let active = true;
    const timeout = setTimeout(() => {
      db.getSharedBrandLogo(name).then((logoUrl) => {
        if (active) setSharedLogo(logoUrl);
      }).catch(() => {
        if (active) setSharedLogo(null);
      });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [name, shouldLookupSharedLogo]);

  const chooseLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Could not use image', 'Please choose a different image and try again.');
      return;
    }
    setLogo(asset.uri);
    setLogoBase64(asset.base64);
    setLogoContentType(asset.mimeType || 'image/jpeg');
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Brand name is required');
      return;
    }
    setLoading(true);
    try {
      const logoUrl = logoBase64
        ? await uploadLogoToCloudinary(logoBase64, logoContentType)
        : logo.trim() || null;

      const payload = {
        name: name.trim(),
        tagline: tagline.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        logo: logoUrl,
        brandColor: brandColor || '#0F172A',
      };

      if (editingId) {
        await db.updateCompany(editingId, payload);
        try {
          if (originalName.trim().toLowerCase() !== payload.name.toLowerCase()) {
            await db.syncSharedBrandLogo(originalName, null);
          }
          await db.syncSharedBrandLogo(payload.name, payload.logo);
        } catch (syncError) {
          console.warn('Shared brand logo sync error:', syncError);
        }
        await refresh();
      } else {
        const created = await createCompany(payload);
        try {
          await db.syncSharedBrandLogo(created.name, created.logo || null);
        } catch (syncError) {
          console.warn('Shared brand logo sync error:', syncError);
        }
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
      <Stack.Screen options={{ title: editingId ? 'Company Settings' : 'New Brand' }} />
      <Screen scroll style={{ paddingTop: spacing.lg }}>
        <Input label="Brand / Company Name *" value={name} onChangeText={setName} placeholder="e.g. Kerabeaute" />
        <Input label="Tagline" value={tagline} onChangeText={setTagline} placeholder="e.g. Art of Flawless Haircare" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="hello@company.com" keyboardType="email-address" />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 ..." keyboardType="phone-pad" />
        <View style={styles.logoSection}>
          <Text style={styles.logoLabel}>Company Logo</Text>
          <View style={styles.logoRow}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoPreview} resizeMode="contain" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="image-outline" size={24} color={colors.textMuted} />
              </View>
            )}
            <Button title="Choose from gallery" icon="images-outline" variant="outline" onPress={chooseLogo} />
            {logo ? (
              <TouchableOpacity
                onPress={() => { setLogo(''); setLogoBase64(null); }}
                accessibilityRole="button"
                accessibilityLabel="Remove company logo"
                style={styles.removeLogo}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
          {sharedLogo && logo !== sharedLogo ? (
            <TouchableOpacity
              style={styles.sharedLogoOption}
              onPress={() => { setLogo(sharedLogo); setLogoBase64(null); }}
              accessibilityRole="button"
              accessibilityLabel="Use registered brand logo"
            >
              <Image source={{ uri: sharedLogo }} style={styles.sharedLogoPreview} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sharedLogoTitle}>Registered logo found</Text>
                <Text style={styles.sharedLogoDescription}>Tap to use this brand logo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Input label="Brand Accent Color" value={brandColor} onChangeText={setBrandColor} placeholder="#0F172A" />
        <Button title={editingId ? 'Save Brand' : 'Create Brand'} onPress={onSave} loading={loading} style={{ marginTop: spacing.md }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logoSection: { marginBottom: spacing.lg },
  logoLabel: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoPreview: { width: 84, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  logoPlaceholder: {
    width: 84,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedLogoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  sharedLogoPreview: { width: 56, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  sharedLogoTitle: { ...typography.caption, color: colors.text, fontWeight: '700' },
  sharedLogoDescription: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  removeLogo: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
