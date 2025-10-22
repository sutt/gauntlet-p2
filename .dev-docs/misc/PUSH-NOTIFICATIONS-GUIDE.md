# Adding Background Push Notifications

## Current State vs. Future State

### What Works Now (Foreground Only) ✅
```
User A's phone (app OPEN):
├─ New message arrives
├─ Local notification displays
└─ Works in Expo Go!
```

### What This Guide Adds (Background Push) 🎯
```
User A's phone (app CLOSED):
├─ New message arrives
├─ Cloud Function triggers
├─ FCM sends push notification
└─ Notification appears on lock screen!
```

---

## Minimal Setup (3 Main Parts)

### Part 1: Store Push Tokens (Client-Side)
### Part 2: Cloud Function (Backend)
### Part 3: Firebase Configuration

---

## Part 1: Store Push Tokens (15 minutes)

### 1.1 Update User Type

**File: `types/chat.ts`**

```typescript
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastSeen: Date;
  online: boolean;
  pushTokens?: string[];  // ← Already in schema!
}
```

Good news: This is already in your types! ✅

### 1.2 Register Push Token on Login

**Create: `services/push-tokens.ts`**

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Platform } from 'react-native';

/**
 * Register device for push notifications
 * Call this after user logs in and grants permission
 */
export const registerForPushNotifications = async (userId: string): Promise<string | null> => {
  try {
    // MANUAL: Only works on physical devices or development builds
    if (!Device.isDevice) {
      console.log('Push notifications require physical device');
      return null;
    }

    // Get permission (should already be granted from foreground notifications)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      // MANUAL: Replace with your Expo project ID
      projectId: 'your-expo-project-id', // Get from app.json or Expo dashboard
    });

    const token = tokenData.data;
    console.log('📱 Push token:', token);

    // Store token in Firestore
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pushTokens: arrayUnion(token),
    });

    // Configure Android notification channel (if needed)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

/**
 * Unregister device from push notifications
 * Call this when user logs out
 */
export const unregisterPushToken = async (userId: string, token: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    // Note: arrayRemove not imported above, add if using this
    const { arrayRemove } = await import('firebase/firestore');
    await updateDoc(userRef, {
      pushTokens: arrayRemove(token),
    });
  } catch (error) {
    console.error('Error unregistering push token:', error);
  }
};
```

### 1.3 Call Registration After Login

**Update: `app/_layout.tsx`** (or in auth context)

```typescript
import { registerForPushNotifications } from '@/services/push-tokens';

// Inside your component, after user logs in:
useEffect(() => {
  if (user && !loading) {
    const timer = setTimeout(async () => {
      // Request permissions
      await requestNotificationPermissions();

      // Register for push notifications (new!)
      await registerForPushNotifications(user.uid);
    }, 1000);

    return () => clearTimeout(timer);
  }
}, [user, loading]);
```

---

## Part 2: Cloud Function (30 minutes)

### 2.1 Install Firebase Functions

**In project root:**

```bash
# MANUAL: Install Firebase CLI
npm install -g firebase-tools

# MANUAL: Login to Firebase
firebase login

# MANUAL: Initialize Functions
firebase init functions

# Select:
# - JavaScript or TypeScript (recommend TypeScript)
# - Install dependencies: Yes
```

This creates a `functions/` directory.

### 2.2 Install Dependencies

```bash
cd functions
npm install firebase-admin
npm install expo-server-sdk
cd ..
```

### 2.3 Create Cloud Function

**File: `functions/src/index.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Expo SDK
const expo = new Expo();

/**
 * Triggered when a new message is created
 * Sends push notifications to conversation participants
 */
export const sendPushNotificationOnNewMessage = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    try {
      const message = snapshot.data();
      const conversationId = context.params.conversationId;
      const messageId = context.params.messageId;

      console.log('New message:', messageId, 'in conversation:', conversationId);

      // Get conversation to find participants
      const conversationDoc = await db.collection('conversations').doc(conversationId).get();
      if (!conversationDoc.exists) {
        console.log('Conversation not found');
        return;
      }

      const conversation = conversationDoc.data();
      if (!conversation) return;

      // Get all participants except the sender
      const participants = conversation.participants.filter(
        (participantId: string) => participantId !== message.senderId
      );

      console.log('Sending notifications to:', participants);

      // Get push tokens for all participants
      const tokens: string[] = [];
      for (const participantId of participants) {
        const userDoc = await db.collection('users').doc(participantId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.pushTokens && Array.isArray(userData.pushTokens)) {
            tokens.push(...userData.pushTokens);
          }
        }
      }

      if (tokens.length === 0) {
        console.log('No push tokens found');
        return;
      }

      console.log('Found', tokens.length, 'push tokens');

      // Filter valid Expo push tokens
      const validTokens = tokens.filter(token => Expo.isExpoPushToken(token));

      if (validTokens.length === 0) {
        console.log('No valid Expo push tokens');
        return;
      }

      // Create push notification messages
      const messages: ExpoPushMessage[] = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title: message.senderName || 'New Message',
        body: message.text.length > 100
          ? `${message.text.substring(0, 100)}...`
          : message.text,
        data: {
          conversationId,
          messageId,
          type: 'new_message',
        },
        priority: 'high',
        channelId: 'default',
      }));

      // Send notifications in chunks (Expo recommends batching)
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          console.log('Sent chunk:', ticketChunk);
        } catch (error) {
          console.error('Error sending chunk:', error);
        }
      }

      console.log('Push notifications sent:', tickets.length);
      return null;

    } catch (error) {
      console.error('Error in sendPushNotificationOnNewMessage:', error);
      return null;
    }
  });

