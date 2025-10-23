import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { openaiApiKey, getOpenAIKey } from './config';
import { translateText, TranslationRequestSchema } from './agents/translationAgent';
import {
  getConversationContext,
  getParticipantNames,
  getSenderName,
} from './services/contextRetrieval';

// Initialize Firebase Admin SDK
// Required because we use Firestore at module level (in this file and contextRetrieval.ts)
// In production, this auto-configures from the environment
// In Functions shell, this must be explicit
initializeApp();

const db = getFirestore();

/**
 * Hello World AI Function
 *
 * This is a simple callable function that demonstrates:
 * 1. Callable function pattern
 * 2. Authentication check
 * 3. Secret usage (OpenAI API key)
 * 4. Error handling
 * 5. TypeScript types
 *
 * Usage from client:
 * const result = await httpsCallable(functions, 'helloWorldAI')({ message: 'Hello!' });
 */
export const helloWorldAI = onCall(
  {
    secrets: [openaiApiKey], // Declare secret dependencies
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    // Allow public invocation (authentication is handled by Firebase SDK)
    invoker: 'public',
    // Enable CORS for web development
    cors: [
      'http://localhost:8081',  // Expo web dev server
      'http://localhost:19006', // Alternative Expo web port
      /^https:\/\/.*\.vercel\.app$/, // Vercel deployments (if you deploy later)
    ],
  },
  async (request) => {
    // 1. Authentication check
    // Can be disabled for local shell testing via DISABLE_AUTH_CHECK env var
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';

    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to call this function.'
      );
    }

    const { message } = request.data;

    // 2. Input validation
    if (!message || typeof message !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a "message" field.'
      );
    }

    try {
      // 3. Get OpenAI API key from secrets
      const apiKey = getOpenAIKey();

      if (!apiKey) {
        throw new HttpsError(
          'failed-precondition',
          'OpenAI API key not configured'
        );
      }

      // 4. Make a simple OpenAI API call (completion test)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Respond briefly.',
            },
            {
              role: 'user',
              content: message,
            },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('OpenAI API error:', error);
        throw new HttpsError(
          'internal',
          `OpenAI API error: ${error.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || 'No response';

      // 5. Return structured response
      return {
        success: true,
        input: message,
        output: aiResponse,
        timestamp: new Date().toISOString(),
        userId: request.auth?.uid || 'shell-test-user',
        model: 'gpt-3.5-turbo',
      };
    } catch (error: any) {
      console.error('Error in helloWorldAI:', error);

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError('internal', `Function error: ${error.message}`);
    }
  }
);

/**
 * Translation Cloud Function
 *
 * Translates text with conversation context awareness.
 * Uses AI SDK for intelligent translation with cultural understanding.
 *
 * Features:
 * - Auto-detects source language
 * - Provides alternative translations
 * - Explains idioms and cultural references
 * - Uses conversation context for better accuracy
 */
export const translateMessage = onCall(
  {
    secrets: [openaiApiKey],
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    invoker: 'public',
    cors: [
      'http://localhost:8081',
      'http://localhost:19006',
      /^https:\/\/.*\.vercel\.app$/,
    ],
  },
  async (request) => {
    const startTime = Date.now();

    // Authentication check
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';
    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth?.uid || 'shell-test-user';

    try {
      // Validate input
      const validationResult = TranslationRequestSchema.safeParse(request.data);
      if (!validationResult.success) {
        throw new HttpsError(
          'invalid-argument',
          `Invalid request: ${validationResult.error.message}`
        );
      }

      const translationRequest = validationResult.data;

      // If conversation context provided, fetch it
      if (translationRequest.context?.conversationId) {
        const conversationId = translationRequest.context.conversationId;

        // Verify user has access to this conversation
        const convDoc = await db.collection('conversations').doc(conversationId).get();

        if (!convDoc.exists) {
          throw new HttpsError('not-found', 'Conversation not found');
        }

        const participants = convDoc.data()?.participants || [];
        if (!disableAuthCheck && !participants.includes(userId)) {
          throw new HttpsError('permission-denied', 'Not a participant in this conversation');
        }

        // Fetch context
        const recentMessages = await getConversationContext(conversationId, 5);
        const participantNames = await getParticipantNames(conversationId);

        // Enhance request with context
        translationRequest.context = {
          ...translationRequest.context,
          recentMessages,
          recipientNames: participantNames.filter((name) => name !== 'Unknown'),
        };
      }

      // Get sender name
      if (!translationRequest.context?.senderName && !disableAuthCheck) {
        const senderName = await getSenderName(userId);
        if (!translationRequest.context) {
          translationRequest.context = {};
        }
        translationRequest.context.senderName = senderName;
      }

      // Perform translation
      const result = await translateText(translationRequest);

      console.log(`Translation completed in ${Date.now() - startTime}ms for user ${userId}`);

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Error in translateMessage:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Translation error: ${error.message}`);
    }
  }
);
