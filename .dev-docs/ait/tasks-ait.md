# AI Tools Implementation - Task Breakdown

## Document Overview
**Version**: 1.0
**Date**: 2025-10-22
**Status**: Planning Phase

This document outlines a 3-tier implementation plan for integrating AI tools into the chat application, starting with foundational "Hello World" implementations and progressing to production-ready features.

---

## Table of Contents
1. [Tier 1: Hello World Cloud Functions](#tier-1-hello-world-cloud-functions)
2. [Tier 2: Hello World Swarm Translation Agent](#tier-2-hello-world-swarm-translation-agent)
3. [Tier 3: Multi-Agent Extension Strategy](#tier-3-multi-agent-extension-strategy)
4. [Development Workflow](#development-workflow)
5. [Testing Strategy](#testing-strategy)

---

## Tier 1: Hello World Cloud Functions

**Goal**: Set up Firebase Cloud Functions infrastructure with local development, secret management, and deployment pipeline.

**Duration**: 3-5 days

### Objectives
1. ✅ Configure Firebase Cloud Functions in the project
2. ✅ Set up local development environment with Firebase Emulator
3. ✅ Implement secret management for API keys (OpenAI)
4. ✅ Create a simple callable function that uses secrets
5. ✅ Deploy to Firebase and test from mobile app
6. ✅ Establish CI/CD patterns

---

### Task 1.1: Project Setup

#### 1.1.1 Initialize Firebase Functions
```bash
# In project root
cd /home/user/gauntlet/pkgs/p2/hello-expo

# Initialize Firebase Functions (if not already done)
firebase init functions

# Select options:
# - Language: TypeScript
# - ESLint: Yes
# - Install dependencies: Yes
```

**Expected Structure**:
```
hello-expo/
├── functions/              # New directory
│   ├── src/
│   │   └── index.ts       # Main entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .gitignore
├── firebase.json           # Updated with functions config
└── .firebaserc
```

**Deliverable**: `functions/` directory initialized with TypeScript setup

---

#### 1.1.2 Configure Local Development

**Install Firebase Emulator Suite**:
```bash
# Install emulators
firebase init emulators

# Select:
# - Functions Emulator
# - Firestore Emulator (already have)
# - Auth Emulator (already have)
```

**Update `firebase.json`**:
```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "auth": {
      "port": 9099
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

**Add npm scripts to root `package.json`**:
```json
{
  "scripts": {
    "functions:dev": "npm run build --prefix functions && firebase emulators:start --only functions,firestore,auth",
    "functions:shell": "npm run build --prefix functions && firebase functions:shell",
    "functions:logs": "firebase functions:log",
    "functions:deploy": "npm run build --prefix functions && firebase deploy --only functions"
  }
}
```

**Deliverable**: Working local emulator setup

---

#### 1.1.3 Set Up Secret Management

**Configure Firebase Secrets** (for OpenAI API key):

```bash
# Set secret (will prompt for value)
firebase functions:secrets:set OPENAI_API_KEY

# For local development, create .env file
cd functions
cat > .env << EOF
OPENAI_API_KEY=sk-your-test-key-here
EOF

# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

**Load secrets in functions** (`functions/src/config.ts`):
```typescript
// functions/src/config.ts
import { defineSecret } from 'firebase-functions/params';

// Define secrets (auto-loaded from Firebase Secret Manager in production)
export const openaiApiKey = defineSecret('OPENAI_API_KEY');

// For local development, load from .env
if (process.env.FUNCTIONS_EMULATOR) {
  require('dotenv').config();
}

export const getOpenAIKey = (): string => {
  if (process.env.FUNCTIONS_EMULATOR) {
    return process.env.OPENAI_API_KEY || '';
  }
  return openaiApiKey.value();
};
```

**Install dependencies**:
```bash
cd functions
npm install dotenv
npm install --save-dev @types/node
```

**Deliverable**: Secret management configured for local and production

---

### Task 1.2: Hello World Function

#### 1.2.1 Create Simple Callable Function

**File**: `functions/src/index.ts`
```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { openaiApiKey, getOpenAIKey } from './config';

/**
 * Hello World function that demonstrates:
 * 1. Callable function pattern
 * 2. Authentication check
 * 3. Secret usage (OpenAI API key)
 * 4. Error handling
 * 5. TypeScript types
 */
export const helloWorldAI = onCall(
  {
    secrets: [openaiApiKey], // Declare secret dependencies
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    // 1. Authentication check
    if (!request.auth) {
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
        userId: request.auth.uid,
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
```

**Add type definitions** (`functions/src/types.ts`):
```typescript
// Request/Response types for functions
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
```

**Deliverable**: Working Cloud Function that calls OpenAI API

---

#### 1.2.2 Test Locally with Emulator

**Start emulator**:
```bash
npm run functions:dev
```

**Test with Firebase CLI**:
```bash
# In another terminal
firebase functions:shell

# In shell:
> helloWorldAI({ message: "Hello, AI!" })
```

**Check emulator UI**: http://localhost:4000

**Deliverable**: Function tested locally

---

#### 1.2.3 Integrate with Mobile App

**Create service file** (`services/ai.ts`):
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { HelloWorldRequest, HelloWorldResponse } from '../types/ai';

const functions = getFunctions();

// For local development, connect to emulator
if (__DEV__) {
  // Auto-detect emulator or use environment variable
  const useEmulator = process.env.EXPO_PUBLIC_USE_EMULATOR === 'true';
  if (useEmulator) {
    const emulatorHost = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST || 'localhost';
    const emulatorPort = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || '5001';
    connectFunctionsEmulator(functions, emulatorHost, parseInt(emulatorPort));
    console.log(`🔧 Connected to Functions Emulator at ${emulatorHost}:${emulatorPort}`);
  }
}

/**
 * Test AI function - sends a message and gets AI response
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
    throw new Error(error.message || 'Failed to call AI function');
  }
};
```

**Add types** (`types/ai.ts`):
```typescript
// Mirror types from functions
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
```

**Create test screen** (`app/ai-test.tsx`):
```typescript
import { useState } from 'react';
import { View, TextInput, Button, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { testAI } from '../services/ai';

export default function AITestScreen() {
  const [message, setMessage] = useState('Hello, AI!');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    setLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await testAI(message);
      setResponse(result.output);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Function Test</Text>

      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Enter message to AI"
        multiline
      />

      <Button title="Test AI" onPress={handleTest} disabled={loading} />

      {loading && <ActivityIndicator style={styles.loader} />}

      {response && (
        <View style={styles.response}>
          <Text style={styles.label}>AI Response:</Text>
          <Text>{response}</Text>
        </View>
      )}

      {error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 100,
  },
  loader: {
    marginTop: 20,
  },
  response: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  error: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fee',
    borderRadius: 8,
  },
  errorText: {
    color: '#c00',
  },
});
```

**Add to navigation** (`app/(tabs)/_layout.tsx`):
```typescript
// Add new tab for testing (development only)
{__DEV__ && (
  <Tabs.Screen
    name="ai-test"
    options={{
      title: 'AI Test',
      tabBarIcon: ({ color }) => <Ionicons name="flask" size={24} color={color} />,
    }}
  />
)}
```

**Environment configuration** (`.env.local`):
```bash
EXPO_PUBLIC_USE_EMULATOR=true
EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST=localhost
EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT=5001
```

**Deliverable**: Mobile app can call Cloud Function locally

---

#### 1.2.4 Deploy to Firebase

**Build and deploy**:
```bash
# From project root
npm run functions:deploy

# Or deploy specific function
firebase deploy --only functions:helloWorldAI
```

**Test production deployment**:
```bash
# Update .env.local
EXPO_PUBLIC_USE_EMULATOR=false

# Run app and test
npm start
```

**Monitor logs**:
```bash
npm run functions:logs
```

**Deliverable**: Function deployed and working in production

---

### Task 1.3: Cost Monitoring & Error Handling

#### 1.3.1 Add Usage Logging

**File**: `functions/src/utils/logger.ts`
```typescript
import { logger } from 'firebase-functions/v2';

export interface FunctionMetrics {
  functionName: string;
  userId: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  duration: number;
  success: boolean;
  error?: string;
}

export const logFunctionCall = (metrics: FunctionMetrics) => {
  logger.info('Function call metrics', {
    ...metrics,
    timestamp: new Date().toISOString(),
  });

  // In production, could send to analytics service
  // e.g., Google Analytics, Mixpanel, etc.
};

export const calculateOpenAICost = (
  model: string,
  inputTokens: number,
  outputTokens: number
): number => {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4-turbo': { input: 0.01, output: 0.03 }, // per 1K tokens
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  };

  const rates = pricing[model] || pricing['gpt-3.5-turbo'];
  const inputCost = (inputTokens / 1000) * rates.input;
  const outputCost = (outputTokens / 1000) * rates.output;

  return inputCost + outputCost;
};
```

**Update hello world function to log metrics**:
```typescript
import { logFunctionCall, calculateOpenAICost } from './utils/logger';

export const helloWorldAI = onCall(/* ... */, async (request) => {
  const startTime = Date.now();
  let success = false;
  let error: string | undefined;

  try {
    // ... existing code ...

    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = calculateOpenAICost('gpt-3.5-turbo', inputTokens, outputTokens);

    success = true;

    logFunctionCall({
      functionName: 'helloWorldAI',
      userId: request.auth.uid,
      inputTokens,
      outputTokens,
      cost,
      duration: Date.now() - startTime,
      success,
    });

    return { /* ... */ };
  } catch (err) {
    error = err.message;
    logFunctionCall({
      functionName: 'helloWorldAI',
      userId: request.auth?.uid || 'anonymous',
      duration: Date.now() - startTime,
      success,
      error,
    });
    throw err;
  }
});
```

**Deliverable**: Cost and usage logging in place

---

#### 1.3.2 Add Rate Limiting

**File**: `functions/src/utils/rateLimit.ts`
```typescript
import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export interface RateLimitConfig {
  maxCalls: number;
  windowMs: number;
}

/**
 * Check if user has exceeded rate limit
 * Uses Firestore for distributed rate limiting
 */
export const checkRateLimit = async (
  userId: string,
  functionName: string,
  config: RateLimitConfig
): Promise<void> => {
  const rateLimitRef = db.collection('rate_limits').doc(`${userId}_${functionName}`);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(rateLimitRef);

    if (!doc.exists) {
      // First call, create record
      transaction.set(rateLimitRef, {
        calls: 1,
        windowStart: now,
        lastCall: now,
      });
      return;
    }

    const data = doc.data()!;
    const windowStart = data.windowStart;
    const calls = data.calls;

    // Check if window expired
    if (now - windowStart > config.windowMs) {
      // New window
      transaction.update(rateLimitRef, {
        calls: 1,
        windowStart: now,
        lastCall: now,
      });
      return;
    }

    // Within window, check limit
    if (calls >= config.maxCalls) {
      const resetTime = new Date(windowStart + config.windowMs);
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. Try again after ${resetTime.toLocaleTimeString()}`
      );
    }

    // Increment counter
    transaction.update(rateLimitRef, {
      calls: calls + 1,
      lastCall: now,
    });
  });
};

// Preset rate limit configs
export const RATE_LIMITS = {
  AI_FUNCTION_FREE_TIER: {
    maxCalls: 20,
    windowMs: 60 * 60 * 1000, // 20 calls per hour
  },
  AI_FUNCTION_PAID_TIER: {
    maxCalls: 200,
    windowMs: 60 * 60 * 1000, // 200 calls per hour
  },
};
```

**Add to hello world function**:
```typescript
import { checkRateLimit, RATE_LIMITS } from './utils/rateLimit';

export const helloWorldAI = onCall(/* ... */, async (request) => {
  // Rate limiting
  await checkRateLimit(
    request.auth.uid,
    'helloWorldAI',
    RATE_LIMITS.AI_FUNCTION_FREE_TIER
  );

  // ... rest of function
});
```

**Deliverable**: Rate limiting to prevent abuse and cost overruns

---

### Tier 1 Acceptance Criteria

- [ ] Firebase Cloud Functions configured and deployed
- [ ] Local development works with emulator
- [ ] Secrets management configured (OpenAI API key)
- [ ] Hello world function calls OpenAI API successfully
- [ ] Mobile app can call function (local and production)
- [ ] Cost tracking and logging in place
- [ ] Rate limiting implemented
- [ ] Error handling comprehensive
- [ ] Documentation updated

**Estimated Completion**: 3-5 days

---

## Tier 2: Hello World Swarm Translation Agent

**Goal**: Implement a translation AI agent using Swarm framework (or AI SDK equivalent), with full integration from client to backend, serving as a template for future AI features.

**Duration**: 5-7 days

### Objectives
1. ✅ Set up AI SDK (Vercel) for agent development
2. ✅ Build translation agent with context awareness
3. ✅ Implement conversation context retrieval (RAG basics)
4. ✅ Test locally with emulator
5. ✅ Integrate with mobile app UI
6. ✅ Deploy and validate end-to-end
7. ✅ Document pattern as template for future agents

---

### Task 2.1: Translation Agent Foundation

#### 2.1.1 Install AI SDK Dependencies

```bash
cd functions
npm install ai @ai-sdk/openai zod
npm install --save-dev @types/node
```

**AI SDK** provides:
- Unified interface for OpenAI, Anthropic, etc.
- Tool/function calling with Zod validation
- Streaming support
- Token usage tracking

**Deliverable**: AI SDK installed

---

#### 2.1.2 Create Translation Agent

**File**: `functions/src/agents/translationAgent.ts`
```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
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

  const prompt = buildTranslationPrompt(request);

  try {
    const { text: responseText, usage } = await generateText({
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
      maxTokens: 1000,
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
```

**Deliverable**: Translation agent implementation

---

#### 2.1.3 Create Context Retrieval Service

**File**: `functions/src/services/contextRetrieval.ts`
```typescript
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * Retrieve recent messages from a conversation for context
 */
export async function getConversationContext(
  conversationId: string,
  messageCount: number = 5
): Promise<string[]> {
  try {
    const messagesRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(messageCount);

    const snapshot = await messagesRef.get();

    if (snapshot.empty) {
      return [];
    }

    // Return messages in chronological order (oldest first)
    return snapshot.docs
      .reverse()
      .map((doc) => {
        const data = doc.data();
        return `${data.senderName}: ${data.text}`;
      });
  } catch (error) {
    console.error('Error fetching conversation context:', error);
    return [];
  }
}

/**
 * Get participant names from conversation
 */
export async function getParticipantNames(
  conversationId: string
): Promise<string[]> {
  try {
    const convDoc = await db.collection('conversations').doc(conversationId).get();

    if (!convDoc.exists) {
      return [];
    }

    const participantIds = convDoc.data()?.participants || [];

    // Fetch user names
    const userPromises = participantIds.map((userId: string) =>
      db.collection('users').doc(userId).get()
    );

    const userDocs = await Promise.all(userPromises);

    return userDocs
      .filter((doc) => doc.exists)
      .map((doc) => doc.data()?.displayName || 'Unknown');
  } catch (error) {
    console.error('Error fetching participant names:', error);
    return [];
  }
}

/**
 * Get sender name from user ID
 */
export async function getSenderName(userId: string): Promise<string> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data()?.displayName || 'Unknown' : 'Unknown';
  } catch (error) {
    console.error('Error fetching sender name:', error);
    return 'Unknown';
  }
}
```

**Deliverable**: Context retrieval utilities

---

### Task 2.2: Translation Cloud Function

#### 2.2.1 Create Callable Function

**File**: `functions/src/index.ts` (add to existing exports)
```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { openaiApiKey, getOpenAIKey } from './config';
import { translateText, TranslationRequestSchema } from './agents/translationAgent';
import {
  getConversationContext,
  getParticipantNames,
  getSenderName,
} from './services/contextRetrieval';
import { checkRateLimit, RATE_LIMITS } from './utils/rateLimit';
import { logFunctionCall } from './utils/logger';

/**
 * Translation Cloud Function
 *
 * Translates text with conversation context awareness
 */
export const translateMessage = onCall(
  {
    secrets: [openaiApiKey],
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const startTime = Date.now();

    // Authentication check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;

    try {
      // Rate limiting
      await checkRateLimit(userId, 'translateMessage', RATE_LIMITS.AI_FUNCTION_FREE_TIER);

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
        if (!participants.includes(userId)) {
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
      if (!translationRequest.context?.senderName) {
        const senderName = await getSenderName(userId);
        if (!translationRequest.context) {
          translationRequest.context = {};
        }
        translationRequest.context.senderName = senderName;
      }

      // Perform translation
      const result = await translateText(translationRequest);

      // Log metrics
      logFunctionCall({
        functionName: 'translateMessage',
        userId,
        duration: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Error in translateMessage:', error);

      logFunctionCall({
        functionName: 'translateMessage',
        userId,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Translation error: ${error.message}`);
    }
  }
);
```

**Deliverable**: Translation Cloud Function

---

#### 2.2.2 Test with Emulator

**Test script** (`functions/test/translation.test.ts`):
```typescript
import { translateMessage } from '../src/index';

// Test cases
const testCases = [
  {
    name: 'Simple Spanish translation',
    input: {
      text: 'Hello, how are you?',
      targetLanguage: 'Spanish',
    },
    expectedContains: 'Hola',
  },
  {
    name: 'French translation with formality',
    input: {
      text: 'Can you help me with this?',
      targetLanguage: 'French',
      formalityLevel: 'formal',
    },
    expectedContains: 'vous',
  },
  {
    name: 'Japanese translation with idiom',
    input: {
      text: "It's raining cats and dogs",
      targetLanguage: 'Japanese',
    },
    expectsIdiomExplanation: true,
  },
];

// Run tests (manual for now, could use Jest)
async function runTests() {
  console.log('Running translation tests...\n');

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    // Test logic here
  }
}
```

**Manual testing with emulator**:
```bash
# Start emulator
npm run functions:dev

# In functions shell
firebase functions:shell

# Test
translateMessage({
  text: "Hello, how are you?",
  targetLanguage: "Spanish"
})
```

**Deliverable**: Tested translation function

---

### Task 2.3: Client Integration

#### 2.3.1 Create Translation Service

**File**: `services/ai.ts` (extend existing)
```typescript
import type { TranslationRequest, TranslationResponse } from '../types/ai';

/**
 * Translate text using AI
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
    throw new Error(error.message || 'Translation failed');
  }
};
```

**Add types** (`types/ai.ts`):
```typescript
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
```

**Deliverable**: Translation service

---

#### 2.3.2 Add UI for Translation

**Component**: `components/ai/TranslationModal.tsx`
```typescript
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { translateMessage } from '../../services/ai';
import type { TranslationRequest, TranslationResponse } from '../../types/ai';

interface TranslationModalProps {
  visible: boolean;
  onClose: () => void;
  initialText?: string;
  conversationId?: string;
}

const LANGUAGES = [
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Chinese',
  'Korean',
  'Russian',
  'Arabic',
];

export default function TranslationModal({
  visible,
  onClose,
  initialText = '',
  conversationId,
}: TranslationModalProps) {
  const [text, setText] = useState(initialText);
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [error, setError] = useState('');

  const handleTranslate = async () => {
    if (!text.trim()) {
      setError('Please enter text to translate');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const request: TranslationRequest = {
        text: text.trim(),
        targetLanguage,
        context: conversationId ? { conversationId } : undefined,
      };

      const response = await translateMessage(request);
      setResult(response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Translate Message</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Enter text to translate..."
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Target Language</Text>
          <View style={styles.languageGrid}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.languageButton,
                  targetLanguage === lang && styles.languageButtonActive,
                ]}
                onPress={() => setTargetLanguage(lang)}
              >
                <Text
                  style={[
                    styles.languageButtonText,
                    targetLanguage === lang && styles.languageButtonTextActive,
                  ]}
                >
                  {lang}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.translateButton}
            onPress={handleTranslate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.translateButtonText}>Translate</Text>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Translation:</Text>
              <Text style={styles.resultText}>{result.translatedText}</Text>

              <View style={styles.metadata}>
                <Text style={styles.metadataText}>
                  {result.sourceLanguage} → {result.targetLanguage}
                </Text>
                <Text style={styles.metadataText}>
                  Confidence: {(result.confidence * 100).toFixed(0)}%
                </Text>
              </View>

              {result.alternatives && result.alternatives.length > 0 && (
                <View style={styles.alternatives}>
                  <Text style={styles.alternativesLabel}>Alternatives:</Text>
                  {result.alternatives.map((alt, i) => (
                    <Text key={i} style={styles.alternativeText}>
                      • {alt}
                    </Text>
                  ))}
                </View>
              )}

              {result.culturalNotes && (
                <View style={styles.notes}>
                  <Text style={styles.notesLabel}>Cultural Notes:</Text>
                  <Text style={styles.notesText}>{result.culturalNotes}</Text>
                </View>
              )}

              {result.idiomExplanations && result.idiomExplanations.length > 0 && (
                <View style={styles.notes}>
                  <Text style={styles.notesLabel}>Idioms Detected:</Text>
                  {result.idiomExplanations.map((idiom, i) => (
                    <Text key={i} style={styles.notesText}>
                      • {idiom}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  languageButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  languageButtonText: {
    color: '#333',
    fontSize: 14,
  },
  languageButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  translateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  translateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#fee',
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#c00',
  },
  resultBox: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 12,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginBottom: 12,
  },
  metadataText: {
    fontSize: 12,
    color: '#666',
  },
  alternatives: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  alternativesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  alternativeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  notes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
```

**Integrate into chat screen** (`app/chat/[id].tsx`):
```typescript
import { useState } from 'react';
import TranslationModal from '../../components/ai/TranslationModal';

export default function ChatScreen() {
  const [showTranslation, setShowTranslation] = useState(false);
  const [textToTranslate, setTextToTranslate] = useState('');

  // Add to message long-press menu
  const handleMessageLongPress = (message: Message) => {
    Alert.alert('Message Options', '', [
      {
        text: 'Translate',
        onPress: () => {
          setTextToTranslate(message.text);
          setShowTranslation(true);
        },
      },
      // ... other options
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Existing chat UI */}

      <TranslationModal
        visible={showTranslation}
        onClose={() => setShowTranslation(false)}
        initialText={textToTranslate}
        conversationId={conversationId}
      />
    </View>
  );
}
```

**Deliverable**: Working translation UI in chat

---

### Task 2.4: Documentation as Template

#### 2.4.1 Create Agent Template Doc

**File**: `functions/docs/agent-template.md`
```markdown
# AI Agent Template

