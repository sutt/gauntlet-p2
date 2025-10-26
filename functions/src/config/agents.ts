/**
 * CHAI Agent Configuration
 * Contains agent user IDs and power user authorization lists
 *
 * Configuration sources (in order of precedence):
 * 1. Local development: .env.local file (process.env.*)
 * 2. Production: Firebase environment config (functions.config().chai.*)
 * 3. Future: Firebase Secret Manager (for enhanced security)
 */

import * as functions from 'firebase-functions';

/**
 * Get BuyBot user ID from environment
 * Tries process.env first (local), then Firebase config (production)
 */
export function getBuyBotUserId(): string {
  // Try environment variable first (local .env.local)
  if (process.env.BUYBOT_USER_ID) {
    return process.env.BUYBOT_USER_ID;
  }

  // Try Firebase config (production)
  const config = functions.config();
  const uid = config.chai?.buybot_uid;

  if (uid) {
    return uid;
  }

  // Not configured anywhere - warn and return empty
  console.warn('[AGENTS] ⚠️  BUYBOT_USER_ID not configured! Set via .env.local or firebase functions:config:set chai.buybot_uid');
  return '';
}

/**
 * Get power user IDs from environment
 * Expects comma-separated list: "uid1,uid2,uid3"
 * Tries process.env first (local), then Firebase config (production)
 */
export function getPowerUserIds(): string[] {
  // Try environment variable first (local .env.local)
  if (process.env.POWER_USER_IDS) {
    return process.env.POWER_USER_IDS
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }

  // Try Firebase config (production)
  const config = functions.config();
  const idsString = config.chai?.power_user_ids;

  if (idsString) {
    return idsString
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0);
  }

  // Not configured anywhere - warn and return empty array
  console.warn('[AGENTS] ⚠️  POWER_USER_IDS not configured! Set via .env.local or firebase functions:config:set chai.power_user_ids');
  return [];
}

// Export constants for backwards compatibility and ease of use
export const BUYBOT_USER_ID = getBuyBotUserId();
export const POWER_USERS = getPowerUserIds();

/**
 * Check if a user is a power user
 */
export function isPowerUser(userId: string): boolean {
  return getPowerUserIds().includes(userId);
}

/**
 * Check if a user is an AI agent
 */
export function isAgentUser(userId: string): boolean {
  return userId === getBuyBotUserId();
}
