# CHAI Production Deployment Guide

**Date**: 2025-10-26
**Purpose**: Step-by-step guide to deploy BuyBot to production Firebase

---

## Overview

The BuyBot agent requires configuration of environment variables for deployment. This guide covers two approaches:

1. **Firebase Environment Config** (Simpler, recommended for POC)
2. **Secret Manager** (More secure, recommended for production)

---

## Prerequisites

Before deploying:

- [ ] OpenAI API key already set in Secret Manager
- [ ] Production Firebase project initialized
- [ ] Firebase CLI authenticated (`firebase login`)

---

## Method 1: Firebase Environment Config (Recommended for POC)

### Step 1: Create BuyBot User in Production

**Option A: Firebase Console (Manual)**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your production project
3. Navigate to **Authentication** → **Users**
4. Click **Add User**
5. Fill in:
   - Email: `buybot@agent.internal`
   - Password: (generate random, won't be used)
   - Click **Add User**
6. **Copy the UID** (you'll need it for Step 2)
7. Navigate to **Firestore Database**
8. Go to `users` collection
9. Click **Add Document**
10. Document ID: (paste the UID from step 6)
11. Add fields:
    ```
    uid: <the-uid>
    email: "buybot@agent.internal"
    displayName: "BuyBot - Purchasing Assistant"
    isAgent: true
    online: true
    lastSeen: <current timestamp>
    createdAt: <current timestamp>
    ```
12. Click **Save**

**Option B: Using Setup Function**

```bash
# Deploy the setup function first
firebase deploy --only functions:setupCreateBuyBotUser

# Call it via Firebase Console or CLI
firebase functions:call setupCreateBuyBotUser

# Or use the deployed HTTP endpoint (requires auth)
```

### Step 2: Get Power User UIDs

Get the UIDs of users who should be power users:

1. Log in to your production app with the user account
2. Go to Firebase Console → Firestore → `users` collection
3. Find the user by email
4. Copy their UID

Repeat for each power user.

### Step 3: Set Environment Variables

Set the configuration using Firebase CLI:

```bash
# Set BuyBot UID (replace with actual UID from Step 1)
firebase functions:config:set chai.buybot_uid="PRODUCTION_BUYBOT_UID_HERE"

# Set Power User IDs (comma-separated, no spaces)
firebase functions:config:set chai.power_user_ids="UID1,UID2,UID3"

# Verify configuration
firebase functions:config:get
```

**Example:**
```bash
firebase functions:config:set chai.buybot_uid="xK9mP2nQ4rS5tU6vW7xY8zA1B"
firebase functions:config:set chai.power_user_ids="aB1cD2eF3gH4iJ5kL6mN7oP8qR,zY9xW8vU7tS6rQ5pO4nM3lK2"
```

### Step 4: Update Code to Read from Firebase Config

Edit `functions/src/config/agents.ts`:

```typescript
import * as functions from 'firebase-functions';

export function getBuyBotUserId(): string {
  // Try environment variable first (for local .env.local)
  if (process.env.BUYBOT_USER_ID) {
    return process.env.BUYBOT_USER_ID;
  }

  // Fall back to Firebase config (for production)
  const config = functions.config();
  const uid = config.chai?.buybot_uid;

  if (!uid) {
    console.warn('[AGENTS] BUYBOT_USER_ID not configured!');
    return '';
  }

  return uid;
}

export function getPowerUserIds(): string[] {
  // Try environment variable first (for local .env.local)
  if (process.env.POWER_USER_IDS) {
    return process.env.POWER_USER_IDS.split(',').map(id => id.trim());
  }

  // Fall back to Firebase config (for production)
  const config = functions.config();
  const idsString = config.chai?.power_user_ids;

  if (!idsString) {
    console.warn('[AGENTS] POWER_USER_IDS not configured!');
    return [];
  }

  return idsString.split(',').map(id => id.trim()).filter(id => id.length > 0);
}
```

### Step 5: Deploy Functions

```bash
# Build functions
cd functions && npm run build

# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:onBuyBotMessage,functions:setupCreateBuyBotUser
```

### Step 6: Verify Deployment

```bash
# Check functions are deployed
firebase functions:list

# View configuration
firebase functions:config:get

# Test BuyBot in production app
# 1. Open production app
# 2. Go to People tab
# 3. Search for BuyBot
# 4. Start conversation
# 5. Send a test message
# 6. Check BuyBot responds

# Monitor logs
firebase functions:log --only onBuyBotMessage --follow
```

---

## Method 2: Secret Manager (More Secure)

### Step 1-2: Same as Method 1
(Create BuyBot user and get power user UIDs)

### Step 3: Set Secrets

```bash
# Set BuyBot UID as secret
firebase functions:secrets:set BUYBOT_USER_ID
# When prompted, enter: xK9mP2nQ4rS5tU6vW7xY8zA1B

# Set Power User IDs as secret
firebase functions:secrets:set POWER_USER_IDS
# When prompted, enter: aB1cD2eF3gH4iJ5kL6mN7oP8qR,zY9xW8vU7tS6rQ5pO4nM3lK2

# Verify secrets are set
firebase functions:secrets:access BUYBOT_USER_ID
firebase functions:secrets:access POWER_USER_IDS
```

### Step 4: Update Code to Use Secrets

Edit `functions/src/config/agents.ts`:

```typescript
import { defineSecret } from 'firebase-functions/params';

// Define secrets
const buybotUserIdSecret = defineSecret('BUYBOT_USER_ID');
const powerUserIdsSecret = defineSecret('POWER_USER_IDS');

export function getBuyBotUserId(): string {
  // Local development: use .env.local
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return process.env.BUYBOT_USER_ID || '';
  }

  // Production: use Secret Manager
  return buybotUserIdSecret.value();
}

export function getPowerUserIds(): string[] {
  // Local development: use .env.local
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    const idsString = process.env.POWER_USER_IDS;
    return idsString ? idsString.split(',').map(id => id.trim()) : [];
  }

  // Production: use Secret Manager
  const idsString = powerUserIdsSecret.value();
  return idsString.split(',').map(id => id.trim()).filter(id => id.length > 0);
}
```

### Step 5: Update Function Declarations

Functions using secrets must declare them:

```typescript
// functions/src/agents/buyBotAgent.ts
import { buybotUserIdSecret, powerUserIdsSecret } from '../config/agents';

export const onBuyBotMessage = onDocumentCreated(
  {
    document: 'conversations/{conversationId}/messages/{messageId}',
    secrets: [buybotUserIdSecret, powerUserIdsSecret],  // ← Declare secrets
  },
  async (event) => {
    // Your agent logic here
  }
);
```

### Step 6: Deploy

```bash
firebase deploy --only functions
```

---

## Comparison: Environment Config vs Secret Manager

| Aspect | Firebase Config | Secret Manager |
|--------|----------------|----------------|
| **Security** | Plain text, visible in console | Encrypted, version controlled |
| **Setup** | Simple CLI commands | Requires secret definitions |
| **Local Dev** | Requires separate .env.local | Works with .env.local |
| **Cost** | Free | Free (6 secrets included) |
| **Best For** | POC, development | Production deployments |
| **Rotation** | Manual update + redeploy | Versioned, easier to rotate |

**Recommendation**: Start with Firebase Config for simplicity, migrate to Secret Manager before production launch.

---

## Environment Variables Summary

| Variable | Local (.env.local) | Production |
|----------|-------------------|------------|
| `BUYBOT_USER_ID` | Emulator UID | Production UID (via config or secret) |
| `POWER_USER_IDS` | Comma-separated test UIDs | Comma-separated prod UIDs |
| `TEST_MODE` | `true` (mock responses) | Not set (real GPT-4) |
| `OPENAI_API_KEY` | Test key | Secret Manager |

---

## Post-Deployment Checklist

After deploying to production:

- [ ] BuyBot user exists in production Firebase Auth
- [ ] BuyBot profile exists in production Firestore with `isAgent: true`
- [ ] `BUYBOT_USER_ID` configured (via config or secret)
- [ ] `POWER_USER_IDS` configured with actual production user UIDs
- [ ] `OPENAI_API_KEY` secret is set and accessible
- [ ] `TEST_MODE` is NOT set (should be undefined in production)
- [ ] Functions deployed successfully
- [ ] BuyBot appears in production app People tab
- [ ] BuyBot responds to test messages
- [ ] Power users can approve directly
- [ ] Non-power-users are asked for signatures
- [ ] Logs show no errors
- [ ] OpenAI API usage appears at https://platform.openai.com/usage

---

## Updating Configuration (Post-Deployment)

### Add a Power User

**Method 1: Firebase Config**
```bash
# Get current config
firebase functions:config:get chai.power_user_ids

# Update with new UID appended
firebase functions:config:set chai.power_user_ids="UID1,UID2,NEW_UID"

# Redeploy functions
firebase deploy --only functions
```

**Method 2: Secret Manager**
```bash
# Update secret
firebase functions:secrets:set POWER_USER_IDS
# Enter: UID1,UID2,NEW_UID

# Redeploy functions (picks up new secret version)
firebase deploy --only functions
```

### Change BuyBot UID (if recreating user)

```bash
# Firebase Config
firebase functions:config:set chai.buybot_uid="NEW_UID"
firebase deploy --only functions

# Secret Manager
firebase functions:secrets:set BUYBOT_USER_ID
# Enter new UID
firebase deploy --only functions
```

---

## Rollback

If deployment fails:

```bash
# View deployment history
firebase functions:list --detailed

# Rollback to previous version (if needed)
# Note: Firebase doesn't have built-in rollback, you'd need to:
# 1. Revert code changes
# 2. Redeploy

# Or restore previous config
firebase functions:config:set chai.buybot_uid="PREVIOUS_UID"
firebase deploy --only functions
```

---

## Troubleshooting

### "BUYBOT_USER_ID not configured" in logs

**Cause**: Environment variable not set

**Fix**:
```bash
# Check current config
firebase functions:config:get

# Set if missing
firebase functions:config:set chai.buybot_uid="YOUR_UID"
firebase deploy --only functions
```

### BuyBot doesn't respond

**Check**:
1. Function deployed: `firebase functions:list`
2. Logs: `firebase functions:log --only onBuyBotMessage`
3. BuyBot UID matches production user
4. OpenAI API key is set

### Power user not recognized

**Check**:
1. UID is in `POWER_USER_IDS` list
2. No extra spaces in comma-separated list
3. Functions redeployed after config change

---

**Document Status**: ✅ Complete
**Last Updated**: 2025-10-26
