import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useAuth } from '@/context/auth';
import type { Message } from '@/types/chat';
import type { SignMessagesResponse } from '@/types/signature';
import { Ionicons } from '@expo/vector-icons';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  messages: Message[];
  conversationId: string;
  participants: Array<{ email: string; displayName: string }>;
}

export default function SignatureModal({
  visible,
  onClose,
  messages,
  conversationId,
  participants,
}: SignatureModalProps) {
  const { user } = useAuth();
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [signatureId, setSignatureId] = useState('');

  const handleSign = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError('');

    console.log('[SignatureModal] Starting signing process...');
    console.log('[SignatureModal] Messages to sign:', messages.length);
    console.log('[SignatureModal] Conversation ID:', conversationId);

    try {
      // Build payload (client-provided, trusted for POC)
      const payload: any = {
        version: '2.0',
        timestamp: 0, // Will be set by server
        signedAt: '', // Will be set by server
        nonce: '', // Will be set by server
        signerId: user.email || user.uid,
        conversationId,
        participants: participants.map((p) => ({
          email: p.email,
          displayName: p.displayName,
        })),
        messages: messages.map((m) => ({
          messageId: m.id,
          text: m.text || '',
          senderId: m.senderId,
          senderName: m.senderName,
          timestamp: m.timestamp instanceof Date ? m.timestamp.getTime() : m.timestamp,
          sentAt: new Date(m.timestamp).toISOString(),
        })),
      };

      // Only add purpose and notes if they have values
      if (purpose && purpose.trim()) {
        payload.purpose = purpose.trim();
      }
      if (notes && notes.trim()) {
        payload.notes = notes.trim();
      }

      console.log('[SignatureModal] Calling signMessages Cloud Function...');

      // Call Cloud Function
      const signMessagesFunc = httpsCallable<
        { conversationId: string; payload: any },
        SignMessagesResponse
      >(functions, 'signMessages');

      const result = await signMessagesFunc({
        conversationId,
        payload,
      });

      console.log('[SignatureModal] ✓ Signature created:', result.data);

      if (result.data.success && result.data.signatureId) {
        setSignatureId(result.data.signatureId);
        setSuccess(true);
      } else {
        setError(result.data.message || 'Failed to create signature');
      }
    } catch (err: any) {
      console.error('[SignatureModal] Signing error:', err);
      setError(err.message || 'Failed to create signature. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setPurpose('');
    setNotes('');
    setError('');
    setSuccess(false);
    setSignatureId('');
    onClose();
  };

  // Success modal content
  if (success) {
    return (
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              {/* Success header */}
              <View style={styles.successHeader}>
                <Ionicons name="checkmark-circle" size={64} color="#34C759" />
                <Text style={styles.successTitle}>Signature Created!</Text>
              </View>

              <Text style={styles.successMessage}>
                Your messages have been cryptographically signed.
              </Text>

              {/* Signature ID display */}
              <View style={styles.signatureIdSection}>
                <Text style={styles.signatureIdLabel}>Signature ID:</Text>
                <ScrollView style={styles.signatureIdBox} horizontal>
                  <Text style={styles.signatureIdText} selectable>
                    {signatureId}
                  </Text>
                </ScrollView>
                <Text style={styles.signatureIdHint}>
                  This signature proves you signed {messages.length} message{messages.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Done button */}
              <TouchableOpacity style={styles.successButton} onPress={handleClose}>
                <Text style={styles.successButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Main signing modal content
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Sign Messages</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent}>
              {/* Message preview */}
              <View style={styles.previewSection}>
                <Text style={styles.sectionLabel}>Messages to sign ({messages.length}):</Text>
                <View style={styles.messagePreviewContainer}>
                  {messages.map((m, i) => (
                    <View key={m.id} style={styles.messagePreview}>
                      <Text style={styles.messageSender}>{m.senderName}:</Text>
                      <Text style={styles.messageText} numberOfLines={2}>
                        {m.text || '[Image]'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Purpose input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Purpose (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., approval, attestation, authorization"
                  placeholderTextColor="#999"
                  value={purpose}
                  onChangeText={setPurpose}
                  editable={!loading}
                />
              </View>

              {/* Notes input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add any additional context or notes..."
                  placeholderTextColor="#999"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                />
              </View>

              {/* Error display */}
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.signButton, loading && styles.buttonDisabled]}
                onPress={handleSign}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color="#fff" size="small" style={styles.spinner} />
                    <Text style={styles.buttonText}>Signing...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Sign Messages</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    maxHeight: 400,
  },
  previewSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  messagePreviewContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    maxHeight: 150,
  },
  messagePreview: {
    marginBottom: 12,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 16,
    gap: 12,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signButton: {
    backgroundColor: '#1976d2',
  },
  buttonDisabled: {
    backgroundColor: '#90caf9',
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
  },
  // Success modal styles
  successHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  signatureIdSection: {
    marginBottom: 24,
  },
  signatureIdLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  signatureIdBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    maxHeight: 60,
  },
  signatureIdText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#333',
    lineHeight: 18,
  },
  signatureIdHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  successButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
