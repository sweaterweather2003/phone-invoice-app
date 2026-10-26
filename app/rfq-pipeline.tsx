import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompany } from '../src/hooks/useCompany';
import * as db from '../src/db/firebaseDb';
import type { Document, LineItem, Product } from '../src/types';
import { Screen, Card, Button, EmptyState, Badge } from '../src/components/ui';
import { colors, spacing, radius, typography } from '../src/theme';
import { formatCurrency, formatShortDate } from '../src/utils/format';
import { generateId } from '../src/utils/id';

export default function RFQPipelineScreen() {
  const { company } = useCompany();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound');
  const [rfqs, setRfqs] = useState<Document[]>([]);
  const [inboundDocs, setInboundDocs] = useState<Document[]>([]);
  const [selectedRfq, setSelectedRfq] = useState<Document | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    const docs = await db.getDocuments(company.id);
    const rfqDocs = docs.filter((d) => d.type === 'rfq');
    const pendingInbound = docs.filter(
      (d) => d.type === 'inbound_document' || (d.type !== 'rfq' && d.status === 'waiting_for_approval')
    );
    setRfqs(rfqDocs);
    setInboundDocs(pendingInbound);
  }, [company]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openReview = (rfq: Document) => {
    setSelectedRfq(rfq);
    setReviewModalVisible(true);
  };

  const approveRFQ = async () => {
    if (!selectedRfq) return;
    try {
      await db.updateDocument(selectedRfq.id, {
        status: 'accepted',
      });
      Alert.alert('✅ Success', 'RFQ approved and saved to ledger');
      setReviewModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to approve RFQ');
    }
  };

  const markAsDraft = async () => {
    if (!selectedRfq) return;
    try {
      await db.updateDocument(selectedRfq.id, { status: 'draft' });
      Alert.alert('Draft saved', 'This RFQ is now waiting to be sent later.');
      setReviewModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to move RFQ back to draft');
    }
  };

  const deleteRFQ = async (rfqId: string) => {
    Alert.alert('Delete RFQ', 'Are you sure?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await db.deleteDocument(rfqId);
            await load();
          } catch (error) {
            Alert.alert('❌ Error', 'Failed to delete RFQ');
          }
        },
      },
    ]);
  };

  const displayRfqs = activeTab === 'inbound' ? inboundDocs : rfqs;
  const createButtonLabel = activeTab === 'inbound' ? 'Upload file' : 'New RFQ';
  const createButtonAction = () =>
    router.push({ pathname: '/document-form', params: { type: activeTab === 'inbound' ? 'inbound_document' : 'rfq' } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>RFQ Pipeline</Text>
            <Text style={styles.subtitle}>Manage quotations</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={createButtonAction}
          >
            <Ionicons name="add" size={20} color={colors.textInverse} />
            <Text style={styles.createBtnText}>{createButtonLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
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
            <Text
              style={[styles.tabText, activeTab === 'inbound' && styles.tabTextActive]}
            >
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
            <Text
              style={[styles.tabText, activeTab === 'outbound' && styles.tabTextActive]}
            >
              Outbound
            </Text>
          </TouchableOpacity>
        </View>

        {/* RFQ List */}
        {displayRfqs.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={activeTab === 'inbound' ? 'No inbound approvals' : `No ${activeTab} RFQs`}
            subtitle={
              activeTab === 'inbound'
                ? 'Upload supplier files like PDFs, Word, Excel, or CSV for review before approval.'
                : 'Create or upload quotations to get started.'
            }
            actionLabel={activeTab === 'inbound' ? 'Upload file' : 'Create RFQ'}
            onAction={createButtonAction}
          />
        ) : (
          displayRfqs.map((rfq) => (
            <Card
              key={rfq.id}
              style={styles.rfqCard}
              onPress={() => openReview(rfq)}
            >
              <View style={styles.rfqRow}>
                <View style={styles.rfqIcon}>
                  <Ionicons
                    name="document-text-outline"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rfqNumber}>{rfq.number}</Text>
                  <Text style={styles.rfqVendor}>{rfq.sourceName || rfq.clientName || 'Inbound file'}</Text>
                </View>
                <View style={styles.rfqRight}>
                  <Text style={styles.rfqAmount}>{rfq.type === 'inbound_document' ? 'File' : formatCurrency(rfq.total)}</Text>
                  <Badge
                    label={rfq.status === 'waiting_for_approval' ? 'Waiting for approval' : rfq.type === 'inbound_document' ? 'Inbound' : rfq.status}
                    color={
                      rfq.status === 'accepted'
                        ? colors.success
                        : rfq.status === 'draft'
                          ? colors.textSecondary
                          : colors.accent
                    }
                    softColor={
                      rfq.status === 'accepted'
                        ? colors.successSoft
                        : rfq.status === 'draft'
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

      {/* Review Modal */}
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review RFQ</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedRfq && (
                <>
                  <View style={styles.rfqDetails}>
                    <View>
                      <Text style={styles.detailLabel}>RFQ Number</Text>
                      <Text style={styles.detailValue}>{selectedRfq.number}</Text>
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>Status</Text>
                      <Badge
                    label={
                      selectedRfq.status === 'waiting_for_approval'
                        ? 'Waiting for approval'
                        : selectedRfq.status
                    }
                    color={
                      selectedRfq.status === 'accepted'
                        ? colors.success
                        : selectedRfq.status === 'draft'
                          ? colors.textSecondary
                          : colors.accent
                    }
                    softColor={
                      selectedRfq.status === 'accepted'
                        ? colors.successSoft
                        : selectedRfq.status === 'draft'
                          ? colors.surfaceAlt
                          : colors.accentSoft
                    }
                  />
                    </View>
                  </View>

                  <Text style={styles.detailLabel}>Vendor / Client</Text>
                  <Text style={styles.detailValue}>{selectedRfq.clientName}</Text>

                  <Text style={[styles.detailLabel, { marginTop: spacing.lg }]}>
                    Items
                  </Text>
                  {selectedRfq.items?.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemQty}>Qty: {item.qty}</Text>
                      </View>
                      <Text style={styles.itemAmount}>
                        {formatCurrency(item.qty * item.price)}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>{formatCurrency(selectedRfq.total)}</Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {selectedRfq?.status === 'waiting_for_approval' && (
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
                  if (selectedRfq) deleteRFQ(selectedRfq.id);
                  setReviewModalVisible(false);
                }}
              />
              <Button
                title={selectedRfq?.status === 'accepted' ? 'Approved' : 'Approve'}
                onPress={approveRFQ}
                disabled={selectedRfq?.status === 'accepted'}
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
  rfqCard: { marginBottom: spacing.md },
  rfqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rfqIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfqNumber: { ...typography.bodyBold, color: colors.text },
  rfqVendor: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  rfqRight: { alignItems: 'flex-end' },
  rfqAmount: { ...typography.bodyBold, color: colors.primary },
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
  rfqDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  detailLabel: { ...typography.label, color: colors.text, fontWeight: '600', marginTop: spacing.md },
  detailValue: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  productsList: { marginBottom: spacing.lg },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productName: { ...typography.bodyBold, color: colors.text },
  productPrice: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  itemName: { ...typography.bodyBold, color: colors.text },
  itemQty: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  itemAmount: { ...typography.bodyBold, color: colors.primary, minWidth: 80, textAlign: 'right' },
  qtyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    width: 50,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    fontSize: 14,
    color: colors.text,
  },
  removeBtn: { paddingHorizontal: spacing.sm },
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