This template shows how to create new AI agents following the translation agent pattern.

## Structure

```
functions/src/
├── agents/
│   └── yourAgent.ts         # Agent logic
├── services/
│   └── contextRetrieval.ts  # Shared context utilities
├── utils/
│   ├── rateLimit.ts         # Shared rate limiting
│   └── logger.ts            # Shared logging
└── index.ts                 # Export cloud function
```

## Step-by-Step Guide

### 1. Create Agent File

```typescript
// agents/yourAgent.ts
export interface YourAgentRequest {
  // Define inputs
}

export interface YourAgentResponse {
  // Define outputs
}

export async function processYourTask(
  request: YourAgentRequest
): Promise<YourAgentResponse> {
  // 1. Build prompt
  // 2. Call LLM
  // 3. Parse response
  // 4. Return result
}
```

### 2. Create Cloud Function

```typescript
// index.ts
export const yourFunction = onCall(
  { secrets: [openaiApiKey] },
  async (request) => {
    // 1. Auth check
    // 2. Rate limit
    // 3. Validate input
    // 4. Fetch context (if needed)
    // 5. Call agent
    // 6. Log metrics
    // 7. Return result
  }
);
```

### 3. Create Client Service

```typescript
// services/ai.ts
export const callYourFunction = async (
  request: YourAgentRequest
): Promise<YourAgentResponse> => {
  const callable = httpsCallable(functions, 'yourFunction');
  const result = await callable(request);
  return result.data;
};
```

