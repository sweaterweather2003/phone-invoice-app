import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { CompanyProvider } from '../src/hooks/useCompany';
import { colors } from '../src/theme';

function RootLayoutContent() {
  const { loading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      const destination = user ? '/(tabs)' : '/login';
      router.replace(destination);
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="company-select" options={{ title: 'Workspaces', presentation: 'modal' }} />
        <Stack.Screen name="company-create" options={{ title: 'New Brand', presentation: 'modal' }} />
        <Stack.Screen name="client-form" options={{ title: 'Buyer / Vendor', presentation: 'modal' }} />
        <Stack.Screen name="product-form" options={{ title: 'Product', presentation: 'modal' }} />
        <Stack.Screen name="expense-form" options={{ title: 'Expense', presentation: 'modal' }} />
        <Stack.Screen name="document-form" options={{ title: 'New Document', presentation: 'modal' }} />
        <Stack.Screen name="document-detail" options={{ title: 'Document' }} />
        <Stack.Screen name="recurring-form" options={{ title: 'Recurring', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CompanyProvider>
          <RootLayoutContent />
        </CompanyProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}