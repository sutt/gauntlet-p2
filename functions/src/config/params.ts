/**
 * Firebase v2 Functions Parameters
 * Defines environment variables that can be set at deploy time
 */

import { defineString } from 'firebase-functions/params';

// CHAI: BuyBot configuration
export const buybotUserId = defineString('BUYBOT_USER_ID', {
  description: 'Firebase Auth UID for the BuyBot agent user',
  default: '',
});

export const powerUserIds = defineString('POWER_USER_IDS', {
  description: 'Comma-separated list of power user Firebase Auth UIDs',
  default: '',
});
