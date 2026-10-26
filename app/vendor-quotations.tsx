import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import type { Document } from '../src/types';
import { Screen, Card, Button, EmptyState, Badge } from '../src/components/ui';
import { colors, spacing, radius, typography } from '../src/theme';
import { formatCurrency, formatShortDate } from '../src/utils/format';

export default function VendorQuotationsScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound');
  const [quotes, setQuotes] = useState<Document[]>([]);
  const [inboundQuotes, setInboundQuotes] = useState<Document[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Document | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    const docs = await db.getDocuments(company.id);
    const outboundQuotes = docs.filter((d) => d.type === 'quote');
    const pendingInbound = docs.filter(
      (d) => d.type === 'inbound_document' || (d.type !== 'quote' && d.status === 'waiting_for_approval')
    );
    setQuotes(outboundQuotes);
    setInboundQuotes(pendingInbound);
  }, [company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openReview = (quote: Document) => {
    setSelectedQuote(quote);
    setReviewModalVisible(true);
  };

  const approveQuote = async () => {
    if (!selectedQuote) return;
    try {
      await db.updateDocument(selectedQuote.id, { status: 'accepted' });
      Alert.alert('✅ Success', 'Vendor quote approved and saved to ledger');
      setReviewModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to approve vendor quote');
    }
  };

  const markAsDraft = async () => {
    if (!selectedQuote) return;
    try {
      await db.updateDocument(selectedQuote.id, { status: 'draft' });
      Alert.alert('Draft saved', 'This vendor quote is now waiting to be sent later.');
      setReviewModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to move vendor quote back to draft');
    }
  };

  const deleteQuote = async (quoteId: string) => {
    Alert.alert('Delete vendor quote', 'Are you sure?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await db.deleteDocument(quoteId);
            await load();
          } catch (error) {
            Alert.alert('❌ Error', 'Failed to delete vendor quote');
          }
        },
      },
    ]);
  };

  const displayQuotes = activeTab === 'inbound' ? inboundQuotes : quotes;
  const createButtonLabel = activeTab === 'inbound' ? 'Upload file' : 'New quote';
  const createButtonAction = () =>
    router.push({ pathname: '/document-form', params: { type: activeTab === 'inbound' ? 'inbound_document' : 'quote' } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Vendor Quotations</Text>
            <Text style={styles.subtitle}>Manage supplier offers</Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={createButtonAction}>
            <Ionicons name="add" size={20} color={colors.textInverse} />
            <Text style={styles.createBtnText}>{createButtonLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'inbound' && styles.tabActive]}
            onPress={() => setActiveTab('inbound')}
          >
            <Ionicons
              name="download-outline"
              size={16}
              color={activeTab === 'inbound' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'inbound' && styles.tabTextActive]}>
              Inbound
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'outbound' && styles.tabActive]}
            onPress={() => setActiveTab('outbound')}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={16}
              color={activeTab === 'outbound' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'outbound' && styles.tabTextActive]}>
              Outbound
            </Text>
          </TouchableOpacity>
        </View>

        {displayQuotes.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={activeTab === 'inbound' ? 'No inbound vendor quotes' : 'No outbound quotes'}
            subtitle={
              activeTab === 'inbound'
                ? 'Upload supplier quote files like PDFs, Word, Excel, or CSV for review before approval.'
                : 'Create or send vendor quotations to suppliers.'
            }
            actionLabel={activeTab === 'inbound' ? 'Upload file' : 'Create quote'}
            onAction={createButtonAction}
          />
        ) : (
          displayQuotes.map((quote) => (
            <Card key={quote.id} style={styles.quoteCard} onPress={() => openReview(quote)}>
              <View style={styles.quoteRow}>
                <View style={styles.quoteIcon}>
                  <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quoteNumber}>{quote.number}</Text>
                  <Text style={styles.quoteVendor}>{quote.sourceName || quote.clientName || 'Vendor quote'}</Text>
                </View>
                <View style={styles.quoteRight}>
                  <Text style={styles.quoteAmount}>{quote.type === 'inbound_document' ? 'File' : formatCurrency(quote.total)}</Text>
                  <Badge
                    label={quote.status === 'waiting_for_approval' ? 'Waiting for approval' : quote.type === 'inbound_document' ? 'Inbound' : quote.status}
                    color={
                      quote.status === 'accepted'
                        ? colors.success
                        : quote.status === 'draft'
                          ? colors.textSecondary
                          : colors.accent
                    }
                    softColor={
                      quote.status === 'accepted'
                        ? colors.successSoft
                        : quote.status === 'draft'
                          ? colors.surfaceAlt
                          : colors.accentSoft
                    }
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </Screen>

      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Quote</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedQuote && (
                <>
                  <View style={styles.detailsRow}>
                    <View>
                      <Text style={styles.detailLabel}>Quote Number</Text>
                      <Text style={styles.detailValue}>{selectedQuote.number}</Text>
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>Status</Text>
                      <Badge
                        label={
                          selectedQuote.status === 'waiting_for_approval'
                            ? 'Waiting for approval'
                            : selectedQuote.status
                        }
                        color={
                          selectedQuote.status === 'accepted'
                            ? colors.success
                            : selectedQuote.status === 'draft'
                              ? colors.textSecondary
                              : colors.accent
                        }
                        softColor={
                          selectedQuote.status === 'accepted'
                            ? colors.successSoft
                            : selectedQuote.status === 'draft'
                              ? colors.surfaceAlt
                              : colors.accentSoft
                        }
                      />
                    </View>
                  </View>

                  <Text style={styles.detailLabel}>Supplier / Vendor</Text>
                  <Text style={styles.detailValue}>{selectedQuote.clientName || selectedQuote.sourceName || 'Vendor'}</Text>

                  <Text style={[styles.detailLabel, { marginTop: spacing.lg }]}>Items</Text>
                  {selectedQuote.items?.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                      </View>
                      <Text style={styles.itemAmount}>{formatCurrency(item.qty * item.price)}</Text>
                    </View>
                  ))}

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>{formatCurrency(selectedQuote.total)}</Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {selectedQuote?.status === 'waiting_for_approval' && (
                <Button
                  title="Send later"
                  variant="outline"
                  onPress={markAsDraft}
                  style={{ marginBottom: spacing.sm }}
                />
              )}
              <Button
                title="Delete"
                variant="danger"
                onPress={() => {
                  if (selectedQuote) deleteQuote(selectedQuote.id);
                  setReviewModalVisible(false);
                }}
              />
              <Button
                title={selectedQuote?.status === 'accepted' ? 'Approved' : 'Approve'}
                onPress={approveQuote}
                disabled={selectedQuote?.status === 'accepted'}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  createBtnText: { ...typography.label, color: colors.textInverse, fontWeight: '600' },
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: { ...typography.label, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  quoteCard: { marginBottom: spacing.md },
  quoteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quoteIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteNumber: { ...typography.bodyBold, color: colors.text },
  quoteVendor: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  quoteRight: { alignItems: 'flex-end' },
  quoteAmount: { ...typography.bodyBold, color: colors.primary },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingTop: spacing.lg,
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
  modalTitle: { ...typography.h3, color: colors.text },
  modalBody: { flex: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  detailLabel: { ...typography.label, color: colors.text, fontWeight: '600', marginTop: spacing.md },
  detailValue: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { ...typography.bodyBold, color: colors.text },
  itemQty: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  itemAmount: { ...typography.bodyBold, color: colors.primary, minWidth: 80, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  totalLabel: { ...typography.h3, color: colors.text },
  totalAmount: { ...typography.h3, color: colors.primary },
});
