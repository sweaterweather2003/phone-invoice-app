import React from 'react';
import { Image, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../hooks/useCompany';
import { colors } from '../theme';

export function AppHeaderTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.title}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="cover" />
      <Text numberOfLines={1} style={styles.titleText}>
        {children}
      </Text>
    </View>
  );
}

export function AppHeaderSettingsButton() {
  const router = useRouter();
  const { company } = useCompany();

  const openSettings = () => {
    if (company) {
      router.push({ pathname: '/company-create', params: { id: company.id } });
    } else {
      router.push('/company-create');
    }
  };

  return (
    <TouchableOpacity
      onPress={openSettings}
      style={styles.settingsButton}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Company settings"
    >
      <Ionicons name="settings-outline" size={21} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 25, height: 25, borderRadius: 5 },
  titleText: { color: colors.text, fontSize: 17, fontWeight: '700', marginLeft: 8 },
  settingsButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});