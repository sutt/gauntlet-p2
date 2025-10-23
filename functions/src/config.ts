import { defineSecret } from 'firebase-functions/params';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local for local development (emulator only)
// This file is NOT deployed to production
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
}

// Define secrets (auto-loaded from Firebase Secret Manager in production)
export const openaiApiKey = defineSecret('OPENAI_API_KEY');

/**
 * Get OpenAI API key based on environment
 * In emulator mode, loads from .env.local file
 * In production, loads from Firebase Secret Manager
 */
export const getOpenAIKey = (): string => {
  // Check if running in emulator
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    // Load from environment variable in emulator mode
    return process.env.OPENAI_API_KEY || '';
  }
  // In production, use the secret value
  return openaiApiKey.value();
};
