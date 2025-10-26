# BuyBot Setup Instructions

**Date**: 2025-10-26
**Task**: Phase 1.1 - Create BuyBot User Account

---

## Manual Setup (Firebase Emulator UI)

Since we're using the Firebase emulator for development, the easiest way to create the BuyBot user is through the emulator UI.

### Step 1: Start Emulator

```bash
npm run functions:dev
```

This starts the Firebase emulators including Auth and Firestore.

### Step 2: Create Firebase Auth User

1. Open Firebase Auth Emulator UI: http://localhost:4000/auth
2. Click **"Add User"**
3. Fill in:
   - **Email**: `buybot@agent.internal`
   - **Password**: (generate random, won't be used)
   - **User UID**: Leave blank (auto-generated) OR use: `buybot-agent-001`
   - **Display Name**: `BuyBot - Purchasing Assistant`
4. Click **"Save"**
5. **Copy the generated UID** (you'll need it for Step 3)

### Step 3: Create Firestore User Profile

1. Open Firestore Emulator UI: http://localhost:4000/firestore
2. Navigate to `users` collection
3. Click **"Add Document"**
4. Set **Document ID** to the UID from Step 2
5. Add fields:
   ```
   uid: <the-uid-from-step-2>  (string)
   email: "buybot@agent.internal"  (string)
   displayName: "BuyBot - Purchasing Assistant"  (string)
   isAgent: true  (boolean)  ← IMPORTANT: This marks it as an AI agent
   online: true  (boolean)
   lastSeen: (click "Add Field" → "timestamp" → "Now")
   createdAt: (click "Add Field" → "timestamp" → "Now")
   ```
6. Click **"Save"**

### Step 4: Document BuyBot UID

Create the agent config file with the UID from Step 2:

**File**: `functions/src/config/agents.ts`

```typescript
/**
 * CHAI Agent Configuration
 * Contains agent user IDs and power user authorization lists
 */

// BuyBot agent user ID (from Firebase Auth)
export const BUYBOT_USER_ID = 'PASTE_UID_HERE';  // ← Replace with actual UID from Step 2

// Power users who can authorize purchases
// Replace with actual Firebase User IDs
export const POWER_USERS = [
  'YOUR_POWER_USER_UID',  // e.g., ash's UID
  // Add more power users as needed
];

/**
 * Check if a user is a power user
 */
export function isPowerUser(userId: string): boolean {
  return POWER_USERS.includes(userId);
}

/**
 * Check if a user is an AI agent
 */
export function isAgentUser(userId: string): boolean {
  return userId === BUYBOT_USER_ID;
}
```

### Step 5: Verify BuyBot Appears in App

1. Start the app: `npm start`
2. Log in with a regular user account
3. Go to **People** tab
4. Search for "BuyBot"
5. You should see:
   - **BuyBot - Purchasing Assistant**
   - Status: **Online** (always)
6. Tap to start a conversation

---

## Alternative: Automated Setup (Future)

For production or automated setup, use the Cloud Function:

```typescript
// Import in client app
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

const setupBuyBot = httpsCallable(functions, 'setupCreateBuyBotUser');
const result = await setupBuyBot();
console.log('BuyBot UID:', result.data.uid);
```

**Note**: This function is only available in the emulator (blocked in production for security).

---

## Verification Checklist

- [ ] BuyBot user exists in Firebase Auth Emulator
  - Email: `buybot@agent.internal`
  - Display Name: `BuyBot - Purchasing Assistant`
- [ ] BuyBot profile exists in Firestore `users` collection
  - Has `isAgent: true` field
  - Has `online: true` field
- [ ] `functions/src/config/agents.ts` created with correct `BUYBOT_USER_ID`
- [ ] BuyBot appears in People tab when searching
- [ ] BuyBot shows as "Online"
- [ ] Can start 1-on-1 conversation with BuyBot

---

## Troubleshooting

### BuyBot doesn't appear in People tab

**Cause**: Firestore profile missing or incomplete

**Solution**:
1. Check `users/{buybot_uid}` document exists in Firestore Emulator
2. Verify `email` and `displayName` fields are set
3. Try refreshing the app

### Can't find BuyBot UID

**Solution**:
1. Go to http://localhost:4000/auth
2. Find `buybot@agent.internal` in the user list
3. Click on the user
4. Copy the UID from the details panel

### isAgent flag missing

**Cause**: Forgot to add `isAgent: true` field

**Solution**:
1. Edit `users/{buybot_uid}` document in Firestore Emulator
2. Add field: `isAgent` (boolean) = `true`
3. Save

---

## Power User Setup

To designate yourself (or another user) as a power user:

1. Log in to the app with your account
2. Go to Profile tab
3. Copy your UID (it's displayed somewhere, or check Firestore)
4. Add your UID to `POWER_USERS` array in `functions/src/config/agents.ts`
5. Rebuild functions: `npm run functions:build`
6. Now you can approve purchases directly without signatures

---

## Next Steps

After completing this setup:

1. ✅ Phase 1.1 Complete - Buy Bot user created
2. → Phase 1.2 - Create agent config file (done above)
3. → Phase 1.3 - Create message trigger Cloud Function
4. → Test BuyBot responds to messages

---

**Setup Status**: Manual steps required
**Estimated Time**: 5-10 minutes
**Complexity**: Low (just UI clicks)
