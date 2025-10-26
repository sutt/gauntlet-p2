/**
 * Script to create BuyBot agent user
 * Run with: npx ts-node scripts/create-buybot.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();

const BUYBOT_EMAIL = 'buybot@agent.internal';
const BUYBOT_DISPLAY_NAME = 'BuyBot - Purchasing Assistant';

async function createBuyBotUser() {
  try {
    const auth = getAuth();
    const db = getFirestore();

    console.log('[SETUP] Creating BuyBot user...');

    // 1. Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(BUYBOT_EMAIL);
      console.log('[SETUP] ⚠️  BuyBot user already exists with UID:', existingUser.uid);
      console.log('[SETUP] Checking Firestore profile...');

      const userDoc = await db.collection('users').doc(existingUser.uid).get();
      if (userDoc.exists) {
        console.log('[SETUP] ✓ Firestore profile exists');
        console.log('[SETUP] Profile data:', userDoc.data());
      } else {
        console.log('[SETUP] Creating Firestore profile for existing user...');
        await db.collection('users').doc(existingUser.uid).set({
          uid: existingUser.uid,
          email: BUYBOT_EMAIL,
          displayName: BUYBOT_DISPLAY_NAME,
          isAgent: true,
          online: true,
          lastSeen: Timestamp.now(),
          createdAt: Timestamp.now(),
        });
        console.log('[SETUP] ✓ Firestore profile created');
      }

      printSuccessMessage(existingUser.uid);
      process.exit(0);
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // User doesn't exist, continue with creation
    }

    // 2. Generate secure password
    const password = generateSecurePassword();

    // 3. Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: BUYBOT_EMAIL,
      password,
      displayName: BUYBOT_DISPLAY_NAME,
      emailVerified: true,
    });

    console.log('[SETUP] ✓ Firebase Auth user created with UID:', userRecord.uid);

    // 4. Create Firestore user profile
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: BUYBOT_EMAIL,
      displayName: BUYBOT_DISPLAY_NAME,
      isAgent: true,  // Mark as AI agent
      online: true,   // Always online
      lastSeen: Timestamp.now(),
      createdAt: Timestamp.now(),
    });

    console.log('[SETUP] ✓ Firestore user profile created');

    printSuccessMessage(userRecord.uid);
    process.exit(0);

  } catch (error: any) {
    console.error('[SETUP] ❌ Error creating BuyBot user:', error.message);
    process.exit(1);
  }
}

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

function printSuccessMessage(uid: string) {
  console.log('\n========================================');
  console.log('✅ BuyBot User Setup Complete!');
  console.log('========================================');
  console.log('UID:', uid);
  console.log('Email:', BUYBOT_EMAIL);
  console.log('Display Name:', BUYBOT_DISPLAY_NAME);
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Create file: functions/src/config/agents.ts');
  console.log('2. Add this content:');
  console.log('');
  console.log('   export const BUYBOT_USER_ID = \'' + uid + '\';');
  console.log('   export const POWER_USERS = [');
  console.log('     \'YOUR_POWER_USER_UID\',  // Replace with actual UID');
  console.log('   ];');
  console.log('   export function isPowerUser(userId: string): boolean {');
  console.log('     return POWER_USERS.includes(userId);');
  console.log('   }');
  console.log('');
  console.log('3. BuyBot will now appear in the People tab');
  console.log('4. Users can start conversations with BuyBot');
  console.log('========================================\n');
}

// Run the script
createBuyBotUser();
