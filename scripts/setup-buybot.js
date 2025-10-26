/**
 * Client script to call setupCreateBuyBotUser Cloud Function
 * Run with: node scripts/setup-buybot.js
 */

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');

// Initialize Firebase (using local emulator)
const app = initializeApp({
  projectId: 'demo-project', // Emulator project ID
});

const functions = getFunctions(app);

// Connect to emulator
connectFunctionsEmulator(functions, 'localhost', 5001);

async function setupBuyBot() {
  console.log('Calling setupCreateBuyBotUser Cloud Function...\n');

  try {
    const setupFunction = httpsCallable(functions, 'setupCreateBuyBotUser');
    const result = await setupFunction();

    console.log('✅ Success!');
    console.log('Result:', result.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }

  process.exit(0);
}

setupBuyBot();
