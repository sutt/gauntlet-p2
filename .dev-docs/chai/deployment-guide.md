# CHAI Deployment Guide - Environment Variables

**Date**: 2025-10-26
**Purpose**: How to deploy BuyBot agent with proper environment configuration

---

## Environment Variables Overview

The BuyBot agent uses environment variables for configuration:

| Variable | Local (Dev) | Production | Purpose |
|----------|-------------|------------|---------|
| `OPENAI_API_KEY` | `.env.local` | Secret Manager | OpenAI API access |
| `TEST_MODE` | `.env.local` | Not needed | Mock responses for testing |
| `DISABLE_AUTH_CHECK` | `.env.local` | Never set | Shell testing only |

---

## Local Development (Emulator)

### Current Setup ✅

Your `.env.local` file is already configured:

```bash
# functions/.env.local
OPENAI_API_KEY=sk-proj-...
DISABLE_AUTH_CHECK=false
TEST_MODE=true  # ← Development mode, no OpenAI calls
```

**How it works:**
- `.env.local` is loaded automatically by Firebase Emulator
- `TEST_MODE=true` makes BuyBot return mock responses (fast, free)
- `.env.local` is in `.gitignore` (never committed)

---

## Production Deployment

### Step 1: Set OpenAI API Key (Already Done)

You already have this set up from the translation agent:

```bash
firebase functions:secrets:set OPENAI_API_KEY
# Paste your OpenAI API key when prompted
```

**Verify it's set:**
```bash
firebase functions:secrets:access OPENAI_API_KEY
```

---

### Step 2: TEST_MODE in Production

**IMPORTANT**: `TEST_MODE` should **NOT** be set in production.

The code defaults to production mode when `TEST_MODE` is undefined:

```typescript
// In agent code
const TEST_MODE = process.env.TEST_MODE === 'true';

if (TEST_MODE) {
  // Development: return mock responses
  return getMockResponse(userMessage);
} else {
  // Production: call real GPT-4
  return await callOpenAI(prompt);
}
```

**No action needed** - just don't set `TEST_MODE` as a secret or env var in production.

---

### Step 3: Deploy Cloud Functions

Deploy your functions normally:

```bash
# Deploy all functions
npm run functions:deploy

# Or deploy specific BuyBot function (once created)
firebase deploy --only functions:onBuyBotMessage
```

**What happens:**
- `OPENAI_API_KEY` loaded from Secret Manager ✅
- `TEST_MODE` is undefined → production mode ✅
- `DISABLE_AUTH_CHECK` is undefined → auth required ✅

---

## Environment Variable Access Patterns

### In Cloud Functions Code

```typescript
// functions/src/config.ts (existing pattern)
import { defineSecret } from 'firebase-functions/params';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local in emulator mode
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
}

// Secret for production, env var for local
export const openaiApiKey = defineSecret('OPENAI_API_KEY');

export const getOpenAIKey = (): string => {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return process.env.OPENAI_API_KEY || '';
  }
  return openaiApiKey.value();
};
```

### For BuyBot Agent

```typescript
// In buyBotAgent.ts
const TEST_MODE = process.env.TEST_MODE === 'true';

if (TEST_MODE) {
  console.log('[BUYBOT] Running in TEST_MODE (mock responses)');
  return getMockResponse(userMessage);
}

// Production: use real OpenAI
const apiKey = getOpenAIKey();
const openai = createOpenAI({ apiKey });
// ... actual GPT-4 call
```

---

## Deployment Checklist

Before deploying to production:

- [ ] **OpenAI API Key** set in Secret Manager
  ```bash
  firebase functions:secrets:access OPENAI_API_KEY
  ```
