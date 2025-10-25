import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useRouter } from 'expo-router';
import type { GenerateKeysResponse } from '@/types/signature';

export default function SignatureSetupScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedFingerprint, setGeneratedFingerprint] = useState('');
  const router = useRouter();

  const handleGenerateKeys = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('[UI] Calling generateKeysForUser...');
      const generateKeys = httpsCallable<{}, GenerateKeysResponse>(functions, 'generateKeysForUser');
      const result = await generateKeys();

      console.log('[UI] Keys generated:', result.data);

      if (result.data.success) {
        const fingerprint = result.data.fingerprint || '';
        setGeneratedFingerprint(fingerprint);
        setShowSuccessModal(true);
      } else {
        setError(result.data.message || 'Failed to generate keys');
      }
    } catch (err: any) {
      console.error('[UI] Key generation error:', err);
      setError(err.message || 'Failed to generate keys. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Set Up Digital Signatures</Text>
        <Text style={styles.version}>Version 2.0 (Server-Side Crypto)</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Digital signatures provide cryptographic proof that you signed specific messages.
        </Text>

        <Text style={styles.description}>
          This enables AI agents to verify your approvals and take trusted actions.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <Text style={styles.infoText}>• Keys generated securely on server</Text>
          <Text style={styles.infoText}>• Messages signed with your private key</Text>
          <Text style={styles.infoText}>• AI agents verify signatures</Text>
          <Text style={styles.infoText}>• Tamper-proof message authentication</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGenerateKeys}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#fff" style={styles.spinner} />
              <Text style={styles.buttonText}>Generating Keys...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Generate Keys</Text>
          )}
        </TouchableOpacity>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>⚠️ Proof-of-Concept</Text>
          <Text style={styles.noteText}>
            This is a POC implementation with simplified security.{'\n'}
            Keys are stored on the server for demonstration purposes.
          </Text>
        </View>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.successHeader}>
                <Text style={styles.successIcon}>✓</Text>
                <Text style={styles.successTitle}>Keys Generated Successfully!</Text>
              </View>

              <Text style={styles.successMessage}>
                Your signature keys have been created and stored securely.
              </Text>

              <View style={styles.fingerprintSection}>
                <Text style={styles.fingerprintLabel}>Key Fingerprint:</Text>
                <ScrollView style={styles.fingerprintBox} horizontal>
                  <Text style={styles.fingerprintText} selectable>
                    {generatedFingerprint}
                  </Text>
                </ScrollView>
                <Text style={styles.fingerprintHint}>
                  This unique identifier proves your key's authenticity
                </Text>
              </View>

              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.back();
                }}
              >
                <Text style={styles.successButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  version: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic'
  },
  content: {
    flex: 1,
    padding: 20
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    lineHeight: 24
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 12
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20
  },
  errorBox: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20
  },
  errorText: {
    color: '#c62828',
    fontSize: 14
  },
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 10
  },
  buttonDisabled: {
    backgroundColor: '#90caf9'
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  spinner: {
    marginRight: 10
  },
  noteBox: {
    marginTop: 30,
    padding: 16,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800'
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 8
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18
  },
  // Success Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 64,
    color: 'green',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  fingerprintSection: {
    marginBottom: 24,
  },
  fingerprintLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  fingerprintBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    maxHeight: 80,
  },
  fingerprintText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  fingerprintHint: {
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
