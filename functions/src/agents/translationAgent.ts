import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getOpenAIKey } from '../config';

/**
 * Translation Agent
 *
 * Capabilities:
 * 1. Detect source language automatically
 * 2. Translate to target language
 * 3. Provide context about translation choices
 * 4. Handle cultural nuances and idioms
 */

export interface TranslationContext {
  conversationId?: string;       // For conversation context
  recentMessages?: string[];     // Recent messages for context
  senderName?: string;           // Who sent the message
  recipientNames?: string[];     // Who will receive translation
}

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;       // Optional, will auto-detect if not provided
  context?: TranslationContext;
  formalityLevel?: 'formal' | 'informal' | 'auto';
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;        // Detected or provided
  targetLanguage: string;
  confidence: number;            // 0-1, how confident AI is
  alternatives?: string[];       // Other translation options
  culturalNotes?: string;        // Important cultural context
  idiomExplanations?: string[];  // If idioms detected
  formalityLevel: string;
}

/**
 * Build system prompt for translation agent
 */
function buildTranslationPrompt(request: TranslationRequest): string {
  const { text, targetLanguage, sourceLanguage, context, formalityLevel } = request;

  let prompt = `You are an expert translation assistant specializing in accurate, culturally-aware translations.

Task: Translate the following text to ${targetLanguage}.`;

  if (sourceLanguage) {
    prompt += `\nSource Language: ${sourceLanguage}`;
  } else {
    prompt += `\nSource Language: Auto-detect`;
  }

  if (formalityLevel && formalityLevel !== 'auto') {
    prompt += `\nFormality Level: ${formalityLevel}`;
  }

  if (context?.recentMessages && context.recentMessages.length > 0) {
    prompt += `\n\nConversation Context (for better translation):`;
    context.recentMessages.forEach((msg, i) => {
      prompt += `\n${i + 1}. ${msg}`;
    });
  }

  if (context?.senderName) {
    prompt += `\n\nSender: ${context.senderName}`;
  }

  if (context?.recipientNames && context.recipientNames.length > 0) {
    prompt += `\nRecipients: ${context.recipientNames.join(', ')}`;
  }

  prompt += `\n\nText to translate:
"${text}"

Instructions:
1. Detect the source language if not specified
2. Provide accurate translation maintaining meaning and tone
3. Note any idioms, slang, or cultural references
4. Suggest alternatives if multiple valid translations exist
5. Indicate confidence level (0-1)
6. Add cultural notes if relevant

Return JSON with the following structure:
{
  "translatedText": "string",
  "sourceLanguage": "string",
  "confidence": number,
  "alternatives": ["string"] (optional),
  "culturalNotes": "string" (optional),
  "idiomExplanations": ["string"] (optional)
}`;

  return prompt;
}

/**
 * Main translation function
 */
export async function translateText(
  request: TranslationRequest
): Promise<TranslationResponse> {
  const apiKey = getOpenAIKey();
  const openai = createOpenAI({ apiKey });

  const prompt = buildTranslationPrompt(request);

  try {
    const { text: responseText } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        {
          role: 'system',
          content: 'You are a professional translation assistant. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
    });

    // Parse JSON response
    const result = JSON.parse(responseText);

    return {
      originalText: request.text,
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage || request.sourceLanguage || 'unknown',
      targetLanguage: request.targetLanguage,
      confidence: result.confidence || 0.9,
      alternatives: result.alternatives,
      culturalNotes: result.culturalNotes,
      idiomExplanations: result.idiomExplanations,
      formalityLevel: request.formalityLevel || 'auto',
    };
  } catch (error: any) {
    console.error('Translation error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

/**
 * Validate translation request
 */
export const TranslationRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  targetLanguage: z.string().min(2).max(50),
  sourceLanguage: z.string().min(2).max(50).optional(),
  context: z
    .object({
      conversationId: z.string().optional(),
      recentMessages: z.array(z.string()).max(10).optional(),
      senderName: z.string().optional(),
      recipientNames: z.array(z.string()).optional(),
    })
    .optional(),
  formalityLevel: z.enum(['formal', 'informal', 'auto']).optional(),
});
