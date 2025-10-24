# Firebase Realtime Database - Production Deployment Guide

This document explains how to deploy the typing indicator feature (using Firebase Realtime Database) from local emulators to production.

## Overview

The typing indicator feature uses **Firebase Realtime Database (RTDB)** instead of Firestore because:
- ⚡ RTDB has < 50ms latency (vs Firestore's ~100-300ms)
- 🔄 Typing indicators need real-time updates
- 💰 RTDB is cost-effective for ephemeral data (free tier: 1GB storage, 10GB downloads/month)

## Current Setup (Local Emulators)

Currently, the app is configured to use local Firebase emulators for development:

```typescript
// config/firebase.ts
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  connectDatabaseEmulator(database, 'localhost', 9000);
}
```

The RTDB emulator runs on **port 9000** (configured in firebase.json).

## Production Deployment Steps

### 1. Enable Realtime Database in Firebase Console

**Important**: RTDB must be enabled in your Firebase project before deploying.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`will-msg-app-v2`)
3. Navigate to **Build > Realtime Database**
4. Click **Create Database**
5. Choose database location (select same region as Firestore: `us-central1` or closest to your users)
6. Start in **locked mode** (we'll deploy rules next)

### 2. Deploy Database Security Rules

Deploy the RTDB security rules to production:

```bash
cd /home/user/gauntlet/pkgs/p2/hello-expo
firebase deploy --only database
```

This will deploy the rules from `database.rules.json`:

```json
{
  "rules": {
    "typing": {
      "$conversationId": {
        "$userId": {
          ".read": "auth != null",
          ".write": "auth != null && auth.uid == $userId",
          ".validate": "newData.isNumber() || newData.val() == null"
        }
      }
    }
  }
}
```

**Security Notes**:
- Only authenticated users can read typing state
- Users can only write their own typing state
- Typing values must be numbers (timestamps) or null

### 3. Update Environment Variables

**For Production Builds**: Set `EXPO_PUBLIC_USE_EMULATOR=false` in your production environment

**Local Development**: Keep `EXPO_PUBLIC_USE_EMULATOR=true` in `.env.local`

```bash
# .env.local (development - uses emulators)
EXPO_PUBLIC_USE_EMULATOR=true

# Production environment variables (EAS Build, etc.)
EXPO_PUBLIC_USE_EMULATOR=false
```

### 4. No Code Changes Needed!

✅ The app automatically switches between emulator and production based on the `EXPO_PUBLIC_USE_EMULATOR` flag.

```typescript
// config/firebase.ts
export const database = getDatabase(app);

// Only connects to emulator if flag is true
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  connectDatabaseEmulator(database, 'localhost', 9000);
}
```

### 5. Verify RTDB Rules in Console

After deployment, verify the rules in Firebase Console:

1. Go to **Realtime Database > Rules** tab
2. Confirm the rules match `database.rules.json`
3. Click **Publish** if needed

## Database Structure (Production)

The production RTDB will have this structure:

```
/
└── typing/
    ├── {conversationId1}/
    │   ├── {userId1}: 1698765432000  (timestamp)
    │   └── {userId2}: null           (stopped typing)
    └── {conversationId2}/
        └── {userId3}: 1698765435000
```

**Data Lifecycle**:
- When user starts typing: Set timestamp
- After 2s of inactivity: Set to null
- After 5s: Client ignores stale typing indicators
- On app close: Typing state cleared automatically

## Cost Estimates

### Free Tier Limits:
- **Storage**: 1 GB
- **Downloads**: 10 GB/month
- **Connections**: 100 simultaneous

### Estimated Usage (1000 active users):
- **Storage**: < 1 MB (typing indicators are ephemeral)
- **Downloads**: ~100 MB/month (very lightweight)
- **Connections**: Peak of ~50 simultaneous users in active chats

✅ **Verdict**: Typing indicators will stay well within free tier limits.

## Monitoring & Debugging

### Firebase Console Monitoring

1. Go to **Realtime Database > Usage** tab
2. Monitor:
   - Active connections
   - Bandwidth usage
   - Storage usage

### Debug in Development

To see RTDB emulator data during development:

1. Start emulators: `firebase emulators:start`
2. Open Emulator UI: http://localhost:4000
3. Navigate to **Realtime Database** tab
4. View `/typing` path to see live typing indicators

### Common Issues

**Issue**: Typing indicator not showing
- Check: Is RTDB enabled in Firebase Console?
- Check: Are security rules deployed?
- Check: Is user authenticated?
- Check: Console logs for RTDB connection errors

**Issue**: RTDB connection timeout
- Check: Network connectivity
- Check: Firebase project ID is correct
- Check: RTDB is in the same region as Firestore

## Rollback Plan

If issues occur in production:

1. **Disable typing indicators** (client-side only):
   ```typescript
   // In chat screen, comment out typing subscription
   // useEffect(() => {
   //   subscribeToTypingState(...);
   // }, []);
   ```

2. **Keep RTDB enabled**: No need to disable RTDB itself, as typing data is ephemeral and won't cause issues

## Testing Checklist

Before deploying to production:

- [ ] RTDB enabled in Firebase Console
- [ ] Security rules deployed: `firebase deploy --only database`
- [ ] Environment variable set: `EXPO_PUBLIC_USE_EMULATOR=false`
- [ ] Test typing indicator in staging environment
- [ ] Verify no console errors related to RTDB
- [ ] Confirm typing state clears on user disconnect
- [ ] Test with multiple users in same conversation
- [ ] Verify emulator still works for local development

## Future Improvements

Potential enhancements for v2:

1. **Presence System**: Extend RTDB to track online/offline status more accurately
2. **Read Receipts**: Use RTDB for real-time read receipt updates
3. **Delivery Status**: Show message delivery status in real-time
4. **Typing Animation**: Add animated dots for typing indicator

## References

- [Firebase RTDB Documentation](https://firebase.google.com/docs/database)
- [RTDB Security Rules](https://firebase.google.com/docs/database/security)
- [RTDB Pricing](https://firebase.google.com/pricing)
- [RTDB vs Firestore Comparison](https://firebase.google.com/docs/database/rtdb-vs-firestore)
