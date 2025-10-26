/**
 * Quick test script to verify agent configuration loads
 * Run: node test-agent-config.js
 */

require('dotenv').config({ path: '.env.local' });

// Simulate what the functions will see
console.log('\n=== Environment Variables ===');
console.log('BUYBOT_USER_ID:', process.env.BUYBOT_USER_ID || '(not set)');
console.log('POWER_USER_IDS:', process.env.POWER_USER_IDS || '(not set)');
console.log('TEST_MODE:', process.env.TEST_MODE || '(not set)');

// Import the config module
const { getBuyBotUserId, getPowerUserIds, isPowerUser, BUYBOT_USER_ID, POWER_USERS } = require('./lib/config/agents');

console.log('\n=== Agent Configuration ===');
console.log('BuyBot UID:', getBuyBotUserId());
console.log('Power Users:', getPowerUserIds());

console.log('\n=== Exported Constants ===');
console.log('BUYBOT_USER_ID:', BUYBOT_USER_ID);
console.log('POWER_USERS:', POWER_USERS);

console.log('\n=== Function Tests ===');
const testUserId = 'Nr2ne28sZJShTzemvhA0J47tVaUO';
console.log(`isPowerUser('${testUserId}'):`, isPowerUser(testUserId));
console.log(`isPowerUser('fake-uid'):`, isPowerUser('fake-uid'));

console.log('\n✅ Configuration test complete!\n');