/**
 * Optional: Clean up invalid push tokens
 * Run periodically to remove tokens that fail delivery
 */
export const cleanupInvalidPushTokens = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    // This would check for failed deliveries and remove invalid tokens
    // Implementation depends on your needs
    console.log('Cleanup job would run here');
    return null;
  });
```

### 2.4 Deploy Cloud Function

```bash
# MANUAL: Deploy to Firebase
firebase deploy --only functions

# Or deploy specific function:
firebase deploy --only functions:sendPushNotificationOnNewMessage
```

**Expected output:**
```
✔  functions[sendPushNotificationOnNewMessage(us-central1)] Successful create operation.
Function URL: https://us-central1-your-project.cloudfunctions.net/...
```

---

## Part 3: Firebase Configuration (10 minutes)

### 3.1 Update Firestore Security Rules

**File: `firestore.rules`**

Add Cloud Functions permission:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ... existing rules ...

    // Allow Cloud Functions to read/write
    // (Cloud Functions have admin privileges, but good to be explicit)
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
      // Cloud Functions can read push tokens
      allow read: if request.auth.token.firebase.sign_in_provider != null;
    }

    match /conversations/{conversationId}/messages/{messageId} {
      // ... existing rules ...

      // Cloud Functions can read messages to send notifications
      allow read: if request.auth.token.firebase.sign_in_provider != null;
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### 3.2 Get Expo Project ID

**MANUAL: Find your Expo project ID:**

Option 1: Check `app.json` or create entry:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-project-id-here"
      }
    }
  }
}
```

Option 2: Run:
```bash
eas project:info
```

Option 3: Check Expo dashboard: https://expo.dev/

Update in `services/push-tokens.ts`:
```typescript
projectId: 'your-actual-project-id',
```

---

## Part 4: Testing (5 minutes)

### 4.1 Build Development Build (Required)

Push notifications only work in development builds, not Expo Go:

```bash
# Build for Android
npx expo run:android

# Or use EAS Build
eas build --profile development --platform android
```

### 4.2 Test Push Notifications

**Steps:**
1. **Device A**: Install development build → Login → Grant permissions
2. **Device A**: Close the app completely (swipe away)
3. **Device B**: Send message to Device A
4. **Device A**: Should receive push notification on lock screen! 🎉

**Check:**
```
Device A lock screen:
┌────────────────────────────────┐
│ 🔔 hello-expo              now │
│ Alice                          │
│ Hey, are you there?            │
└────────────────────────────────┘
```

### 4.3 Debug with Logs

**Check Cloud Function logs:**
```bash
firebase functions:log --only sendPushNotificationOnNewMessage
```

**Check for:**
```
New message: xxx in conversation: yyy
Found 2 push tokens
Sent chunk: [...]
Push notifications sent: 2
```

---

## Cost Estimate (Firebase Pricing)

### Cloud Functions Pricing:
- **Free tier**: 2 million invocations/month
- **After free tier**: $0.40 per million invocations

**Example:**
- 100 active users
- 20 messages per user per day
- = 2,000 messages/day = 60,000/month
- **Cost**: FREE (well under 2M limit)

### Firestore Pricing:
- Already covered by existing usage
- Read operations for push tokens: minimal

### Expo Push Service:
- **FREE** for Expo push notifications
- Unlimited notifications
- No server needed (Expo handles delivery)

**Total Added Cost: $0** for MVP scale! 🎉

---

## Summary: What Gets Added

### Client-Side (Your App):
```typescript
// 1. Install expo-device package
npm install expo-device

// 2. Add 1 file: services/push-tokens.ts (50 lines)
// 3. Add 3 lines to _layout.tsx
// 4. Build development build (not Expo Go)
```

