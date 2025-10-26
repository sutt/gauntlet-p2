/**
 * CHAI Agent Configuration
 * Contains agent user IDs and power user authorization lists
 *
 * Configuration sources:
 * 1. Local development: .env.local file (process.env.*)
 * 2. Production (v2 functions): defineString params
 *
 * Note: Firebase v2 functions do NOT support functions.config()
 * All production config must be set as environment variables or params
 */

import { buybotUserId, powerUserIds } from './params';

/**
 * Get BuyBot user ID from environment
 * Works in both local (.env.local) and production (params)
 */
export function getBuyBotUserId(): string {
  // In emulator, use .env.local
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return process.env.BUYBOT_USER_ID || '';
  }

  // In production, use param
  const uid = buybotUserId.value();

  if (!uid) {
    console.warn('[AGENTS] ⚠️  BUYBOT_USER_ID not configured!');
  }

  return uid;
}

/**
 * Get power user IDs from environment
 * Expects comma-separated list: "uid1,uid2,uid3"
 * Works in both local (.env.local) and production (params)
 */
export function getPowerUserIds(): string[] {
  let idsString: string;

  // In emulator, use .env.local
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    idsString = process.env.POWER_USER_IDS || '';
  } else {
    // In production, use param
    idsString = powerUserIds.value();
  }

  if (!idsString) {
    console.warn('[AGENTS] ⚠️  POWER_USER_IDS not configured!');
    return [];
  }

  return idsString
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
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
