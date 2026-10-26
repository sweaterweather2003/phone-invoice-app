import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../src/hooks/useCompany';
import { Screen, Card, Button, EmptyState } from '../src/components/ui';
import { colors, spacing, radius, typography } from '../src/theme';

export default function CompanySelectScreen() {
  const { companies, company, setActiveCompany } = useCompany();
  const router = useRouter();

  return (
    <Screen scroll style={{ paddingTop: spacing.lg }}>
      <Text style={styles.title}>Select Workspace</Text>
      <Text style={styles.subtitle}>Switch between your brands and companies</Text>

      {!companies.length ? (
        <EmptyState
          icon="briefcase-outline"
          title="No Brands Yet"
          subtitle="Create your first brand to get started"
          actionLabel="Create Brand"
          onAction={() => router.push('/company-create')}
        />
      ) : (
        <>
          {companies.map((c) => {
            const active = c.id === company?.id;
            const cardStyle = active ? { ...styles.card, ...styles.cardActive } : styles.card;
            return (
              <Card
                key={c.id}
                style={cardStyle}
                onPress={async () => {
                  await setActiveCompany(c.id);
                  router.back();
                }}
              >
                <View style={styles.row}>
                  {c.logo ? (
                    <Image source={{ uri: c.logo }} style={styles.logoImage} resizeMode="contain" />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: c.brandColor || colors.primary }]}>
                      <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{c.name}</Text>
                    {c.tagline ? <Text style={styles.tagline}>{c.tagline}</Text> : null}
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={24} color={colors.success} />}
                </View>
              </Card>
            );
          })}

          <Button
            title="Create New Brand"
            icon="add"
            onPress={() => router.push('/company-create')}
            style={{ marginTop: spacing.xl }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, marginTop: 4 },
  card: { marginBottom: spacing.md },
  cardActive: { borderColor: colors.accent, borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 72,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  name: { ...typography.bodyBold, color: colors.text },
  tagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
