import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { testAI } from '../../services/ai';

/**
 * AI Test Screen
 *
 * Simple test interface for the helloWorldAI Cloud Function.
 * This demonstrates the complete flow from client -> function -> OpenAI -> response.
 *
 * Prerequisites:
 * 1. Firebase emulators running (npm run functions:dev)
 * 2. EXPO_PUBLIC_USE_EMULATOR=true in .env.local
 * 3. OpenAI API key set in functions/.env
 */
export default function AITestScreen() {
  const [message, setMessage] = useState('Hello, AI!');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await testAI(message.trim());
      setResponse(result.output);
    } catch (err: any) {
      console.error('AI test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>AI Function Test</Text>
        <Text style={styles.subtitle}>
          Test the helloWorldAI Cloud Function
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Your Message</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Enter message to AI..."
            multiline
            numberOfLines={4}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleTest}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Test AI Function</Text>
          )}
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Make sure:{'\n'}
              • Firebase emulators are running{'\n'}
              • EXPO_PUBLIC_USE_EMULATOR=true in .env.local{'\n'}
              • OpenAI API key is set in functions/.env{'\n'}
              • You are logged in
            </Text>
          </View>
        )}

        {response && (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>AI Response:</Text>
            <Text style={styles.responseText}>{response}</Text>
          </View>
        )}

        {!response && !error && !loading && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>ℹ️ Setup Instructions</Text>
            <Text style={styles.infoText}>
              1. Start emulators: npm run functions:dev{'\n'}
              2. Set OPENAI_API_KEY in functions/.env{'\n'}
              3. Make sure you're logged in{'\n'}
              4. Click "Test AI Function"
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#f8f8f8',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#fee',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcc',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c00',
    marginBottom: 8,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    marginBottom: 12,
  },
  errorHint: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
  },
  responseBox: {
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  responseText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
  },
  infoBox: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
  },
});
