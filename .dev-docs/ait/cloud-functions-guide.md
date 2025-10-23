# Cloud Functions Development Guide

**Version**: 1.0
**Date**: 2025-10-23
**Status**: Production-Ready

This guide documents how to develop, test, and deploy Firebase Cloud Functions for AI features, including common issues and solutions encountered during Tier 1 implementation.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Local Development](#local-development)
3. [Creating New Functions](#creating-new-functions)
4. [Testing Functions](#testing-functions)
5. [Deployment](#deployment)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [CORS Configuration](#cors-configuration)
8. [Security Best Practices](#security-best-practices)

---

## Project Structure

```
hello-expo/
├── functions/
│   ├── src/
│   │   ├── index.ts           # Export all functions here
│   │   ├── config.ts          # Secret management
│   │   ├── agents/            # AI agent implementations
│   │   ├── services/          # Shared services (context retrieval, etc)
│   │   └── utils/             # Utilities (logging, rate limiting)
│   ├── .env.local             # Local secrets (NOT deployed)
│   ├── .env.example           # Template for .env.local
│   ├── .gcloudignore          # Exclude files from deployment
│   ├── package.json
│   └── tsconfig.json
├── services/
│   └── ai.ts                  # Client-side function calling
├── app/(tabs)/
│   └── ai-test.tsx            # Test UI for functions
└── .env.local                 # App-level environment config
```

---

## Local Development

### Starting the Emulators

**From project root:**

```bash
npm run functions:dev
```

This command:
1. Builds TypeScript functions (`cd functions && npm run build`)
2. Starts all emulators (Auth, Firestore, Functions, UI)
3. Loads secrets from `functions/.env.local`

**Emulator URLs:**
- Functions: `http://localhost:5001`
- Auth: `http://localhost:9099`
- Firestore: `http://localhost:8080`
- UI Dashboard: `http://localhost:4000`

### Environment Variables

**Root `.env.local` (for mobile app):**
```bash
EXPO_PUBLIC_USE_EMULATOR=true
EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST=localhost
EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT=5001
```

**`functions/.env.local` (for functions):**
```bash
OPENAI_API_KEY=sk-your-key-here
```

**Important:**
- Use `.env.local` (NOT `.env`) in the functions directory
- `.env.local` is NOT deployed to production (excluded by Firebase CLI)
- `.env` files ARE deployed, causing conflicts with Firebase Secret Manager
- Always use `.env.local` for local secrets

### Secret Loading

Our `functions/src/config.ts` automatically loads secrets:

```typescript
// In emulator: loads from .env.local
// In production: loads from Firebase Secret Manager
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
}
```

---

## Creating New Functions

### Template for Callable Functions

```typescript
// functions/src/index.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { openaiApiKey, getOpenAIKey } from './config';

export const myNewFunction = onCall(
  {
    // REQUIRED: Allow public invocation (auth handled by Firebase SDK)
    invoker: 'public',

    // Secrets (if needed)
    secrets: [openaiApiKey],

    // Configuration
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,

    // CORS for web development (Expo web mode)
    cors: [
      'http://localhost:8081',      // Expo web dev server
      'http://localhost:19006',     // Alternative Expo web port
      /^https:\/\/.*\.vercel\.app$/, // Production web deployments (optional)
    ],
  },
  async (request) => {
    // 1. ALWAYS validate authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to call this function.'
      );
    }

    // 2. Validate input
    const { data } = request.data;
    if (!data) {
      throw new HttpsError('invalid-argument', 'Missing required data');
    }

    try {
      // 3. Your function logic here
      const result = await doSomething(data);

      // 4. Return structured response
      return {
        success: true,
        result,
        timestamp: new Date().toISOString(),
        userId: request.auth.uid,
      };
    } catch (error: any) {
      console.error('Error in myNewFunction:', error);

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

### Client-Side Service

```typescript
// services/ai.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export interface MyFunctionRequest {
  data: string;
}

export interface MyFunctionResponse {
  success: boolean;
  result: string;
  timestamp: string;
  userId: string;
}

export const callMyFunction = async (
  data: string
): Promise<MyFunctionResponse> => {
  const callable = httpsCallable<MyFunctionRequest, MyFunctionResponse>(
    functions,
    'myNewFunction'
  );

  try {
    const result = await callable({ data });
    return result.data;
  } catch (error: any) {
    console.error('Error calling myNewFunction:', error);
    throw new Error(error.message || 'Function call failed');
  }
};
```

---

## Testing Functions

### Local Testing (Emulator)

1. **Start emulators:**
   ```bash
   npm run functions:dev
   ```

2. **Set app to use emulator:**
   ```bash
   # In root .env.local
   EXPO_PUBLIC_USE_EMULATOR=true
   ```

3. **Restart Expo app:**
   ```bash
   npm start
   ```

4. **Test from app:**
   - Log in to your app
   - Navigate to "AI Test" tab (or your test screen)
   - Call the function

### Production Testing

1. **Deploy function:**
   ```bash
   npm run functions:deploy
   ```

2. **Set app to use production:**
   ```bash
   # In root .env.local
   EXPO_PUBLIC_USE_EMULATOR=false
   ```

3. **Restart app and test**

### Using Firebase Functions Shell

Interactive testing:

```bash
npm run functions:shell

# In shell:
> myNewFunction({ data: { message: "test" } })
```

---

## Deployment

### First-Time Setup

1. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

2. **Set production secrets:**
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   # Enter your OpenAI API key when prompted
   ```

3. **Verify secret:**
   ```bash
   firebase functions:secrets:access OPENAI_API_KEY
   ```

### Deploying Functions

**Deploy all functions:**
```bash
npm run functions:deploy
```

**Deploy specific function:**
```bash
firebase deploy --only functions:myNewFunction
```

**View logs:**
```bash
npm run functions:logs
# or
firebase functions:log
```

### Important Notes

- **First deployment requires Firebase Blaze (pay-as-you-go) plan**
- Free tier is generous: 2M invocations/month, 400K GB-seconds
- Set up budget alerts in Google Cloud Console
- Functions are deployed to Cloud Run (2nd gen)

---

## Common Issues & Solutions

### Issue 1: "Secret environment variable overlaps non secret environment variable"

**Problem:**
Firebase CLI loads `.env` files during deployment, causing conflicts with Firebase Secret Manager.

**Solution:**
Use `.env.local` instead of `.env` for local development:

```bash
cd functions
mv .env .env.local  # If you have .env, rename it
```

Update `.gcloudignore` to exclude all `.env` files:
```
.env
.env.*
!.env.example
```

The Firebase CLI ignores `.env.local` during deployment, preventing conflicts.

---

### Issue 2: "npm ci can only install packages when package.json and package-lock.json are in sync"

**Problem:**
Added dependency to `package.json` but didn't update `package-lock.json`.

**Solution:**
Run `npm install` in the functions directory:

```bash
cd functions
npm install
cd ..
npm run functions:deploy
```

Always run `npm install` after modifying `functions/package.json`.

---

### Issue 3: "401 Unauthorized" Error When Calling Deployed Function

**Problem:**
Cloud Run service (underlying infrastructure) doesn't allow public invocation by default.

**Solution:**

1. **Add `invoker: 'public'` to function config** (should be done from the start):
   ```typescript
   export const myFunction = onCall({
     invoker: 'public',  // Add this line
     // ... other config
   }, async (request) => { ... });
   ```

2. **For existing deployed functions, grant IAM permissions manually:**
   ```bash
   gcloud run services add-iam-policy-binding <function-name> \
     --region=us-central1 \
     --member=allUsers \
     --role=roles/run.invoker \
     --project=<your-project-id>
   ```

   Example:
   ```bash
   gcloud run services add-iam-policy-binding helloworldai \
     --region=us-central1 \
     --member=allUsers \
     --role=roles/run.invoker \
     --project=will-msg-app-v2
   ```

**Why This is Safe:**
- `invoker: 'public'` allows HTTP requests to reach your function
- Your **function code** still validates authentication
- Unauthenticated requests are rejected by your auth check
- Firebase SDK automatically includes auth tokens

---

### Issue 4: "unauthenticated" Error in App

**Problem:**
User is not logged in to the app.

**Solution:**
Ensure user authentication before calling functions. Add check in UI:

```typescript
import { useAuth } from '../../context/auth';

export default function MyScreen() {
  const { user } = useAuth();

  const handleCall = async () => {
    if (!user) {
      Alert.alert('Not Logged In', 'Please sign in first');
      return;
    }

    // Call function...
  };

  return (
    <View>
      {!user && <Text>⚠️ Please sign in to use this feature</Text>}
      {user && <Text>✅ Logged in as: {user.email}</Text>}
      {/* ... rest of UI */}
    </View>
  );
}
```

---

## CORS Configuration

### Why CORS is Needed

CORS (Cross-Origin Resource Sharing) is required for **web development** when testing your app in Expo's web mode in a browser.

**The Problem:**
- Expo web dev server runs on `http://localhost:8081` (or 19006)
- Cloud Functions run on `https://<region>-<project>.cloudfunctions.net`
- Browsers block requests between different origins (security feature)

**Native Apps (iOS/Android) DON'T Need CORS:**
- React Native apps make direct HTTP requests (not browser-based)
- Firebase SDK handles authentication differently on native platforms
- CORS is purely a browser security feature

### CORS Configuration

```typescript
export const myFunction = onCall({
  cors: [
    'http://localhost:8081',      // Expo web dev (primary)
    'http://localhost:19006',     // Expo web dev (alternative)
    /^https:\/\/.*\.vercel\.app$/, // If you deploy web app to Vercel
  ],
  // ... other config
}, async (request) => { ... });
```

### Testing Different Platforms

**Web (requires CORS):**
```bash
npm start
# Press 'w' for web
# Open http://localhost:8081 in browser
```

**Android/iOS (no CORS needed):**
```bash
npm start
# Scan QR code with Expo Go app
# Functions work without CORS
```

**Emulator vs Production:**
- Emulator: CORS not enforced (all localhost)
- Production: CORS required for web mode

---

## Security Best Practices

### 1. Always Validate Authentication

```typescript
if (!request.auth) {
  throw new HttpsError('unauthenticated', 'Must be authenticated');
}
```

Never skip this check, even if `invoker: 'public'` is set.

### 2. Validate Input Data

```typescript
import { z } from 'zod';

const RequestSchema = z.object({
  message: z.string().min(1).max(5000),
  targetLanguage: z.string().min(2).max(50),
});

const result = RequestSchema.safeParse(request.data);
if (!result.success) {
  throw new HttpsError('invalid-argument', result.error.message);
}
```

### 3. Implement Rate Limiting

Create `functions/src/utils/rateLimit.ts` (see Tier 1 tasks document for full implementation):

```typescript
export const checkRateLimit = async (
  userId: string,
  functionName: string,
  config: { maxCalls: number; windowMs: number }
): Promise<void> => {
  // Check Firestore for rate limit
  // Throw HttpsError if exceeded
};
```

Use in functions:
```typescript
await checkRateLimit(request.auth.uid, 'myFunction', {
  maxCalls: 20,
  windowMs: 60 * 60 * 1000, // 20 calls per hour
});
```

### 4. Log Usage for Cost Tracking

Create `functions/src/utils/logger.ts`:

```typescript
export const logFunctionCall = (metrics: {
  functionName: string;
  userId: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  duration: number;
  success: boolean;
}) => {
  logger.info('Function metrics', metrics);
};
```

### 5. Handle Errors Properly

```typescript
try {
  // Function logic
} catch (error: any) {
  console.error('Error:', error);

  // Re-throw HttpsError
  if (error instanceof HttpsError) {
    throw error;
  }

  // Wrap unknown errors
  throw new HttpsError('internal', `Error: ${error.message}`);
}
```

### 6. Secret Management

**Never commit secrets to code:**
- ✅ Use Firebase Secret Manager for production
- ✅ Use `.env.local` for local development
- ✅ Add `.env.local` to `.gitignore`
- ❌ Never use `.env` (gets deployed)
- ❌ Never hardcode API keys

---

## Quick Reference Commands

```bash
# Local Development
npm run functions:build          # Build TypeScript
npm run functions:dev            # Start all emulators
npm run functions:shell          # Interactive testing

# Deployment
npm run functions:deploy         # Deploy all functions
firebase deploy --only functions:myFunction  # Deploy specific function

# Secrets
firebase functions:secrets:set SECRET_NAME
firebase functions:secrets:access SECRET_NAME

# Logs
npm run functions:logs
firebase functions:log

# IAM (if needed)
gcloud run services add-iam-policy-binding <service-name> \
  --region=us-central1 \
  --member=allUsers \
  --role=roles/run.invoker \
  --project=<project-id>
```

---

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] Built functions: `npm run functions:build`
- [ ] Emulators running: Check http://localhost:4000
- [ ] User is logged in: Check auth status in app
- [ ] Environment variables set correctly (`.env.local`)
- [ ] `invoker: 'public'` in function config
- [ ] CORS configured for web testing
- [ ] Dependencies installed: `cd functions && npm install`
- [ ] `package-lock.json` is in sync with `package.json`
- [ ] Secrets set in Firebase: `firebase functions:secrets:access SECRET_NAME`

---

## Summary

**Key Takeaways:**
1. ✅ Always use `invoker: 'public'` for callable functions
2. ✅ Always validate authentication in function code
3. ✅ Use `.env.local` (NOT `.env`) for local secrets
4. ✅ Add CORS configuration for web development
5. ✅ Test locally with emulators before deploying
6. ✅ Run `npm install` in functions directory after dependency changes
7. ✅ Grant IAM permissions if you get 401 errors

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Status**: Production-Ready ✅
