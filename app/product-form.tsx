import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import { Screen, Input, Button } from '../src/components/ui';
import { spacing } from '../src/theme';

export default function ProductFormScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id && company) {
      db.getProducts(company.id).then((list) => {
        const p = list.find((x) => x.id === id);
        if (p) {
          setName(p.name);
          setPrice(String(p.price));
          setStock(String(p.stock));
          setSku(p.sku || '');
          setLeadTime(p.leadTime || '');
          setImageUrl(p.imageUrl || '');
        }
      });
    }
  }, [id, company]);

  const onSave = async () => {
    if (!name.trim() || !company) {
      Alert.alert('Required', 'Product name is required');
      return;
    }
    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        price: parseFloat(price) || 0,
        stock: parseInt(stock, 10) || 0,
        sku: sku.trim() || null,
        leadTime: leadTime.trim() || null,
        imageUrl: imageUrl.trim() || null,
      };
      if (id) {
        await db.updateProduct(id, data);
      } else {
        await db.createProduct({ ...data, companyId: company.id });
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
    Alert.alert('Delete product?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await db.deleteProduct(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll style={{ paddingTop: spacing.lg }}>
        <Input label="Product Name *" value={name} onChangeText={setName} placeholder="e.g. Hydrating Silk Cleanser" />
        <Input label="Price (₹) *" value={price} onChangeText={setPrice} placeholder="1250" keyboardType="decimal-pad" />
        <Input label="Stock Quantity *" value={stock} onChangeText={setStock} placeholder="100" keyboardType="numeric" />
        <Input label="SKU" value={sku} onChangeText={setSku} placeholder="HSC-001" />
        <Input label="Lead Time" value={leadTime} onChangeText={setLeadTime} placeholder="3-5 Days" />
        <Input label="Product Image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="https://example.com/image.jpg" />
        <Button title={id ? 'Update Product' : 'Add Product'} onPress={onSave} loading={loading} style={{ marginTop: spacing.md }} />
        {id && <Button title="Delete" variant="danger" onPress={onDelete} style={{ marginTop: spacing.md }} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
