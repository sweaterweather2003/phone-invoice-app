import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import { sendDocumentEmail } from '../src/api/email';
import type { Client, Product, DocumentType } from '../src/types';
import { Input, Button, Card } from '../src/components/ui';
import { colors, spacing, radius, typography } from '../src/theme';
import { formatCurrency, DOC_TYPE_LABELS } from '../src/utils/format';

interface ItemRow {
  name: string;
  qty: string;
  price: string;
}

const INBOUND_FILE_TYPES = ['pdf', 'word', 'excel', 'csv', 'other'] as const;

export default function DocumentFormScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const [docType, setDocType] = useState<DocumentType>((typeParam as DocumentType) || 'invoice');
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ name: '', qty: '1', price: '' }]);
  const [taxRate, setTaxRate] = useState('18');
  const [notes, setNotes] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'pdf' | 'word' | 'excel' | 'csv' | 'other'>('pdf');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!company) return;

    const fetchData = async () => {
      const [clientList, supplierList, productList] = await Promise.all([
        db.getClients(company.id),
        db.getSuppliers(company.id),
        db.getProducts(company.id),
      ]);

      setProducts(productList);
      setClients(docType === 'purchase_order' ? supplierList : clientList);
    };

    fetchData();
  }, [company, docType]);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0);
  const taxAmount = subtotal * ((parseFloat(taxRate) || 0) / 100);
  const total = subtotal + taxAmount;

  const addItem = () => setItems([...items, { name: '', qty: '1', price: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  };

  const pickProduct = (idx: number, p: Product) => {
    const next = [...items];
    next[idx] = { name: p.name, qty: '1', price: String(p.price) };
    setItems(next);
  };

  const selectedClient = clients.find((c) => c.id === clientId);

  const pickInboundFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
          'application/csv',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const file = result.assets[0];
      const mime = file.mimeType || '';
      const lowerName = (file.name || '').toLowerCase();
      let detectedType: 'pdf' | 'word' | 'excel' | 'csv' | 'other' = 'other';

      if (mime.includes('pdf') || lowerName.endsWith('.pdf')) detectedType = 'pdf';
      else if (mime.includes('word') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) detectedType = 'word';
      else if (mime.includes('excel') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) detectedType = 'excel';
      else if (mime.includes('csv') || lowerName.endsWith('.csv')) detectedType = 'csv';

      setSourceName(file.name || 'uploaded-file');
      setSourceUri(file.uri || null);
      setSourceType(detectedType);
    } catch (error) {
      Alert.alert('Upload error', 'Unable to pick the file. Please try again.');
    }
  };

  const onSave = async () => {
    if (!company) {
      Alert.alert('Required', 'Company is required');
      return;
    }

    if (docType === 'inbound_document') {
      if (!sourceName.trim()) {
        Alert.alert('Required', 'Please enter the uploaded file name');
        return;
      }

      setLoading(true);
      try {
        await db.createDocument({
          type: 'inbound_document',
          total: 0,
          subtotal: 0,
          taxRate: 0,
          taxAmount: 0,
          status: 'waiting_for_approval',
          notes: notes.trim() || `Received ${sourceName.trim()} (${sourceType.toUpperCase()})`,
          dueDate: null,
          companyId: company.id,
          clientId: clientId || 'inbound',
          sourceName: sourceName.trim(),
          sourceUri: sourceUri || null,
          sourceType,
          items: [],
        });
        router.back();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to save inbound document');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!clientId) {
      Alert.alert('Required', `Please select a ${docType === 'purchase_order' ? 'vendor' : 'buyer'}`);
      return;
    }
    const validItems = items.filter((i) => i.name.trim() && (parseFloat(i.qty) || 0) > 0);
    if (!validItems.length) {
      Alert.alert('Required', 'Add at least one line item');
      return;
    }
    setLoading(true);
    try {
      await db.createDocument({
        type: docType,
        total,
        subtotal,
        taxRate: parseFloat(taxRate) || 0,
        taxAmount,
        status: 'draft' as const,
        notes: notes.trim() || null,
        dueDate: null,
        companyId: company.id,
        clientId,
        items: validItems.map((i) => ({
          name: i.name.trim(),
          qty: parseInt(i.qty, 10) || 1,
          price: parseFloat(i.price) || 0,
        })),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create document');
    } finally {
        setLoading(false);
    }
  };

  const onSaveAndSendEmail = async () => {
    if (!company || !clientId) {
      Alert.alert('Required', `Please select a ${docType === 'purchase_order' ? 'vendor' : 'buyer'}`);
      return;
    }
    if (!selectedClient?.email) {
      Alert.alert('Error', `Selected ${docType === 'purchase_order' ? 'vendor' : 'buyer'} does not have an email address`);
      return;
    }
    const validItems = items.filter((i) => i.name.trim() && (parseFloat(i.qty) || 0) > 0);
    if (!validItems.length) {
      Alert.alert('Required', 'Add at least one line item');
      return;
    }

    setSending(true);
    let documentSaved = false;
    try {
      const doc = await db.createDocument({
        type: docType,
        total,
        subtotal,
        taxRate: parseFloat(taxRate) || 0,
        taxAmount,
        status: 'draft',
        notes: notes.trim() || null,
        dueDate: null,
        companyId: company.id,
        clientId,
        items: validItems.map((i) => ({
          name: i.name.trim(),
          qty: parseInt(i.qty, 10) || 1,
          price: parseFloat(i.price) || 0,
        })),
      });
      documentSaved = true;
      await sendDocumentEmail(doc.id);

      Alert.alert('Email sent', `Document sent to ${selectedClient.email}`);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert(
        documentSaved ? 'Document saved; email not sent' : 'Could not create document',
        documentSaved ? `${message} You can retry sending from the document details.` : message
      );
    } finally {
      setSending(false);
    }
  };
  const types: DocumentType[] = ['invoice', 'proforma', 'credit_note', 'debit_note', 'rfq', 'quote', 'purchase_order'];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Document type */}
        <Text style={styles.label}>DOCUMENT TYPE</Text>
        <View style={styles.typeRow}>
          {types.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setDocType(t)}
              style={[styles.typeChip, docType === t && styles.typeChipActive]}
            >
              <Text style={[styles.typeChipText, docType === t && styles.typeChipTextActive]}>
                {DOC_TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {docType !== 'inbound_document' && (
          <>
            <Text style={styles.label}>{docType === 'purchase_order' ? 'VENDOR *' : 'BUYER *'}</Text>
            <View style={styles.clientList}>
              {clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setClientId(c.id)}
                  style={[styles.clientChip, clientId === c.id && styles.clientChipActive]}
                >
                  <Text style={[styles.clientChipText, clientId === c.id && { color: '#fff' }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
              {!clients.length && (
                <Text style={styles.hint}>{docType === 'purchase_order' ? 'No vendors — add one from the Buyers & Vendors page first' : 'No buyers — add one from the Buyers & Vendors page first'}</Text>
              )}
            </View>
          </>
        )}

        {docType === 'inbound_document' && (
          <>
            <Text style={styles.label}>FILE *</Text>
            <Button
              title={sourceName ? `Selected: ${sourceName}` : 'Choose file'}
              variant="outline"
              icon="document-outline"
              onPress={pickInboundFile}
              style={{ marginBottom: spacing.md }}
            />
            <Input
              label="Document name"
              value={sourceName}
              onChangeText={setSourceName}
              placeholder="e.g. supplier-invoice-2026.pdf"
            />
            <Text style={[styles.label, { marginTop: spacing.md }]}>FILE TYPE</Text>
            <View style={styles.typeRow}>
              {INBOUND_FILE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setSourceType(type)}
                  style={[styles.typeChip, sourceType === type && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, sourceType === type && styles.typeChipTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {docType !== 'inbound_document' && (
          <>
            {/* Line items */}
            <Text style={[styles.label, { marginTop: spacing.xl }]}>LINE ITEMS</Text>
            {items.map((item, idx) => (
              <Card key={idx} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNum}>#{idx + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(idx)}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                <Input
                  label="Item name"
                  value={item.name}
                  onChangeText={(v) => updateItem(idx, 'name', v)}
                  placeholder="Product or service"
                />
                {products.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                    {products.slice(0, 8).map((p) => (
                      <TouchableOpacity key={p.id} onPress={() => pickProduct(idx, p)} style={styles.prodChip}>
                        <Text style={styles.prodChipText}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Input label="Qty" value={item.qty} onChangeText={(v) => updateItem(idx, 'qty', v)} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Input label="Price (₹)" value={item.price} onChangeText={(v) => updateItem(idx, 'price', v)} keyboardType="decimal-pad" />
                  </View>
                </View>
              </Card>
            ))}
            <Button title="Add Line Item" variant="outline" icon="add" onPress={addItem} style={{ marginBottom: spacing.xl }} />

            <Input label="Tax Rate (%)" value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" />
            <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes..." multiline />

            <Card style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalVal}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalVal}>{formatCurrency(taxAmount)}</Text>
              </View>
              <View style={[styles.totalRow, { marginTop: 8 }]}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandVal}>{formatCurrency(total)}</Text>
              </View>
            </Card>

            <Button title={`Create ${DOC_TYPE_LABELS[docType]}`} onPress={onSave} loading={loading} style={{ marginTop: spacing.lg }} />

            {selectedClient?.email && (
              <Button
                title={`Save & Send to ${selectedClient.email}`}
                onPress={onSaveAndSendEmail}
                loading={sending}
                variant="outline"
                icon="mail"
                style={{ marginTop: spacing.md }}
              />
            )}
          </>
        )}

        {docType === 'inbound_document' && (
          <>
            <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes..." multiline />
            <Button title="Save inbound file" onPress={onSave} loading={loading} style={{ marginTop: spacing.lg }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.xl },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  typeChipTextActive: { color: '#fff' },
  clientList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clientChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  clientChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  clientChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  itemCard: { marginBottom: spacing.md },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  itemNum: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  row2: { flexDirection: 'row' },
  prodChip: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginRight: 8,
  },
  prodChipText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  totals: { marginTop: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { ...typography.body, color: colors.textSecondary },
  totalVal: { ...typography.body, color: colors.text },
  grandLabel: { ...typography.h3, color: colors.text },
  grandVal: { ...typography.h3, color: colors.primary },
});
