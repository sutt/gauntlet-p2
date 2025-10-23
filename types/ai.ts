/**
 * AI Service Types
 *
 * Shared TypeScript types for AI functions (client and server)
 */

// ============================================================================
// Hello World AI
// ============================================================================

export interface HelloWorldRequest {
  message: string;
}

export interface HelloWorldResponse {
  success: boolean;
  input: string;
  output: string;
  timestamp: string;
  userId: string;
  model: string;
}

// ============================================================================
// Translation
// ============================================================================

export interface TranslationContext {
  conversationId?: string;
  recentMessages?: string[];
  senderName?: string;
  recipientNames?: string[];
}

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  context?: TranslationContext;
  formalityLevel?: 'formal' | 'informal' | 'auto';
}

export interface TranslationResponse {
  success: boolean;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  alternatives?: string[];
  culturalNotes?: string;
  idiomExplanations?: string[];
  formalityLevel: string;
  timestamp: string;
}
