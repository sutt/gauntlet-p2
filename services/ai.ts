import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

/**
 * Request/Response types for AI functions
 */
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