### 4. Create UI Component

```typescript
// components/ai/YourComponent.tsx
// Follow TranslationModal pattern
```

## Best Practices

- Always validate inputs with Zod
- Always implement rate limiting
- Always log metrics for cost tracking
- Always provide loading/error states in UI
- Always test locally before deploying
- Always add context when available
```

**Deliverable**: Agent template documentation

---

### Tier 2 Acceptance Criteria

- [ ] AI SDK installed and configured
- [ ] Translation agent implemented with context awareness
- [ ] Context retrieval works (recent messages, participants)
- [ ] Cloud Function tested locally and deployed
- [ ] UI integrated in chat (long-press → translate)
- [ ] Translation shows alternatives, cultural notes, idioms
- [ ] Template documentation created for future agents
- [ ] All patterns documented and reusable

**Estimated Completion**: 5-7 days

---

## Tier 3: Multi-Agent Extension Strategy

**Goal**: Outline how to extend the translation agent pattern to implement all required AI features (summarization, action extraction, etc.).

**Duration**: Planning phase (1-2 days), then ongoing implementation

### Overview

Now that we have a working translation agent as a template, we can rapidly implement the other AI features using the same patterns.

---

### Extension Roadmap

#### Phase 3.1: Summarization Agent (Week 1)

**Similar to translation agent**:
- Follow same Cloud Function pattern
- Use context retrieval for conversation messages
- Different prompt/LLM call
- Similar UI (modal with summary)

**File**: `functions/src/agents/summarizationAgent.ts`
```typescript
export async function summarizeConversation(
  request: SummarizationRequest
): Promise<SummarizationResponse> {
  // 1. Fetch messages (reuse context retrieval)
  // 2. Build summarization prompt
  // 3. Call GPT-4-turbo (needs more context than GPT-3.5)
  // 4. Parse structured response (summary + key points)
  // 5. Return result
}
```

**Reusable**:
- ✅ Context retrieval service
- ✅ Rate limiting
- ✅ Logging
- ✅ Cloud Function pattern
- ✅ Client service pattern
- ✅ Modal UI pattern

**New**:
- Different prompt
- Different response schema
- Caching strategy (summary doesn't change unless new messages)

**Estimated Time**: 2-3 days

---

#### Phase 3.2: Action Item Extraction Agent (Week 2)

**Similar to translation agent**:
- Same Cloud Function pattern
- Conversation context retrieval
- Structured JSON response

**File**: `functions/src/agents/actionItemAgent.ts`
```typescript
export async function extractActionItems(
  request: ActionItemRequest
): Promise<ActionItemResponse> {
  // 1. Fetch messages with timestamps
  // 2. Build extraction prompt (focus on tasks, deadlines, assignments)
  // 3. Call GPT-4-turbo
  // 4. Parse action items array
  // 5. Store in Firestore (new collection)
  // 6. Return result
}
```

**Additional Work**:
- New Firestore collection: `conversations/{id}/actionItems/{itemId}`
- UI for action item list
- Ability to mark items as complete
- Link action items to source messages

**Reusable**:
- ✅ All infrastructure from translation agent
- ✅ Context retrieval
- ✅ Cloud Function boilerplate

**Estimated Time**: 3-4 days

---

#### Phase 3.3: Smart Search with Embeddings (Week 3-4)

**Different from translation agent**:
- Requires embeddings (vector search)
- Background processing (generate embeddings on message create)
- Different LLM usage (embeddings API, not chat completions)

**New Cloud Functions**:

**1. Generate Embedding (Firestore Trigger)**:
```typescript
// functions/src/triggers/generateEmbedding.ts
export const onMessageCreated = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot) => {
    // 1. Get message text
    // 2. Call OpenAI embeddings API
    // 3. Store embedding in message document
  });
