import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type {
  HelloWorldRequest,
  HelloWorldResponse,
  TranslationRequest,
  TranslationResponse,
} from '../types/ai';

/**
 * Test AI function - sends a message and gets AI response
 *
 * This is a simple "Hello World" function to test the Cloud Functions setup.
 * It calls OpenAI's GPT-3.5-turbo model with a brief prompt.
 *
 * @param message - The message to send to the AI
 * @returns AI response with metadata
 * @throws Error if the function call fails or user is not authenticated
 */
export const testAI = async (message: string): Promise<HelloWorldResponse> => {
  const callable = httpsCallable<HelloWorldRequest, HelloWorldResponse>(
    functions,
    'helloWorldAI'
  );

  try {
    const result = await callable({ message });
    return result.data;
  } catch (error: any) {
    console.error('Error calling helloWorldAI:', error);

    // Extract useful error message
    const errorMessage = error.message || error.code || 'Failed to call AI function';
    throw new Error(errorMessage);
  }
};

/**
 * Translate text using AI
 *
 * Translates text with conversation context awareness.
 * Can auto-detect source language and provide cultural insights.
 *
 * @param request - Translation request with text, target language, and optional context
 * @returns Translation response with translated text, alternatives, and cultural notes
 * @throws Error if translation fails or user is not authenticated
 */
export const translateMessage = async (
  request: TranslationRequest
): Promise<TranslationResponse> => {
  const callable = httpsCallable<TranslationRequest, TranslationResponse>(
    functions,
    'translateMessage'
  );

  try {
    const result = await callable(request);
    return result.data;
  } catch (error: any) {
    console.error('Error translating message:', error);

    // Extract useful error message
    const errorMessage = error.message || error.code || 'Translation failed';
    throw new Error(errorMessage);
  }
};
