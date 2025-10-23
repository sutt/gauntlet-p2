import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { openaiApiKey, getOpenAIKey } from './config';

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