```

**2. Smart Search (Callable)**:
```typescript
// functions/src/agents/searchAgent.ts
export async function smartSearch(
  request: SearchRequest
): Promise<SearchResponse> {
  // 1. Generate query embedding
  // 2. Compute similarity with all message embeddings (Firestore query)
  // 3. Rank results
  // 4. Return top N matches
}
```

**Reusable**:
- ✅ Cloud Function patterns
- ✅ Rate limiting
- ✅ Logging

**New Infrastructure**:
- Firestore trigger for background processing
- Embedding storage in message documents
- Vector similarity computation

**Estimated Time**: 4-5 days

---

#### Phase 3.4: Priority Detection Agent (Week 5)

**Similar to action item extraction**:
- Classify messages in real-time
- Use lightweight model (GPT-3.5-turbo)
- Store priority in message document

**File**: `functions/src/agents/priorityAgent.ts`
```typescript
export async function detectPriority(
  messageText: string
): Promise<PriorityClassification> {
  // 1. Build classification prompt (simple, fast)
  // 2. Call GPT-3.5-turbo
  // 3. Return priority level + reason
}
```

**Cloud Function** (Firestore Trigger):
```typescript
export const onMessageCreatedPriority = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot) => {
    // 1. Get message text
    // 2. Call priority agent
    // 3. Update message document with priority
    // 4. If high priority, send notification
  });
