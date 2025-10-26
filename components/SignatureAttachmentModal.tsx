/**
 * CHAI: Signature Attachment Modal
 *
 * Allows users to browse and attach signatures to chat messages.
 * Used for providing authorization to AI agents (e.g., BuyBot).
 *
 * Shows ALL signatures in user's collection (both created and received).
 * Typically, users will attach signatures received from power users.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '@/utils/date-format';
import type { Signature } from '@/types/signature';

interface SignatureAttachmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSignature: (signature: Signature) => void;
  userId: string;
}

export default function SignatureAttachmentModal({
  visible,
  onClose,
  onSelectSignature,
  userId,
}: SignatureAttachmentModalProps) {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  // Fetch user's signatures (both created and received)
  useEffect(() => {
    if (!visible || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('[SignatureAttachmentModal] Fetching signatures for user:', userId);

    const signaturesRef = collection(db, 'users', userId, 'signatures');
    const signaturesQuery = query(signaturesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      signaturesQuery,
      (snapshot) => {
        const sigs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            signatureId: doc.id,
            // Convert Firestore Timestamps to Dates
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            verifiedAt: data.verifiedAt?.toDate?.() || (data.verifiedAt ? new Date(data.verifiedAt) : undefined),
          } as Signature;
        });

        console.log('[SignatureAttachmentModal] Loaded signatures:', sigs.length);
        setSignatures(sigs);
        setLoading(false);
      },
      (error) => {
        console.error('[SignatureAttachmentModal] Error fetching signatures:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [visible, userId]);

  // Filter signatures by search query
  const filteredSignatures = useMemo(() => {
    if (!searchQuery.trim()) return signatures;

    const query = searchQuery.toLowerCase();
    return signatures.filter((sig) => {
      // Search by signer
      if (sig.signedPayload.signerId.toLowerCase().includes(query)) return true;

      // Search by purpose
      if (sig.purpose?.toLowerCase().includes(query)) return true;

      // Search by message content
      const hasMatchingMessage = sig.signedPayload.messages.some((m) =>
        m.text.toLowerCase().includes(query)
      );
      if (hasMatchingMessage) return true;

      return false;
    });
  }, [signatures, searchQuery]);

  const handleSelectSignature = (signature: Signature) => {
    console.log('[SignatureAttachmentModal] Signature selected:', signature.signatureId);
    onSelectSignature(signature);
    onClose();
    // Clear search for next time
    setSearchQuery('');
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <ThemedText type="subtitle">Attach Signature</ThemedText>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={tintColor} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { borderColor, color: textColor }]}
              placeholder="Search signatures..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Signature List */}
          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={tintColor} />
              <ThemedText style={styles.loadingText}>Loading signatures...</ThemedText>
            </View>
          ) : filteredSignatures.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <ThemedText style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No signatures match your search'
                  : 'No signatures available'}
              </ThemedText>
              {!searchQuery.trim() && (
                <ThemedText style={styles.emptySubtext}>
                  Signatures you create or receive will appear here
                </ThemedText>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredSignatures}
              keyExtractor={(item) => item.signatureId}
              renderItem={({ item }) => (
                <SignatureAttachmentCard
                  signature={item}
                  onSelect={() => handleSelectSignature(item)}
                  tintColor={tintColor}
                  borderColor={borderColor}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Card component for displaying a signature in the attachment picker
 * Shows key metadata: signer, message count, timestamp, purpose
 */
interface SignatureAttachmentCardProps {
  signature: Signature;
  onSelect: () => void;
  tintColor: string;
  borderColor: string;
}

function SignatureAttachmentCard({
  signature,
  onSelect,
  tintColor,
  borderColor,
}: SignatureAttachmentCardProps) {
  const signer = signature.signedPayload.signerId;
  const messageCount = signature.signedPayload.messages.length;
  const preview = signature.signedPayload.messages[0]?.text || '';
  const previewText = preview.length > 80 ? preview.substring(0, 80) + '...' : preview;
  const timestamp = formatRelativeTime(signature.createdAt);

  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[styles.card, { borderColor }]}
      activeOpacity={0.7}
    >
      {/* Signer info */}
      <View style={styles.cardHeader}>
        <Ionicons name="ribbon" size={20} color={tintColor} style={styles.cardIcon} />
        <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.cardSigner}>
          {signer}
        </ThemedText>
        {signature.verified && (
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
        )}
      </View>

      {/* Message count */}
      <ThemedText style={styles.messageCount}>
        Signed {messageCount} message{messageCount !== 1 ? 's' : ''}
      </ThemedText>

      {/* Message preview */}
      {preview && (
        <ThemedText style={styles.preview} numberOfLines={2}>
          "{previewText}"
        </ThemedText>
      )}

      {/* Footer: timestamp and purpose */}
      <View style={styles.cardFooter}>
        <ThemedText style={styles.timestamp}>{timestamp}</ThemedText>
        {signature.purpose && (
          <>
            <ThemedText style={styles.footerDot}>•</ThemedText>
            <ThemedText style={styles.purpose} numberOfLines={1}>
              {signature.purpose}
            </ThemedText>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    height: '80%',
    ...Platform.select({
      web: {
        // On web, use maxHeight instead of height for better responsiveness
        height: 'auto',
        maxHeight: '80%',
        minHeight: 400,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 32,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 16,
  },
  clearButton: {
    position: 'absolute',
    right: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.5,
  },
  listContent: {
    padding: 16,
  },
  // Card styles
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    marginRight: 8,
  },
  cardSigner: {
    flex: 1,
    marginRight: 8,
  },
  messageCount: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 8,
  },
  preview: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.6,
  },
  footerDot: {
    fontSize: 12,
    opacity: 0.6,
    marginHorizontal: 6,
  },
  purpose: {
    flex: 1,
    fontSize: 12,
    opacity: 0.6,
  },
});
