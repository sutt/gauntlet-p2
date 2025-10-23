import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { translateMessage } from '../services/ai';
import type { TranslationResponse } from '../types/ai';

interface TranslationModalProps {
  visible: boolean;
  onClose: () => void;
  messageText: string;
  conversationId?: string;
  defaultTargetLanguage?: string;
}

/**
 * TranslationModal Component
 *
 * A modal for translating messages with AI-powered context awareness.
 * Features:
 * - Auto-detect source language
 * - Context-aware translation using conversation history
 * - Alternative translations
 * - Cultural notes and idiom explanations
 * - Formality level control
 */
export default function TranslationModal({
  visible,
  onClose,
  messageText,
  conversationId,
  defaultTargetLanguage = 'Spanish',
}: TranslationModalProps) {
  const [targetLanguage, setTargetLanguage] = useState(defaultTargetLanguage);
  const [formalityLevel, setFormalityLevel] = useState<'formal' | 'informal' | 'auto'>('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [error, setError] = useState('');

  const handleTranslate = async () => {
    if (!targetLanguage.trim()) {
      setError('Please enter a target language');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await translateMessage({
        text: messageText,
        targetLanguage: targetLanguage.trim(),
        context: conversationId ? { conversationId } : undefined,
        formalityLevel,
      });

      setResult(response);
    } catch (err: any) {
      console.error('Translation error:', err);
      setError(err.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Translate Message</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Original Message */}
            <View style={styles.section}>
              <Text style={styles.label}>Original Message</Text>
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{messageText}</Text>
              </View>
            </View>

            {/* Target Language */}
            <View style={styles.section}>
              <Text style={styles.label}>Target Language</Text>
              <TextInput
                style={styles.input}
                value={targetLanguage}
                onChangeText={setTargetLanguage}
                placeholder="e.g., Spanish, French, Japanese..."
                editable={!loading}
              />
            </View>

            {/* Formality Level */}
            <View style={styles.section}>
              <Text style={styles.label}>Formality</Text>
              <View style={styles.formalityButtons}>
                {(['auto', 'formal', 'informal'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.formalityButton,
                      formalityLevel === level && styles.formalityButtonActive,
                    ]}
                    onPress={() => setFormalityLevel(level)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.formalityButtonText,
                        formalityLevel === level && styles.formalityButtonTextActive,
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Translate Button */}
            <TouchableOpacity
              style={[styles.translateButton, loading && styles.translateButtonDisabled]}
              onPress={handleTranslate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.translateButtonText}>Translate</Text>
              )}
            </TouchableOpacity>

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Translation Result */}
            {result && (
              <View style={styles.resultContainer}>
                <View style={styles.translationBox}>
                  <Text style={styles.resultLabel}>Translation</Text>
                  <Text style={styles.translationText}>{result.translatedText}</Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {result.sourceLanguage} → {result.targetLanguage}
                    </Text>
                    <Text style={styles.metaText}>
                      {(result.confidence * 100).toFixed(0)}% confident
                    </Text>
                  </View>
                </View>

                {/* Alternatives */}
                {result.alternatives && result.alternatives.length > 0 && (
                  <View style={styles.alternativesBox}>
                    <Text style={styles.sectionTitle}>Alternative Translations</Text>
                    {result.alternatives.map((alt, idx) => (
                      <Text key={idx} style={styles.alternativeText}>
                        • {alt}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Cultural Notes */}
                {result.culturalNotes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.sectionTitle}>Cultural Notes</Text>
                    <Text style={styles.notesText}>{result.culturalNotes}</Text>
                  </View>
                )}

                {/* Idiom Explanations */}
                {result.idiomExplanations && result.idiomExplanations.length > 0 && (
                  <View style={styles.notesBox}>
                    <Text style={styles.sectionTitle}>Idiom Explanations</Text>
                    {result.idiomExplanations.map((exp, idx) => (
                      <Text key={idx} style={styles.notesText}>
                        • {exp}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  messageBox: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  messageText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  formalityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  formalityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  formalityButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  formalityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  formalityButtonTextActive: {
    color: '#fff',
  },
  translateButton: {
    backgroundColor: '#28a745',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  translateButtonDisabled: {
    opacity: 0.6,
  },
  translateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcc',
    marginBottom: 20,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
  resultContainer: {
    gap: 12,
  },
  translationBox: {
    backgroundColor: '#f0fff4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28a745',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  translationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    lineHeight: 26,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d4edda',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  alternativesBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  alternativeText: {
    fontSize: 14,
    color: '#333',
    marginVertical: 4,
  },
  notesBox: {
    backgroundColor: '#fffbf0',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  notesText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});