```

**Reusable**:
- ✅ All patterns
- ✅ Notification service (already exists)

**Estimated Time**: 2-3 days

---

#### Phase 3.5: Decision Tracking Agent (Week 6)

**Similar to action item extraction**:
- Extracts decisions from conversations
- Stores in new collection
- Links to related action items

**File**: `functions/src/agents/decisionAgent.ts`
```typescript
export async function extractDecisions(
  request: DecisionRequest
): Promise<DecisionResponse> {
  // Similar to action items
  // Different prompt focusing on decisions/agreements
}
```

**Reusable**:
- ✅ All patterns from action items

**Estimated Time**: 2-3 days

---

#### Phase 3.6: Proactive Assistant (Week 7-9)

**Most Complex**:
- Multi-agent orchestration
- Scheduled background jobs
- Learning/personalization
- New UI (AI assistant chat)

**Agents**:
1. **Scheduling Agent** - Detects meeting needs, suggests times
2. **Reminder Agent** - Monitors deadlines, sends reminders
3. **Insight Agent** - Analyzes patterns, generates insights
4. **Recommendation Agent** - Suggests next actions

**Orchestration** (similar to translation, but coordinating multiple agents):
```typescript
// functions/src/agents/orchestrator.ts
export async function runProactiveAgents(userId: string) {
  // 1. Check user preferences
  // 2. Run enabled agents
  // 3. Collect suggestions
  // 4. Send to AI assistant chat
}
```

**New Infrastructure**:
- Scheduled Cloud Functions (Pub/Sub)
- AI assistant conversation collection
- User preferences collection

**Reusable**:
- ✅ Agent patterns
- ✅ Cloud Function patterns
- ✅ Context retrieval

**Estimated Time**: 7-10 days

---

### Key Patterns Established by Translation Agent

✅ **Cloud Function Structure**:
```typescript
export const functionName = onCall(
  { secrets: [openaiApiKey] },
  async (request) => {
    // 1. Auth
    // 2. Rate limit
    // 3. Validate
    // 4. Fetch context
    // 5. Call agent
    // 6. Log
    // 7. Return
  }
);
```

✅ **Agent Structure**:
```typescript
export async function agentFunction(request): Promise<response> {
  // 1. Build prompt
  // 2. Call LLM (AI SDK)
  // 3. Parse response
  // 4. Return structured data
}
```

✅ **Client Service**:
```typescript
export const callFunction = async (request) => {
  const callable = httpsCallable(functions, 'functionName');
  const result = await callable(request);
  return result.data;
};
```

✅ **UI Component**:
```typescript
export default function Component() {
  // 1. State management (loading, error, result)
  // 2. Call service function
  // 3. Display results
  // 4. Handle errors
}
```

---

### Velocity Estimates

Based on translation agent as baseline (5-7 days):

| Feature | Similarity | Estimated Days |
|---------|-----------|----------------|
| Translation Agent | 100% (baseline) | 5-7 days |
| Summarization | 90% similar | 2-3 days |
| Action Extraction | 90% similar | 3-4 days |
| Priority Detection | 80% similar | 2-3 days |
| Decision Tracking | 90% similar | 2-3 days |
| Smart Search | 60% similar (new: embeddings) | 4-5 days |
| Proactive Assistant | 50% similar (new: orchestration) | 7-10 days |

**Total**: ~25-35 days for all features after translation agent complete

---

### Quick Wins After Translation Agent

**Week 1 Post-Translation**:
- [ ] Summarization (quick, reuse everything)
- [ ] Priority Detection (quick, simple classification)

**Week 2 Post-Translation**:
- [ ] Action Item Extraction (similar to translation)
- [ ] Decision Tracking (similar to action items)

**Week 3-4 Post-Translation**:
- [ ] Smart Search (new: embeddings infrastructure)

**Week 5-7 Post-Translation**:
- [ ] Proactive Assistant (complex: multi-agent)

---

### Tier 3 Deliverables

- [ ] Extension roadmap documented
- [ ] Velocity estimates per feature
- [ ] Reusable patterns identified
- [ ] Quick wins prioritized
- [ ] Implementation order established
- [ ] Risk areas identified (embeddings, orchestration)

**Estimated Completion**: 1-2 days planning, then 25-35 days implementation

---

## Development Workflow

### Daily Development Cycle

**Local Development**:
```bash
# Terminal 1: Start emulator
npm run functions:dev

