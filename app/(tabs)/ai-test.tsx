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
import { testAI, translateMessage } from '../../services/ai';
import { useAuth } from '../../context/auth';

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
  const { user } = useAuth();

  // Hello World AI Test
  const [message, setMessage] = useState('Hello, AI!');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Translation Test
  const [translateText, setTranslateText] = useState('Hello, how are you?');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [translationResult, setTranslationResult] = useState<any>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState('');

  const handleTest = async () => {
    if (!user) {
      Alert.alert('Not Logged In', 'You must be logged in to use AI functions. Please sign in first.');
      return;
    }

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

  const handleTranslation = async () => {
    if (!user) {
      Alert.alert('Not Logged In', 'You must be logged in to use AI functions. Please sign in first.');
      return;
    }

    if (!translateText.trim()) {
      Alert.alert('Error', 'Please enter text to translate');
      return;
    }

    if (!targetLanguage.trim()) {
      Alert.alert('Error', 'Please enter target language');
      return;
    }

    setTranslationLoading(true);
    setTranslationError('');
    setTranslationResult(null);

    try {
      const result = await translateMessage({
        text: translateText.trim(),
        targetLanguage: targetLanguage.trim(),
      });
      setTranslationResult(result);
    } catch (err: any) {
      console.error('Translation error:', err);
      setTranslationError(err.message);
    } finally {
      setTranslationLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>AI Function Test</Text>
        <Text style={styles.subtitle}>
          Test the helloWorldAI Cloud Function
        </Text>

        {!user && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ You are not logged in. Please sign in to use AI functions.
            </Text>
          </View>
        )}

        {user && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              ✅ Logged in as: {user.email}
            </Text>
          </View>
        )}

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

        {/* Translation Test Section */}
        <View style={styles.divider} />

        <Text style={styles.title}>Translation Test</Text>
        <Text style={styles.subtitle}>
          Test the translateMessage Cloud Function
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Text to Translate</Text>
          <TextInput
            style={styles.input}
            value={translateText}
            onChangeText={setTranslateText}
            placeholder="Enter text to translate..."
            multiline
            numberOfLines={3}
            editable={!translationLoading}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Target Language</Text>
          <TextInput
            style={styles.inputSmall}
            value={targetLanguage}
            onChangeText={setTargetLanguage}
            placeholder="e.g., Spanish, French, Japanese..."
            editable={!translationLoading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, translationLoading && styles.buttonDisabled]}
          onPress={handleTranslation}
          disabled={translationLoading}
        >
          {translationLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Translate</Text>
          )}
        </TouchableOpacity>

        {translationError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Translation Error</Text>
            <Text style={styles.errorText}>{translationError}</Text>
          </View>
        )}

        {translationResult && (
          <View style={styles.translationResultBox}>
            <Text style={styles.translationLabel}>Translation:</Text>
            <Text style={styles.translationText}>{translationResult.translatedText}</Text>

            <View style={styles.translationMeta}>
              <Text style={styles.metaText}>
                {translationResult.sourceLanguage} → {translationResult.targetLanguage}
              </Text>
              <Text style={styles.metaText}>
                Confidence: {(translationResult.confidence * 100).toFixed(0)}%
              </Text>
            </View>

            {translationResult.alternatives && translationResult.alternatives.length > 0 && (
              <View style={styles.alternativesBox}>
                <Text style={styles.alternativesLabel}>Alternative Translations:</Text>
                {translationResult.alternatives.map((alt: string, idx: number) => (
                  <Text key={idx} style={styles.alternativeText}>• {alt}</Text>
                ))}
              </View>
            )}

            {translationResult.culturalNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Cultural Notes:</Text>
                <Text style={styles.notesText}>{translationResult.culturalNotes}</Text>
              </View>
            )}

            {translationResult.idiomExplanations && translationResult.idiomExplanations.length > 0 && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Idiom Explanations:</Text>
                {translationResult.idiomExplanations.map((exp: string, idx: number) => (
                  <Text key={idx} style={styles.notesText}>• {exp}</Text>
                ))}
              </View>
            )}
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
  warningBox: {
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
  },
  successBox: {
    padding: 16,
    backgroundColor: '#d4edda',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28a745',
    marginBottom: 20,
  },
  successText: {
    fontSize: 14,
    color: '#155724',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 32,
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  buttonSecondary: {
    backgroundColor: '#28a745',
  },
  translationResultBox: {
    padding: 16,
    backgroundColor: '#f0fff4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  translationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
    marginBottom: 8,
  },
  translationText: {
    fontSize: 18,
    lineHeight: 26,
    color: '#000',
    fontWeight: '600',
    marginBottom: 12,
  },
  translationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#d4edda',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  alternativesBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  alternativesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  alternativeText: {
    fontSize: 14,
    color: '#333',
    marginVertical: 2,
  },
  notesBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fffbf0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 20,
  },
});
