/**
 * One-time setup Cloud Function to create BuyBot agent user
 * Call this function to create the BuyBot user account and profile
 *
 * Usage (Functions Shell):
 * npm run functions:shell
 * setupCreateBuyBotUser()
 *
 * Or via HTTP (with auth):
 * const setupCreateBuyBotUser = httpsCallable(functions, 'setupCreateBuyBotUser');
 * await setupCreateBuyBotUser();
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export const setupCreateBuyBotUser = onCall(async (request) => {
  // Only allow in development or with admin privileges
  // For production, remove this function or add strict auth checks
  const isDev = process.env.FUNCTIONS_EMULATOR === 'true';

  if (!isDev) {
    throw new HttpsError(
      'permission-denied',
      'This setup function can only be run in the emulator'
    );
  }

  return await createBuyBotUserInternal();
});

async function createBuyBotUserInternal(): Promise<{ success: boolean; uid: string; error?: string }> {
  try {
    const auth = getAuth();
    const db = getFirestore();

    const BUYBOT_EMAIL = 'buybot@agent.internal';
    const BUYBOT_DISPLAY_NAME = 'BuyBot - Purchasing Assistant';

    console.log('[SETUP] Creating BuyBot user...');

    // 1. Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(BUYBOT_EMAIL);
      console.log('[SETUP] BuyBot user already exists:', existingUser.uid);

      // Return existing UID
      return {
        success: true,
        uid: existingUser.uid,
        error: 'User already exists'
      };
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // User doesn't exist, continue with creation
    }

    // 2. Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: BUYBOT_EMAIL,
      password: generateSecurePassword(),
      displayName: BUYBOT_DISPLAY_NAME,
      emailVerified: true, // Agent doesn't need email verification
    });

    console.log('[SETUP] Firebase Auth user created:', userRecord.uid);

    // 3. Create Firestore user profile
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: BUYBOT_EMAIL,
      displayName: BUYBOT_DISPLAY_NAME,
      isAgent: true,  // NEW FLAG: Marks this as an AI agent
      online: true,   // Always show as online
      lastSeen: Timestamp.now(),
      createdAt: Timestamp.now(),
      // No profileImageUrl - can add robot emoji or icon later
    });

    console.log('[SETUP] Firestore user profile created');

    // 4. Log credentials (for team records)
    console.log('\n=== BuyBot User Created Successfully ===');
    console.log('UID:', userRecord.uid);
    console.log('Email:', BUYBOT_EMAIL);
    console.log('Display Name:', BUYBOT_DISPLAY_NAME);
    console.log('\n⚠️  IMPORTANT: Add this UID to functions/src/config/agents.ts:');
    console.log(`export const BUYBOT_USER_ID = '${userRecord.uid}';`);
    console.log('========================================\n');

    return {
      success: true,
      uid: userRecord.uid
    };

  } catch (error: any) {
    console.error('[SETUP] Error creating BuyBot user:', error);
    return {
      success: false,
      uid: '',
      error: error.message
    };
  }
}

/**
 * Generate a secure random password for the agent user
 * (Agent won't actually log in with password, this is just for Firebase Auth)
 */
function generateSecurePassword(): string {
  const length = 32;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  return password;
}
