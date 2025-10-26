# CHAI Deployment Troubleshooting Guide

**Version**: 1.0
**Date**: 2025-10-26
**Status**: Production-Ready ✅

This guide documents common deployment issues and their solutions, based on real production deployment experience with the CHAI feature set.

---

## Table of Contents

1. [Secret Binding Issues](#secret-binding-issues)
2. [Firebase v2 Functions Configuration](#firebase-v2-functions-configuration)
3. [TypeScript Build Errors](#typescript-build-errors)
4. [Environment Variable Issues](#environment-variable-issues)
5. [Diagnostic Commands](#diagnostic-commands)

---

## Secret Binding Issues

### Issue: "No value found for secret parameter OPENAI_API_KEY"

**Symptoms:**
- Function logs show error: `No value found for secret parameter "OPENAI_API_KEY"`
- Error message: `A function can only access a secret if you include the secret in the function's dependency array`
- Other AI functions (translateMessage, helloWorldAI) work correctly
- Only `onBuyBotMessage` fails to access the secret

**Root Cause:**

The `onBuyBotMessage` function was deployed without properly declaring its secret dependency in the function options. Even though the secret exists in Secret Manager, Cloud Run doesn't inject it into the container because it wasn't told to.

**Diagnosis:**

1. Verify secret exists:
   ```bash
   firebase functions:secrets:access OPENAI_API_KEY
   # Should display the API key
   ```

2. Check if secret is bound to function:
   ```bash
   gcloud functions describe onBuyBotMessage \
     --region=us-central1 \
     --gen2 \
     --project=<your-project-id> \
     --format="yaml(serviceConfig.secretEnvironmentVariables)"
   ```

   **If you see `null` or empty output**, the secret is NOT bound to the function.

3. Compare with working function:
   ```bash
   gcloud functions describe translateMessage \
     --region=us-central1 \
     --gen2 \
     --project=<your-project-id> \
     --format="yaml(serviceConfig.secretEnvironmentVariables)"
   ```

   **Expected output for working function:**
   ```yaml
   serviceConfig:
     secretEnvironmentVariables:
     - key: OPENAI_API_KEY
       projectId: your-project-id
       secret: OPENAI_API_KEY
       version: '1'
   ```

**Solution:**

1. **Ensure function code declares secret dependency:**

   ```typescript
   // functions/src/agents/buyBotAgent.ts
   import { onDocumentCreated } from 'firebase-functions/v2/firestore';
   import { openaiApiKey } from '../config';

   export const onBuyBotMessage = onDocumentCreated(
     {
       document: 'conversations/{conversationId}/messages/{messageId}',
       secrets: [openaiApiKey], // ← MUST be declared here
       region: 'us-central1',
       memory: '512MiB',
       timeoutSeconds: 60,
     },
     async (event) => {
       // Function implementation
     }
   );
   ```

2. **Delete the old function** (to clear cached configuration):
   ```bash
   firebase functions:delete onBuyBotMessage --force
   ```

3. **Rebuild TypeScript:**
   ```bash
   cd functions
   npm run build
   ```

4. **Deploy fresh:**
   ```bash
   firebase deploy --only functions:onBuyBotMessage
   ```

5. **Verify secret binding:**
   ```bash
   gcloud functions describe onBuyBotMessage \
     --region=us-central1 \
     --gen2 \
     --project=<your-project-id> \
     --format="yaml(serviceConfig.secretEnvironmentVariables)"
   ```

   Should now show the secret binding.

**Why Delete and Redeploy?**

Firebase/GCP may cache the previous function configuration. When you update a function that was originally deployed without secrets, the deployment system might not properly reconfigure the Cloud Run service to include secret bindings. Deleting and redeploying ensures a clean slate.

---

## Firebase v2 Functions Configuration

### Issue: "functions.config() is no longer available"

**Symptoms:**
- Deployment fails with container health check failures
- Logs show: `functions.config() is no longer available in Cloud Functions for Firebase v2`
- All functions fail to deploy

**Root Cause:**

Code is using the deprecated Firebase v1 configuration API `functions.config()`. Firebase v2 functions do NOT support this API.

**Solution:**

Migrate to `defineString()` and `defineSecret()` from `firebase-functions/params`.

**WRONG (v1 style) ❌:**
```typescript
const config = functions.config();
const buybotUid = config.chai?.buybot_uid || 'default-uid';
```

**CORRECT (v2 style) ✅:**

1. **Create params file:**
   ```typescript
   // functions/src/config/params.ts
   import { defineString } from 'firebase-functions/params';

   export const buybotUserId = defineString('BUYBOT_USER_ID', {
     description: 'Firebase Auth UID for the BuyBot agent user',
     default: '',
   });

   export const powerUserIds = defineString('POWER_USER_IDS', {
     description: 'Comma-separated list of power user Firebase Auth UIDs',
     default: '',
   });
   ```

2. **Use params in code:**
   ```typescript
   // functions/src/config/agents.ts
   import { buybotUserId, powerUserIds } from './params';

   export function getBuyBotUserId(): string {
     // In emulator, use .env.local
     if (process.env.FUNCTIONS_EMULATOR === 'true') {
       return process.env.BUYBOT_USER_ID || '';
     }

     // In production, use param
     return buybotUserId.value();
   }

   export function getPowerUserIds(): string[] {
     let idsString: string;

     if (process.env.FUNCTIONS_EMULATOR === 'true') {
       idsString = process.env.POWER_USER_IDS || '';
     } else {
       idsString = powerUserIds.value();
     }

     return idsString.split(',').map(id => id.trim()).filter(id => id.length > 0);
   }
   ```

3. **Set values via environment file:**
   ```bash
   # functions/.env.will-msg-app-v2
   BUYBOT_USER_ID=mHwZss3sQCeFXyeZzNsGU0F0ccE2
   POWER_USER_IDS=udxMqiGZRrM9FhaH00rTUI5vLCv1,X6zBuExILUhCvjqjkjOv8DxAxe52
   ```

   This file is automatically loaded by Firebase CLI during deployment.

---

## TypeScript Build Errors

### Issue: "No overload matches this call" with params property

**Symptoms:**
```
src/agents/buyBotAgent.ts(29,32): error TS2769: No overload matches this call.
Object literal may only specify known properties, and 'params' does not exist in type 'DocumentOptions'
```

**Root Cause:**

`onDocumentCreated` (Firestore trigger functions) do NOT accept a `params` property in their options. Only `secrets` can be declared.

**Why the Confusion?**

Unlike callable functions (`onCall`), Firestore triggers don't need params to be declared. Params defined with `defineString()` are automatically accessible via `.value()` anywhere in your code.

**Solution:**

**WRONG ❌:**
```typescript
export const onBuyBotMessage = onDocumentCreated(
  {
    document: 'conversations/{conversationId}/messages/{messageId}',
    secrets: [openaiApiKey],
    params: [buybotUserId, powerUserIds], // ← NOT VALID for onDocumentCreated
    region: 'us-central1',
  },
  async (event) => { ... }
);
```

**CORRECT ✅:**
```typescript
export const onBuyBotMessage = onDocumentCreated(
  {
    document: 'conversations/{conversationId}/messages/{messageId}',
    secrets: [openaiApiKey], // Only secrets need declaration
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (event) => { ... }
);
```

**Remove unused import:**
```typescript
// Remove this line if you're not using params in function options
import { buybotUserId, powerUserIds } from '../config/params';
```

Params are still accessible via the helper functions in `config/agents.ts`:
```typescript
import { getBuyBotUserId, getPowerUserIds } from '../config/agents';

// Use anywhere in your code:
const buybotId = getBuyBotUserId();
const powerUsers = getPowerUserIds();
```

---

## Environment Variable Issues

### Issue: "BUYBOT_USER_ID not configured" warnings

**Symptoms:**
- Deployment warnings: `⚠️ BUYBOT_USER_ID not configured!`
- BuyBot doesn't respond or can't identify power users
- Logs show undefined or empty values for configuration

**Root Cause:**

The `.env.will-msg-app-v2` file doesn't exist or has incorrect values.

**Solution:**

1. **Create environment file:**
   ```bash
   cd functions
   touch .env.will-msg-app-v2
   ```

2. **Add production configuration:**
   ```bash
   BUYBOT_USER_ID=<production-buybot-firebase-auth-uid>
   POWER_USER_IDS=<production-uid-1>,<production-uid-2>
   ```

   **Example:**
   ```bash
   BUYBOT_USER_ID=mHwZss3sQCeFXyeZzNsGU0F0ccE2
   POWER_USER_IDS=udxMqiGZRrM9FhaH00rTUI5vLCv1,X6zBuExILUhCvjqjkjOv8DxAxe52
   ```

3. **Verify file is in correct location:**
   ```bash
   ls functions/.env.will-msg-app-v2
   # Should exist
   ```

4. **Redeploy:**
   ```bash
   firebase deploy --only functions:onBuyBotMessage
   ```

5. **Verify in logs:**
   Send a test message to BuyBot and check logs for proper power user detection.

**Note on .gitignore:**

You can safely add `.env.will-msg-app-v2` to `.gitignore` if you prefer to manage production configuration separately. The file is NOT needed in git - it's only used during deployment.

**Recommended .gitignore pattern:**
```gitignore
.env*
!.env.example
```

---

## Diagnostic Commands

### Check Secret Exists
```bash
firebase functions:secrets:access OPENAI_API_KEY
```
Should display the API key value.

### Check Secret Binding on Function
```bash
gcloud functions describe onBuyBotMessage \
  --region=us-central1 \
  --gen2 \
  --project=<your-project-id> \
  --format="yaml(serviceConfig.secretEnvironmentVariables)"
```

**Expected output:**
```yaml
serviceConfig:
  secretEnvironmentVariables:
  - key: OPENAI_API_KEY
    projectId: your-project-id
    secret: OPENAI_API_KEY
    version: '1'
```

**If null or empty:** Secret is NOT bound to function - see [Secret Binding Issues](#secret-binding-issues)

### List All Functions
```bash
firebase functions:list
```

### Check Function Logs
```bash
# Recent logs
firebase functions:log --only onBuyBotMessage --limit 50

# Live logs (follow)
firebase functions:log --only onBuyBotMessage --follow

# All functions
firebase functions:log --limit 100
```

### Check Environment Variables Loaded
```bash
# Look for this line in deployment output:
# "i  functions: Loaded environment variables from .env.will-msg-app-v2."
firebase deploy --only functions:onBuyBotMessage
```

### Verify TypeScript Build
```bash
cd functions
npm run build
# Should complete without errors
```

### Compare Working vs Broken Function
```bash
# Working function (translateMessage)
gcloud functions describe translateMessage \
  --region=us-central1 \
  --gen2 \
  --project=<your-project-id> \
  --format="yaml(serviceConfig)"

# Your function
gcloud functions describe onBuyBotMessage \
  --region=us-central1 \
  --gen2 \
  --project=<your-project-id> \
  --format="yaml(serviceConfig)"
```

Compare the outputs to identify configuration differences.

---

## Deployment Checklist

Use this checklist before and after deployment:

### Pre-Deployment
- [ ] TypeScript builds without errors: `npm run build`
- [ ] Secret exists: `firebase functions:secrets:access OPENAI_API_KEY`
- [ ] `.env.will-msg-app-v2` file exists with correct UIDs
- [ ] Function code declares `secrets: [openaiApiKey]` in options
- [ ] No `params: [...]` in `onDocumentCreated` options (TypeScript error)
- [ ] No `functions.config()` calls in code (v2 incompatible)

### Post-Deployment
- [ ] Secret binding verified via `gcloud functions describe`
- [ ] Function appears in `firebase functions:list`
- [ ] No errors in `firebase functions:log --only onBuyBotMessage`
- [ ] Test message to BuyBot receives response
- [ ] Power user auto-approval working (check logs for purchase intent analysis)
- [ ] Signature attachments working in UI

---

## Quick Fix: Complete Redeploy

If you're experiencing multiple issues, try a complete clean redeploy:

```bash
# 1. Delete function
firebase functions:delete onBuyBotMessage --force

# 2. Clean build
cd functions
rm -rf lib/
npm run build

# 3. Verify environment file exists
cat .env.will-msg-app-v2
# Should show BUYBOT_USER_ID and POWER_USER_IDS

# 4. Deploy fresh
firebase deploy --only functions:onBuyBotMessage

# 5. Verify secret binding
gcloud functions describe onBuyBotMessage \
  --region=us-central1 \
  --gen2 \
  --project=<your-project-id> \
  --format="yaml(serviceConfig.secretEnvironmentVariables)"

# 6. Check logs
firebase functions:log --only onBuyBotMessage --follow
```

Then test in the app.

---

## Summary of Key Learnings

1. **Secrets MUST be declared** in `onDocumentCreated` options via `secrets: [openaiApiKey]`
2. **Params do NOT need declaration** in function options (only in `params.ts`)
3. **Delete and redeploy** when secret binding fails (cached configuration issue)
4. **Firebase v2 does NOT support** `functions.config()` - use `defineString()` instead
5. **Environment files** (`.env.will-msg-app-v2`) are loaded automatically during deployment
6. **Always verify secret binding** after deployment using `gcloud functions describe`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-26
**Related Docs**:
- `deployment-guide.md` - Environment variable setup
- `buybot-agent-behavior.md` - BuyBot functionality and testing
- `backend-architecture.md` - Overall system design

**Status**: Production-Ready ✅