- [ ] **Remove TEST_MODE** from production config (don't set it at all)
- [ ] **BuyBot user created** in production Firebase Auth
  ```bash
  # You'll need to run the setup script or create manually
  # UID will be different in production
  ```
- [ ] **Update BUYBOT_USER_ID** in production code
  ```typescript
  // Option 1: Environment variable (recommended for production)
  export const BUYBOT_USER_ID = process.env.BUYBOT_USER_ID || 'fallback-uid';

  // Option 2: Hardcode production UID (simple but less flexible)
  export const BUYBOT_USER_ID = 'production-buybot-uid-here';
  ```
- [ ] **Update POWER_USERS** with production user IDs
- [ ] **Test in staging** first (if you have staging environment)
- [ ] **Deploy functions**
  ```bash
  npm run functions:deploy
  ```
- [ ] **Verify BuyBot responds** in production app

---

## Recommended: Environment-Based Config

For better production deployment, consider using environment variables for UIDs:

### Option A: Firebase Environment Config (Deprecated but Simple)

```bash
# Set in Firebase
firebase functions:config:set chai.buybot_uid="production-uid-here"
firebase functions:config:set chai.power_users="uid1,uid2,uid3"

# In code
const config = functions.config();
export const BUYBOT_USER_ID = config.chai?.buybot_uid || 'dev-uid';
export const POWER_USERS = (config.chai?.power_users || '').split(',');
```

### Option B: Secret Manager (Recommended for Production)

```bash
# Set as secrets
firebase functions:secrets:set BUYBOT_USER_ID
# Enter: production-buybot-uid

firebase functions:secrets:set POWER_USER_IDS
# Enter: uid1,uid2,uid3
```

```typescript
// functions/src/config/agents.ts
import { defineSecret } from 'firebase-functions/params';

const buybotUserIdSecret = defineSecret('BUYBOT_USER_ID');
const powerUserIdsSecret = defineSecret('POWER_USER_IDS');

export function getBuyBotUserId(): string {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return '3SGngjhy3VGk15JY2uRgrtSpg9BI'; // Local UID
  }
  return buybotUserIdSecret.value();
}

export function getPowerUsers(): string[] {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return ['Nr2ne28sZJShTzemvhA0J47tVaUO']; // Local UIDs
  }
  return powerUserIdsSecret.value().split(',');
}
```

**Trade-offs:**
- **Current approach** (hardcoded UIDs): Simple, works fine for POC
- **Environment variables**: Better for production, separates config from code
- **Secret Manager**: Most secure, but adds complexity

---

## Production BuyBot Setup

When deploying to production, you'll need to create a new BuyBot user in **production Firebase**:

### Method 1: Manual (Simplest)

1. Go to Firebase Console → Authentication
2. Add User:
   - Email: `buybot@agent.internal`
   - Password: (generate random)
   - Display Name: `BuyBot - Purchasing Assistant`
3. Copy the UID
4. Go to Firebase Console → Firestore
5. Create document in `users` collection:
   ```json
   {
     "uid": "<copied-uid>",
     "email": "buybot@agent.internal",
     "displayName": "BuyBot - Purchasing Assistant",
     "isAgent": true,
     "online": true,
     "lastSeen": "<timestamp>",
     "createdAt": "<timestamp>"
   }
   ```
6. Update `BUYBOT_USER_ID` in code or set as secret

### Method 2: Automated Script

Run the setup function in production (requires admin access):

```bash
# Option A: Via deployed function
firebase functions:call setupCreateBuyBotUser

# Option B: Via script with service account
# (Requires firebase-admin credentials)
node functions/src/scripts/create-buybot.js --production
```

---

## Testing Production Deployment

After deploying:

1. **Check Functions Deployed**:
   ```bash
   firebase functions:log --only onBuyBotMessage
   ```

2. **Test BuyBot in App**:
   - Log in to production app
   - Go to People tab
   - Find BuyBot
   - Start conversation
   - Send a message
   - Check BuyBot responds (with GPT-4, not mock)

3. **Monitor Logs**:
   ```bash
   # Watch live logs
   firebase functions:log --follow

   # Filter for BuyBot
   firebase functions:log --only onBuyBotMessage --follow
   ```

4. **Check OpenAI Usage**:
   - Go to https://platform.openai.com/usage
   - Verify API calls are logged
   - Monitor costs

---

## Environment Summary

| Environment | TEST_MODE | OPENAI_API_KEY | BUYBOT_USER_ID | Behavior |
|-------------|-----------|----------------|----------------|----------|
| **Local (Emulator)** | `true` (in `.env.local`) | From `.env.local` | Hardcoded in `agents.ts` | Mock responses, no API cost |
| **Production** | Not set (undefined) | From Secret Manager | Hardcoded or from Secret Manager | Real GPT-4, API costs apply |

---

## Troubleshooting

### BuyBot not responding in production

**Check:**
1. Function deployed: `firebase functions:list`
2. Logs for errors: `firebase functions:log --only onBuyBotMessage`
3. OpenAI key set: `firebase functions:secrets:access OPENAI_API_KEY`
4. BuyBot user exists in production Firestore

### "TEST_MODE" responses in production

**Cause**: `TEST_MODE` env var was accidentally set in production

**Fix**:
```bash
# Remove the env var if set
firebase functions:config:unset chai.test_mode
# Redeploy
firebase deploy --only functions
```

### OpenAI API errors

**Check:**
- API key valid: https://platform.openai.com/api-keys
- Billing enabled: https://platform.openai.com/account/billing
- Rate limits not exceeded

---

## Cost Management

**Development (TEST_MODE=true)**:
- $0 OpenAI costs
- Fast responses
- Good for testing logic

**Production (TEST_MODE undefined)**:
- ~$0.01-0.05 per conversation
- Depends on conversation length
- Monitor at https://platform.openai.com/usage

**Recommendation**: Keep TEST_MODE=true during development, only use production mode for final testing and actual deployment.

---

**Document Status**: ✅ Complete
**Next Update**: When deploying to production
