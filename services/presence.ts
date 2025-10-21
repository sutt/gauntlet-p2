// Milestone 8: Presence Service - Online/Offline Status Tracking
// Implements simple Firestore-based presence system

import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { AppState, AppStateStatus } from 'react-native';

const USERS_COLLECTION = 'users';
const PRESENCE_UPDATE_INTERVAL = 30000; // 30 seconds
const ONLINE_THRESHOLD_MS = 120000; // 2 minutes

let presenceInterval: ReturnType<typeof setInterval> | null = null;
let appStateListener: any = null;

/**
 * Start updating user's presence while app is active
 * Updates lastSeen every 30 seconds, marks as online
 *
 * MANUAL: No Firebase config changes needed - uses existing users collection
 */
export const startPresenceTracking = (userId: string): void => {
  // Update immediately
  updatePresence(userId, true);

  // Update every 30 seconds while app is active
  presenceInterval = setInterval(() => {
    if (AppState.currentState === 'active') {
      updatePresence(userId, true);
    }
  }, PRESENCE_UPDATE_INTERVAL);

  // Listen for app state changes
  appStateListener = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground - mark as online
      updatePresence(userId, true);
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background - mark as offline
      stopPresenceTracking(userId);
    }
  });
};

/**
 * Stop presence tracking and mark user as offline
 */
export const stopPresenceTracking = async (userId: string): Promise<void> => {
  // Clear interval
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }

  // Remove app state listener
  if (appStateListener) {
    appStateListener.remove();
    appStateListener = null;
  }

  // Update to offline
  await updatePresence(userId, false);
};

/**
 * Update user's presence timestamp and online status
 * Called periodically while app is active
 */
const updatePresence = async (userId: string, online: boolean = true): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      lastSeen: Timestamp.now(),
      online,
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    // Don't throw - presence updates are best-effort
  }
};

/**
 * Compute if user is online based on lastSeen timestamp
 * User is "online" if lastSeen < 2 minutes ago
 *
 * @param lastSeen - User's last seen timestamp
 * @returns true if user is considered online
 */
export const isUserOnline = (lastSeen: Date | undefined): boolean => {
  if (!lastSeen) {
    return false;
  }

  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  return diffMs < ONLINE_THRESHOLD_MS;
};

/**
 * Format "last seen" text for display
 * Returns "Online" if user is online, otherwise "Last seen X ago"
 *
 * @param lastSeen - User's last seen timestamp
 * @returns Formatted status text
 */
export const formatLastSeen = (lastSeen: Date | undefined): string => {
  if (!lastSeen) {
    return 'Offline';
  }

  if (isUserOnline(lastSeen)) {
    return 'Online';
  }

  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Last seen just now';
  } else if (diffMinutes < 60) {
    return `Last seen ${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `Last seen ${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Last seen yesterday';
  } else if (diffDays < 7) {
    return `Last seen ${diffDays}d ago`;
  } else {
    return 'Last seen a while ago';
  }
};
