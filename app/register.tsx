import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { Input, Button } from '../src/components/ui';
import { colors, spacing, typography, radius } from '../src/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!companyName.trim() || !email.trim() || !password) {
      Alert.alert('Required', 'Brand name, email and password are required');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, companyName);
      router.replace('/(tabs)');
    } catch (e: any) {
      const message =
        e?.code === 'auth/operation-not-allowed'
          ? 'Email/password registration is disabled. Enable the Email/Password provider in Firebase Console under Authentication > Sign-in method.'
          : e?.code === 'permission-denied' || e?.code === 'firestore/permission-denied'
            ? 'Firestore denied the profile write. Publish firestore.rules to the financeinvoicing-d2489 project and try again.'
          : e.message || 'Could not create account';
      Alert.alert('Registration failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Create workspace</Text>
          <Text style={styles.subtitle}>
            Register your brand and account — same as the website pipeline
          </Text>

          <Input
            label="Brand / Company name *"
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="e.g. Kerabeaute"
          />
          <Input
            label="Work email *"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
          />
          <Input
            label="Password *"
            value={password}
            onChangeText={setPassword}
            placeholder="Min 6 characters"
            secureTextEntry
          />

          <Button
            title="Register Corporate Brand"
            onPress={onRegister}
            loading={loading}
            style={{ marginTop: spacing.md }}
          />

          <TouchableOpacity onPress={() => router.back()} style={styles.linkWrap}>
            <Text style={styles.link}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    marginTop: 4,
  },
  linkWrap: { marginTop: spacing.xl, alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
});