import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, TextInput, ActivityIndicator, Modal, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../../src/hooks/useCompany';
import * as db from '../../src/db/firebaseDb';
import type { Product } from '../../src/types';
import { Screen, Card, EmptyState, FAB, Badge, Button } from '../../src/components/ui';
import { colors, spacing, radius, typography } from '../../src/theme';
import { formatCurrency } from '../../src/utils/format';
import { generateId } from '../../src/utils/id';

export default function ProductsScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'url' | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!company) return;
    setProducts(await db.getProducts(company.id));
  }, [company]);

  const outOfStockProducts = products.filter((p) => p.stock <= 0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const importFromURL = async () => {
    if (!urlInput.trim() || !company) return;
    setIsImporting(true);
    try {
      let url = urlInput.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      const baseUrl = new URL(url).origin;
      const apiUrl = `${baseUrl}/wp-json/wc/store/v1/products?per_page=100`;

      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Store API not available');

      const data = await response.json();
      const items = Array.isArray(data) ? data : data.products || [];

      if (items.length === 0) throw new Error('No products found');

      let importedCount = 0;
      for (const item of items) {
        let price = 0;
        if (item.prices?.price) {
          price = parseFloat(item.prices.price) / (item.prices.currency_minor_unit === 2 ? 100 : 1);
        } else if (item.variants?.[0]?.price) {
          price = parseFloat(item.variants[0].price);
        }

        const imageUrl = item.images?.[0]?.src || item.image?.src || item.images?.[0]?.thumbnail || null;

        await db.createProduct({
          name: item.name || item.title || 'Unnamed Product',
          price: price || 0,
          stock: item.is_in_stock !== false ? 25 : 0,
          leadTime: '3-5 Days',
          sku: item.sku || '',
          imageUrl,
          companyId: company.id,
        });
        importedCount++;
      }

      Alert.alert('✅ Success', `Imported ${importedCount} products from ${baseUrl}`);
      setUrlInput('');
      setImportMode(null);
      setImportModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('❌ Import Failed', error instanceof Error ? error.message : 'Could not connect to store. Make sure it\'s a WooCommerce store.');
    } finally {
      setIsImporting(false);
    }
  };

  const importFromCSV = async (csvText: string) => {
    if (!company) return;
    setIsImporting(true);
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) throw new Error('CSV must have header row and at least one product');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('product'));
      const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate'));
      const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('quantity'));
      const skuIdx = headers.findIndex(h => h.includes('sku'));
      const leadIdx = headers.findIndex(h => h.includes('lead'));

      if (nameIdx === -1 || priceIdx === -1) throw new Error('CSV must have Name and Price columns');

      let importedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(c => c.trim());
        await db.createProduct({
          name: cols[nameIdx] || 'Product',
          price: parseFloat(cols[priceIdx]) || 0,
          stock: stockIdx >= 0 ? parseInt(cols[stockIdx]) || 0 : 10,
          leadTime: leadIdx >= 0 ? cols[leadIdx] : '3-5 Days',
          sku: skuIdx >= 0 ? cols[skuIdx] : '',
          companyId: company.id,
        });
        importedCount++;
      }

      Alert.alert('✅ Success', `Imported ${importedCount} products from CSV`);
      setImportMode(null);
      setImportModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('❌ Import Failed', error instanceof Error ? error.message : 'Could not parse CSV file');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll style={{ paddingTop: spacing.md }}>
        {outOfStockProducts.length > 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.warningText}>
              {outOfStockProducts.length === 1
                ? `${outOfStockProducts[0].name} is out of stock.`
                : `${outOfStockProducts.length} products are out of stock.`}
            </Text>
          </View>
        )}

        {/* Import Section */}
        <View style={styles.importSection}>
          <Text style={styles.importTitle}>📥 Import Products</Text>
          <View style={styles.importButtons}>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: colors.accentSoft }]}
              onPress={() => {
                setImportMode('url');
                setImportModalVisible(true);
              }}
            >
              <Ionicons name="globe-outline" size={20} color={colors.accent} />
              <Text style={[styles.importBtnText, { color: colors.accent }]}>From URL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: colors.successSoft }]}
              onPress={() => setImportMode('file')}
            >
              <Ionicons name="document-outline" size={20} color={colors.success} />
              <Text style={[styles.importBtnText, { color: colors.success }]}>From CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Products List */}
        {!products.length ? (
          <EmptyState
            icon="cube-outline"
            title="No products"
            subtitle="Add SKUs to your inventory catalog"
            actionLabel="Add Product"
            onAction={() => router.push('/product-form')}
          />
        ) : (
          products.map((p) => (
            <Card
              key={p.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/product-form', params: { id: p.id } })}
            >
              <View style={styles.row}>
                {p.imageUrl ? (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setPreviewImageUrl(p.imageUrl || null)}>
                    <Image source={{ uri: p.imageUrl }} style={styles.productImage} resizeMode="cover" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.iconBox}>
                    <Ionicons name="cube" size={22} color={colors.accent} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  {p.sku ? <Text style={styles.sku}>SKU: {p.sku}</Text> : null}
                  <View style={styles.bottom}>
                    <Text style={styles.price}>{formatCurrency(p.price)}</Text>
                    <Badge
                      label={p.stock > 0 ? `Stock: ${p.stock}` : 'Out of stock'}
                      color={p.stock > 0 ? colors.success : colors.danger}
                      softColor={p.stock > 0 ? colors.successSoft : colors.dangerSoft}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          ))
        )}
      </Screen>

      {/* URL Import Modal */}
      <Modal
        visible={importModalVisible && importMode === 'url'}
        transparent
        animationType="fade"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import from Store URL</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Enter WooCommerce Store URL</Text>
              <TextInput
                style={styles.urlInput}
                placeholder="e.g., https://tanttu.in or wilrichmyer.com"
                value={urlInput}
                onChangeText={setUrlInput}
                editable={!isImporting}
              />
              <Text style={styles.helpText}>We'll automatically fetch products from the store's WooCommerce API.</Text>
            </View>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setImportModalVisible(false)}
                disabled={isImporting}
              />
              <Button
                title={isImporting ? 'Importing...' : 'Import Products'}
                loading={isImporting}
                onPress={importFromURL}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseButton}
            onPress={() => setPreviewImageUrl(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={30} color={colors.background} />
          </TouchableOpacity>
          {previewImageUrl ? (
            <Image source={{ uri: previewImageUrl }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        visible={importModalVisible && importMode === 'file'}
        transparent
        animationType="fade"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import from CSV</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>CSV Format Required:</Text>
              <Text style={styles.csvExample}>Name, Price, Stock, SKU, Lead Time{'\n'}Product A, 100, 50, SKU001, 3-5 Days{'\n'}Product B, 200, 30, SKU002, 5-7 Days</Text>
              
              <TouchableOpacity
                style={styles.csvInputBtn}
                onPress={() => {
                  // For now, show a prompt for pasting CSV
                  Alert.prompt(
                    'Paste CSV Content',
                    'Paste your CSV content (Name, Price, Stock columns required)',
                    [
                      { text: 'Cancel', onPress: () => {} },
                      {
                        text: 'Import',
                        onPress: (text?: string) => {
                          if (text?.trim()) {
                            importFromCSV(text);
                          }
                        },
                      },
                    ],
                    'plain-text',
                    '',
                    'default'
                  );
                }}
              >
                <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
                <Text style={styles.csvInputBtnText}>Paste CSV Content</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <Button
                title="Close"
                variant="outline"
                onPress={() => setImportModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      <FAB onPress={() => router.push('/product-form')} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.accentSoft,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  previewImage: {
    width: '100%',
    height: '80%',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 1,
  },
  name: { ...typography.bodyBold, color: colors.text },
  sku: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  price: { ...typography.bodyBold, color: colors.primary },

  // Warning banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  warningText: {
    ...typography.bodyBold,
    color: colors.danger,
    flex: 1,
  },

  // Import Section
  importSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  importTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  importButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  importBtnText: {
    ...typography.label,
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  urlInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 14,
    color: colors.text,
  },
  helpText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  csvExample: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  csvInputBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  csvInputBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
