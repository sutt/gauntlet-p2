import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// MANUAL: On iOS, you need to configure notification permissions in Info.plist
// MANUAL: For production push notifications, you'll need to set up Firebase Cloud Messaging (FCM)
// MANUAL: and Apple Push Notification Service (APNS) credentials in Firebase Console
// For MVP, we're only implementing foreground (in-app) notifications

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the user
 * @returns true if permission granted, false otherwise
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not already granted, request permission
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // For Android, set up notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Check if notification permissions are granted
 * @returns true if granted, false otherwise
 */
export const hasNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return false;
  }
};

/**
 * Show a local notification for a new message
 * @param senderName - Name of the message sender
 * @param messageText - Content of the message
 * @param conversationId - ID of the conversation
 */
export const showMessageNotification = async (
  senderName: string,
  messageText: string,
  conversationId: string
): Promise<void> => {
  try {
    // Check if we have permission
    const hasPermission = await hasNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission granted, skipping notification');
      return;
    }

    // Truncate message text to 100 characters
    const preview = messageText.length > 100
      ? `${messageText.substring(0, 100)}...`
      : messageText;

    // Schedule the notification immediately
    await Notifications.scheduleNotificationAsync({
      content: {
        title: senderName,
        body: preview,
        data: { conversationId },
        sound: true,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

/**
 * Show a local notification for a new conversation
 * @param title - Notification title
 * @param body - Notification body
 * @param conversationId - ID of the conversation
 */
export const showConversationNotification = async (
  title: string,
  body: string,
  conversationId: string
): Promise<void> => {
  try {
    // Check if we have permission
    const hasPermission = await hasNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permission granted, skipping notification');
      return;
    }

    // Schedule the notification immediately
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { conversationId },
        sound: true,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

/**
 * Cancel all pending notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
};

/**
 * Get the last notification response (when user taps a notification)
 * This is useful for handling notification taps when the app is opened from a notification
 */
export const getLastNotificationResponse = async (): Promise<Notifications.NotificationResponse | null> => {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch (error) {
    console.error('Error getting last notification response:', error);
    return null;
  }
};