# Terminal 2: Start mobile app
npm start

# Terminal 3: Watch function logs
firebase emulators:logs
```

**Testing Cycle**:
1. Write/modify function code
2. Rebuild: `cd functions && npm run build`
3. Test in emulator (auto-reloads)
4. Test in mobile app (connected to emulator)
5. Check logs for errors/metrics
6. Iterate

**Deployment Cycle**:
1. Test thoroughly locally
2. Deploy to Firebase: `npm run functions:deploy`
3. Update mobile app to use production (turn off emulator)
4. Test production
5. Monitor logs: `npm run functions:logs`

---

## Testing Strategy

### Unit Tests (Functions)

**Setup** (`functions/package.json`):
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

**Example test** (`functions/test/translationAgent.test.ts`):
```typescript
import { translateText } from '../src/agents/translationAgent';

describe('Translation Agent', () => {
  it('translates English to Spanish', async () => {
    const result = await translateText({
      text: 'Hello',
      targetLanguage: 'Spanish',
    });

    expect(result.translatedText).toContain('Hola');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  // More tests...
});
```

---

### Integration Tests (E2E)

**Manual testing checklist**:
- [ ] Function callable from mobile app
- [ ] Rate limiting works (exceed limit, get error)
- [ ] Authentication required (call without auth, get error)
- [ ] Context retrieval works (translation uses conversation context)
- [ ] Error handling works (invalid input, get clear error)
- [ ] Cost logging works (check logs for token usage)

---

### Load Testing

**Test rate limiting and costs**:
```typescript
// Test script
async function loadTest() {
  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(translateMessage({ text: 'Hello', targetLanguage: 'Spanish' }));
  }
  await Promise.all(promises);
}
```

**Monitor**:
- Response times
- Error rates
- Token usage
- Costs

---

## Metrics & Monitoring

### Cloud Function Metrics

**Firebase Console**:
- Invocations
- Execution time
- Error rate
- Memory usage

**Custom Logging**:
```typescript
logger.info('Function metrics', {
  functionName: 'translateMessage',
  userId: 'abc123',
  inputTokens: 50,
  outputTokens: 100,
  cost: 0.001,
  duration: 1500,
  success: true,
});
```

### Cost Monitoring

**Weekly Review**:
1. Check Firebase Console → Functions → Usage
2. Review custom logs for token usage
3. Calculate costs: tokens × pricing
4. Compare to budget: $1.30/user/month

**Alerts** (manual for now, could automate):
- If costs exceed $X/day, investigate
- If error rate > 5%, investigate
- If avg response time > 10s, investigate

---

## Summary

This 3-tier plan provides:

1. **Tier 1**: Solid foundation (Cloud Functions + secrets + hello world)
2. **Tier 2**: Reusable template (translation agent with full integration)
3. **Tier 3**: Rapid expansion (all other features using template)

**Timeline**:
- Tier 1: 3-5 days
- Tier 2: 5-7 days
- Tier 3: 25-35 days (implementation)

**Total**: ~35-50 days for all AI features

By completing Tier 1 and Tier 2 first, we establish patterns that make Tier 3 implementation much faster and more consistent.

---

**Next Steps**:
1. Begin Tier 1: Cloud Functions setup
2. Complete Tier 2: Translation agent
3. Review and refine patterns
4. Execute Tier 3: Remaining features

**Document Version**: 1.0
**Date**: 2025-10-22
**Status**: Ready for Implementation
