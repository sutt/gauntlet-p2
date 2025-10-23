# AI Service Architecture

**Last Updated:** 2025-10-23
**Status:** Production
**Milestone:** Tier 2 - Translation Agent Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Current AI Agents](#current-ai-agents)
4. [Implementation Details](#implementation-details)
5. [Gotchas & Common Errors](#gotchas--common-errors)
6. [Best Practices](#best-practices)
7. [Future Considerations](#future-considerations)

---

## Overview

The AI service provides intelligent features powered by OpenAI's GPT models through Firebase Cloud Functions. The service is designed to be:

- **Context-aware**: Agents can access conversation history and user data
- **Scalable**: Cloud Functions auto-scale based on demand
- **Secure**: User authentication and data access controls built-in
- **Type-safe**: Full TypeScript support across client and server

### Key Technologies

- **OpenAI API**: GPT-3.5-turbo (testing), GPT-4-turbo (production)
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai`): Unified LLM interface
- **Firebase Cloud Functions v2**: Serverless compute on Cloud Run
- **Firebase Admin SDK**: Server-side Firestore access
- **Zod**: Schema validation for function inputs

---

## Architecture

### High-Level Flow

```
Mobile App (Client)
    ↓
services/ai.ts (httpsCallable)
    ↓
Firebase Cloud Functions v2
    ↓
    ├─→ agents/translationAgent.ts (AI SDK)
    │       ↓
    │   OpenAI GPT-4-turbo
    │
    └─→ services/contextRetrieval.ts
            ↓
        Firestore (conversation data)
```

### Directory Structure

```
hello-expo/
├── types/ai.ts                    # Shared TypeScript types (client + server)
├── services/ai.ts                 # Client-side service functions
├── components/TranslationModal.tsx # UI components
└── functions/
    ├── src/
    │   ├── index.ts               # Cloud Function exports
    │   ├── config.ts              # Secret management
    │   ├── agents/
    │   │   └── translationAgent.ts # AI agent logic
    │   └── services/
    │       └── contextRetrieval.ts # Firestore helpers
    ├── .env.local                 # Local development secrets (NOT deployed)
    └── package.json               # Functions dependencies
```

---

## Current AI Agents

### 1. Hello World AI (helloWorldAI)

**Purpose:** Simple test agent to verify Cloud Functions + OpenAI setup.

**Features:**
- Basic OpenAI API integration
- Authentication check
- Error handling demonstration

**Model:** GPT-3.5-turbo
**Location:** `functions/src/index.ts:26-131`

**Request:**
```typescript
interface HelloWorldRequest {
  message: string;
}
```

**Response:**
```typescript
interface HelloWorldResponse {
  success: boolean;
  input: string;
  output: string;
  timestamp: string;
  userId: string;
  model: string;
}
```

### 2. Translation Agent (translateMessage)

**Purpose:** Context-aware message translation with cultural understanding.

**Features:**
- Auto-detect source language
- Context-aware translation using conversation history
- Alternative translations
- Cultural notes and idiom explanations
- Formality level control (formal/informal/auto)

**Model:** GPT-4-turbo
**Location:** `functions/src/index.ts:145-238` + `functions/src/agents/translationAgent.ts`

**Request:**
```typescript
interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  context?: {
    conversationId?: string;
    recentMessages?: string[];
    senderName?: string;
    recipientNames?: string[];
  };
  formalityLevel?: 'formal' | 'informal' | 'auto';
}
```

**Response:**
```typescript
interface TranslationResponse {
  success: boolean;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;           // 0-1
  alternatives?: string[];
  culturalNotes?: string;
  idiomExplanations?: string[];
  formalityLevel: string;
  timestamp: string;
}
```

**Context Retrieval:**
- Fetches last 5 messages from conversation
- Gets participant display names
- Verifies user has access to conversation

---

## Implementation Details

### Secret Management

**Local Development (Emulator):**
- Secrets stored in `functions/.env.local`
- Loaded via `dotenv` package
- **NEVER** committed to git (in `.gitignore`)

**Production:**
- Secrets stored in Firebase Secret Manager
- Accessed via `firebase-functions/params`
- Set with: `firebase functions:secrets:set OPENAI_API_KEY`

**Key Pattern:**
```typescript
// functions/src/config.ts
import { defineSecret } from 'firebase-functions/params';
import * as dotenv from 'dotenv';

// Load .env.local in emulator mode
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
}

export const openaiApiKey = defineSecret('OPENAI_API_KEY');

export const getOpenAIKey = (): string => {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return process.env.OPENAI_API_KEY || '';
  }
  return openaiApiKey.value();
};
```

### Firebase Admin Initialization

**Critical for Functions Shell & Firestore Access:**

```typescript
// functions/src/index.ts
import { initializeApp } from 'firebase-admin/app';

// MUST be called before any getFirestore() calls
initializeApp();
```

**Why this is needed:**
- Firebase Functions v2 auto-initializes in production
- But NOT in Functions shell or when importing modules
- Any module-level `getFirestore()` calls will fail without explicit init

**Solution:**
- Call `initializeApp()` at top of `index.ts`
- Call `getFirestore()` **inside functions**, not at module level

**Example (CORRECT):**
```typescript
// services/contextRetrieval.ts
export async function getConversationContext(conversationId: string) {
  const db = getFirestore(); // ✅ Called inside function
  // ... rest of code
}
```

**Example (WRONG):**
```typescript
// services/contextRetrieval.ts
const db = getFirestore(); // ❌ Called at module level - will fail in shell

export async function getConversationContext(conversationId: string) {
  // ... rest of code
}
```

### AI SDK Configuration

**Correct Usage (v5+):**

```typescript
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const apiKey = getOpenAIKey();
const openai = createOpenAI({ apiKey });

const { text: responseText } = await generateText({
  model: openai('gpt-4-turbo'),
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.3,
  // Note: maxTokens removed in newer versions
});
```

**Key Points:**
- Use `createOpenAI({ apiKey })` to create provider instance
- Pass model via `openai('model-name')`
- `maxTokens` parameter deprecated in v5 (removed from our code)
- Temperature controls randomness (0.3 for consistent translations)

### Authentication & Security

**Authentication Check Pattern:**

```typescript
export const translateMessage = onCall(
  {
    secrets: [openaiApiKey],
    invoker: 'public', // Allows HTTP calls
    cors: ['http://localhost:8081', 'http://localhost:19006'], // Dev mode
  },
  async (request) => {
    // Optional auth bypass for shell testing
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';

    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth?.uid || 'shell-test-user';
    // ... rest of function
  }
);
```

**Security Layers:**
1. **Function-level auth**: Check `request.auth` for user identity
2. **Data access control**: Verify user has permission to access conversation
3. **Input validation**: Use Zod schemas to validate request data
4. **CORS**: Limit to known origins (dev servers + production domains)

**IMPORTANT:** `invoker: 'public'` does NOT bypass authentication!
- It only allows HTTP access to the Cloud Run service
- Authentication is still enforced in the function code
- This is required for Firebase client SDK to call the function

---

## Gotchas & Common Errors

### 1. ❌ "The default Firebase app does not exist"

**Symptoms:**
```
FirebaseAppError: The default Firebase app does not exist.
Make sure you call initializeApp() before using any of the Firebase services.
```

**Cause:**
- Calling `getFirestore()` at module level before `initializeApp()`
- Usually happens in Functions shell or when importing modules

**Solution:**
- Add `initializeApp()` at top of `functions/src/index.ts`
- Move `getFirestore()` calls **inside** functions, not at module level

**See:** [Implementation Details → Firebase Admin Initialization](#firebase-admin-initialization)

---

### 2. ❌ "Secret environment variable overlaps"

**Symptoms:**
```
Error: Secret environment variable overlaps non secret environment variable: OPENAI_API_KEY
```

**Cause:**
- Firebase CLI auto-loads `.env` files during deployment
- Conflicts with Firebase Secret Manager

**Solution:**
- Rename `functions/.env` → `functions/.env.local`
- Add to `functions/.gcloudignore`:
  ```
  .env
  .env.*
  !.env.example
  ```
- Explicitly load in code:
  ```typescript
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
  ```

---

### 3. ❌ "401 Unauthorized" in Production

**Symptoms:**
```
Error: 401 Unauthorized - The request was not authorized to invoke this service
```

**Cause:**
- Cloud Run (underlying Functions v2 infrastructure) blocks unauthenticated HTTP by default
- `invoker: 'public'` wasn't set initially

**Solution:**
- Add `invoker: 'public'` to function config
- This is automatically configured on deploy now
- Manual IAM command (if needed):
  ```bash
  gcloud run services add-iam-policy-binding FUNCTION_NAME \
    --region=us-central1 \
    --member=allUsers \
    --role=roles/run.invoker
  ```

**Note:** This was an issue with `helloWorldAI` but seems resolved in newer deployments. `translateMessage` worked immediately without manual IAM changes.

---

### 4. ❌ CORS Errors in Browser

**Symptoms:**
```
Access to fetch at '...' from origin 'http://localhost:8081' has been blocked by CORS policy
```

**Cause:**
- Cloud Functions require explicit CORS configuration for browser access
- Expo web mode runs in browser, needs CORS

**Solution:**
```typescript
export const translateMessage = onCall(
  {
    cors: [
      'http://localhost:8081',  // Expo web dev
      'http://localhost:19006', // Alternative Expo port
      /^https:\/\/.*\.vercel\.app$/, // Production domains
    ],
  },
  async (request) => { /* ... */ }
);
```

**Important:** Native mobile apps (iOS/Android) do NOT need CORS - this is only for web browsers.

---

### 5. ❌ TypeScript Errors with AI SDK

**Symptoms:**
```
error TS2353: Object literal may only specify known properties, and 'maxTokens' does not exist
error TS2554: Expected 1 arguments, but got 2 (for openai())
```

**Cause:**
- AI SDK v5 changed API significantly
- Old patterns from v4 don't work

**Solution:**
- Use `createOpenAI({ apiKey })` instead of `openai(model, { apiKey })`
- Remove `maxTokens` parameter (deprecated in v5)
- Check AI SDK docs for current version

---

### 6. ⚠️ Shell Testing Authentication

**Challenge:**
Functions shell doesn't provide `request.auth` by default.

**Solution:**
Add optional auth bypass for development:

```typescript
// functions/.env.local
DISABLE_AUTH_CHECK=true  // Only for shell testing!

// functions/src/index.ts
const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';
if (!disableAuthCheck && !request.auth) {
  throw new HttpsError('unauthenticated', 'Must be authenticated');
}
```

**Shell Usage:**
```bash
npm run functions:shell

# In shell:
translateMessage({data: {text: "Hello", targetLanguage: "Spanish"}})
```

**⚠️ WARNING:** NEVER set `DISABLE_AUTH_CHECK=true` in production! Only use in local `.env.local` file.

---

### 7. ⚠️ WSL2 Networking Issues

**Challenge:**
Android devices can't reach emulators running in WSL2 due to virtual networking.

**Symptoms:**
- Emulators work in browser
- Android app can't connect to `localhost` or local IP

**Solutions:**

**Option A: Port Forwarding (Complex)**
- Forward Windows ports to WSL2 IP
- Configure Windows Firewall rules
- Not recommended for daily development

**Option B: Use Production (Simple)**
- Test in browser with emulators (`EXPO_PUBLIC_USE_EMULATOR=true`)
- Test on Android with production Firebase (`EXPO_PUBLIC_USE_EMULATOR=false`)
- Deploy functions to test on device

**Recommendation:** Option B is simpler and what we use.

---

### 8. ⚠️ Context Retrieval Performance

**Potential Issue:**
Fetching conversation context adds latency to translation requests.

**Current Implementation:**
- Fetches last 5 messages
- Fetches participant names
- All done sequentially

**Future Optimization:**
- Use `Promise.all()` to parallelize fetches
- Cache participant names (rarely change)
- Limit context to X messages or Y characters

**Example:**
```typescript
// Current (sequential)
const recentMessages = await getConversationContext(conversationId, 5);
const participantNames = await getParticipantNames(conversationId);

// Optimized (parallel)
const [recentMessages, participantNames] = await Promise.all([
  getConversationContext(conversationId, 5),
  getParticipantNames(conversationId),
]);
```

---

## Best Practices

### Adding a New AI Agent

Follow this pattern when adding new agents:

#### 1. **Define Types** (`types/ai.ts`)

```typescript
export interface NewAgentRequest {
  input: string;
  // ... other params
}

export interface NewAgentResponse {
  success: boolean;
  output: string;
  // ... other fields
  timestamp: string;
}
```

#### 2. **Create Agent Logic** (`functions/src/agents/newAgent.ts`)

```typescript
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getOpenAIKey } from '../config';

export const NewAgentRequestSchema = z.object({
  input: z.string().min(1).max(5000),
  // ... validation rules
});

export async function performTask(request: NewAgentRequest): Promise<NewAgentResponse> {
  const apiKey = getOpenAIKey();
  const openai = createOpenAI({ apiKey });

  const { text: responseText } = await generateText({
    model: openai('gpt-4-turbo'),
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: buildPrompt(request) }
    ],
    temperature: 0.7,
  });

  return {
    success: true,
    output: responseText,
    timestamp: new Date().toISOString(),
  };
}
```

#### 3. **Create Cloud Function** (`functions/src/index.ts`)

```typescript
import { performTask, NewAgentRequestSchema } from './agents/newAgent';