### Server-Side (Cloud Functions):
```typescript
// 1. Initialize Firebase Functions
firebase init functions

// 2. Install dependencies
npm install expo-server-sdk

// 3. Add 1 file: functions/src/index.ts (100 lines)
// 4. Deploy function
firebase deploy --only functions
```

### Configuration:
```
// 1. Get Expo project ID (1 min)
// 2. Update Firestore rules (5 min)
// 3. Deploy (2 min)
```

---

## Total Time Investment

| Task | Time |
|------|------|
| Part 1: Store Push Tokens | 15 min |
| Part 2: Cloud Function | 30 min |
| Part 3: Configuration | 10 min |
| Part 4: Testing | 5 min |
| **Total** | **~1 hour** |

(Plus ~10 min for development build if not done yet)

---

## File Structure After Setup

```
your-project/
├── services/
│   ├── notifications.ts          (existing - foreground)
│   └── push-tokens.ts            (NEW - token management)
├── functions/                     (NEW - Cloud Functions)
│   ├── src/
│   │   └── index.ts              (NEW - push notification logic)
│   ├── package.json
│   └── tsconfig.json
├── firestore.rules                (UPDATED - Cloud Functions access)
└── app.json                       (UPDATED - Expo project ID)
```

---

## Advantages of This Approach

### ✅ Minimal Code:
- ~150 lines total
- 1 client file + 1 Cloud Function

### ✅ Scalable:
- Handles unlimited users
- Firebase handles delivery
- No server management

### ✅ Cost-Effective:
- Free for MVP scale
- Expo Push Service is free
- Cloud Functions free tier generous

### ✅ Cross-Platform:
- Works on iOS and Android
- Same code for both
- Expo handles platform differences

### ✅ Reliable:
- Expo's push infrastructure
- Automatic retry logic
- Delivery receipts available

---

## Alternative: Firebase Cloud Messaging (FCM) Directly

Instead of Expo Push Service, you could use FCM directly:

**Pros:**
- More control over delivery
- Native push features

**Cons:**
- More complex setup (APNS certificates for iOS)
- More code to maintain
- Platform-specific configuration

**Recommendation**: Use Expo Push Service (simpler, works great)

---

## Migration Path

You can add push notifications gradually:

**Phase 1** (Current): ✅ Foreground notifications
**Phase 2** (This guide): Background push notifications
**Phase 3** (Future): Rich notifications, notification actions, etc.

Each phase is independent and non-breaking!

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install expo-device
cd functions && npm install expo-server-sdk && cd ..

# 2. Initialize Functions (if not done)
firebase init functions

# 3. Create the 2 new files (use code above)
# - services/push-tokens.ts
# - functions/src/index.ts

# 4. Deploy
firebase deploy --only functions

# 5. Build development build
npx expo run:android

# 6. Test! 🎉
```

---

## Expected Results

### Before (Foreground Only):
```
App closed → Message arrives → No notification ❌
App open → Message arrives → Notification appears ✅
```

### After (With Push):
```
App closed → Message arrives → Push notification! ✅
App open → Message arrives → Notification appears ✅
```

**Complete notification coverage!** 🎊

---

## Troubleshooting

### "Push token not generated"
**Check:**
- Using physical device or dev build (not emulator/Expo Go)
- Permissions granted
- Expo project ID correct

### "Cloud Function not triggering"
**Check:**
```bash
firebase functions:log
```
Look for errors. Common issues:
- Firestore rules blocking access
- Admin SDK not initialized

### "Notification not received"
**Check:**
- Token stored in Firestore users collection
- Cloud Function logs show "Push notifications sent"
- Device has internet connection
- App is actually closed (not just backgrounded)

---

## Next Steps

1. **Implement Part 1** (push token registration) - 15 min
2. **Test token storage** (check Firestore console) - 2 min
3. **Implement Part 2** (Cloud Function) - 30 min
4. **Deploy and test** - 10 min
5. **Celebrate!** 🎉

Total: ~1 hour to add background push notifications!

---

## Resources

- **Expo Push Notifications**: https://docs.expo.dev/push-notifications/overview/
- **Firebase Cloud Functions**: https://firebase.google.com/docs/functions
- **Expo Server SDK**: https://github.com/expo/expo-server-sdk-node
- **FCM (Alternative)**: https://firebase.google.com/docs/cloud-messaging

---

**Bottom Line**: Adding push notifications is straightforward with Firebase + Expo. The setup is minimal (~150 lines), costs nothing at MVP scale, and takes about an hour to implement and test. Your current foreground notification implementation is already 80% of the work done! 🚀
