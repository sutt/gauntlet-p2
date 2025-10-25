import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useRouter } from 'expo-router';
import type { GenerateKeysResponse } from '@/types/signature';

export default function SignatureSetupScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
        Alert.alert(
          'Success',
          'Your signature keys have been generated successfully!',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
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
  }
});