export const newAgent = onCall(
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
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';
    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const validationResult = NewAgentRequestSchema.safeParse(request.data);
    if (!validationResult.success) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid request: ${validationResult.error.message}`
      );
    }

    try {
      const result = await performTask(validationResult.data);
      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Error in newAgent:', error);
      throw new HttpsError('internal', `Agent error: ${error.message}`);
    }
  }
);
```

#### 4. **Add Client Service** (`services/ai.ts`)

```typescript
import type { NewAgentRequest, NewAgentResponse } from '../types/ai';

export const callNewAgent = async (request: NewAgentRequest): Promise<NewAgentResponse> => {
  const callable = httpsCallable<NewAgentRequest, NewAgentResponse>(
    functions,
    'newAgent'
  );

  try {
    const result = await callable(request);
    return result.data;
  } catch (error: any) {
    console.error('Error calling newAgent:', error);
    throw new Error(error.message || 'Agent call failed');
  }
};
```

#### 5. **Deploy & Test**

```bash
# Build and deploy
npm run functions:deploy

# Test in shell (optional)
npm run functions:shell
# newAgent({data: {input: "test"}})

# Test in app
# (Create test UI or integrate into existing screens)
```

---

### Prompt Engineering Tips

1. **Be Specific:**
   - Clearly define the task and output format
   - Use structured output (JSON) for consistency

2. **Provide Context:**
   - Include relevant information in system message
   - Add examples if needed (few-shot learning)

3. **Control Output:**
   - Use lower temperature (0.3) for deterministic tasks
   - Use higher temperature (0.7-0.9) for creative tasks
   - Set reasonable token limits

4. **Handle Errors:**
   - Always parse JSON responses with try-catch
   - Provide fallback values
   - Log errors for debugging

5. **Test Thoroughly:**
   - Test edge cases (empty input, very long input)
   - Test different languages (for translation)
   - Monitor costs (tokens used per request)

---

### Security Checklist

- [ ] Authentication check in Cloud Function
- [ ] Input validation with Zod schema
- [ ] User permission verification (for Firestore access)
- [ ] CORS configuration for production domains
- [ ] Secret stored in Secret Manager (not in code)
- [ ] Error messages don't leak sensitive data
- [ ] Rate limiting considered (if needed)
- [ ] Audit logging for sensitive operations

---

## Future Considerations

### Planned Features (from tasks-ait.md)

1. **Tier 3: Smart Replies**
   - Suggest contextual message responses
   - Tone matching (formal/casual)
   - Multi-language support

2. **Tier 4: Message Summarization**
   - Summarize long conversation threads
   - Extract action items
   - Timeline view

3. **Tier 5: Sentiment Analysis**
   - Detect message tone
   - Conflict detection
   - Engagement metrics

### Architectural Improvements

1. **Agent Registry:**
   - Centralized agent configuration
   - Dynamic agent loading
   - Version management

2. **Caching Layer:**
   - Cache participant names
   - Cache recent translations
   - Reduce Firestore reads

3. **Streaming Responses:**
   - Use AI SDK streaming for long responses
   - Real-time translation updates
   - Better UX for slow agents

4. **Cost Optimization:**
   - Use GPT-3.5-turbo for simpler tasks
   - Implement request batching
   - Monitor token usage per user
   - Set per-user rate limits

5. **Observability:**
   - Structured logging
   - Performance metrics
   - Error tracking (Sentry)
   - Cost tracking per agent

### Testing Strategy

1. **Unit Tests:**
   - Test agent logic in isolation
   - Mock OpenAI API calls
   - Test edge cases

2. **Integration Tests:**
   - Test full Cloud Function flow
   - Test Firestore access
   - Test authentication

3. **E2E Tests:**
   - Test from mobile app
   - Test all user flows
   - Test error handling

---

## Useful Commands

```bash
# Local Development
npm run functions:dev          # Start emulators with functions
npm run functions:shell        # Interactive shell for testing

# Building
npm run functions:build        # Build TypeScript

# Deployment
npm run functions:deploy       # Deploy all functions
firebase deploy --only functions:translateMessage  # Deploy single function

# Logs
npm run functions:logs         # View all function logs
firebase functions:log --only translateMessage    # View specific function

# Secrets
firebase functions:secrets:set OPENAI_API_KEY     # Set secret
firebase functions:secrets:access OPENAI_API_KEY  # View secret value
firebase functions:secrets:prune                  # Clean up old versions

# Debugging
firebase emulators:start --inspect-functions     # Enable debugging
```

---

## Resources

- [Firebase Cloud Functions v2 Docs](https://firebase.google.com/docs/functions/2nd-gen)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Zod Documentation](https://zod.dev/)
- [Firebase Secret Manager](https://firebase.google.com/docs/functions/config-env?gen=2nd#secret-manager)

---

## Changelog

**2025-10-23:**
- Initial documentation
- Documented Translation Agent implementation
- Added gotchas and common errors
- Added best practices and future considerations
