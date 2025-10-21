# Milestone 11: Unread Counts - Testing Guide

## Debug Steps

### 1. Check Browser Console Logs

After sending a message, you should see these logs in your browser console:

```
📨 Sending message - Participants: [Array] Unread updates: [Array of field paths]
✅ Sent message and incremented unread count for X participants
🔥 Firestore conversation test-chat-1 unreadCount: {userId: 1, ...}
📊 Conversation test-chat-1: {unreadCount: {...}, userId: "...", calculatedCount: 1}
```

### 2. Check Firebase Console

**MANUAL: Go to Firebase Console to verify unread counts are being written**

1. Open Firebase Console: https://console.firebase.google.com
2. Navigate to your project
3. Go to Firestore Database
4. Find a conversation document (e.g., `test-chat-1`)
5. Check if the `unreadCount` field exists
6. Verify it has a structure like:
   ```json
   {
     "unreadCount": {
       "user-abc": 0,
       "user-def": 3
     }
   }
   ```

### 3. Common Issues

#### Issue: No `unreadCount` field in existing conversations

**Solution**: The field is created when you send a NEW message after implementing Milestone 11.

**Steps**:
1. Open a conversation
2. Send a new message
3. Check Firebase Console - the `unreadCount` field should now exist
4. Switch to the other user's account
5. Check the chat list - you should see a badge with count

#### Issue: Badge not showing even though unreadCount exists

**Check**:
1. Is the `unreadCount` field a map/object with userId keys?
2. Is your current user's ID in the map?
3. Is the count > 0 for your user?

**Debug**:
Look for the console log: `📊 Conversation test-chat-1: {...}`
- Check if `unreadCount` is defined
- Check if `userId` matches your logged-in user
- Check if `calculatedCount` is > 0

#### Issue: Firestore increment() not working

**Possible causes**:
1. Firestore rules might be blocking the update
2. The field path `unreadCount.userId` might not be supported

**Test manually in Firebase Console**:
1. Open a conversation document
2. Add field `unreadCount` → Map
3. Add key with a userId → Number → value 5
4. Save
5. Refresh your app
6. You should see a badge with "5"

### 4. Manual Test Procedure

**Two-User Test**:

1. **User A** (Sender):
   - Log in as User A
   - Open a conversation with User B
   - Send a message: "Test unread counts"
   - Observe console: Should log increment for User B
   - Badge should NOT appear for User A (sender)

2. **User B** (Recipient):
   - Log in as User B
   - Go to chat list
   - Conversation with User A should show badge "1"
   - Tab icon should show badge "1" (total)
   - Open the conversation
   - Badge should disappear
   - Close and return to chat list
   - Badge should remain at "0"

3. **Verify in Firebase**:
   - Check conversation document
   - `unreadCount.userA_id` should be 0
   - `unreadCount.userB_id` should be 0 (after opening)

### 5. If Badges Still Don't Show

**Try this manual fix**:

1. Go to Firebase Console
2. Open a test conversation document
3. Manually add/update the `unreadCount` field:
   ```json
   {
     "unreadCount": {
       "YOUR_USER_ID_HERE": 5
     }
   }
   ```
4. Save the document
5. Refresh your app
6. You should immediately see a badge with "5"
7. If you see it, the UI is working - the issue is with the increment logic

### 6. Check for Errors

**In Browser Console**, look for:
- Any red error messages
- Firestore permission denied errors
- TypeError or undefined errors

**Common Error**: "Missing or insufficient permissions"
- **Solution**: Deploy Firestore rules: `firebase deploy --only firestore:rules`

### 7. Firestore Rules Check

**MANUAL: Verify Firestore rules allow conversation updates**

The rule should look like:
```javascript
match /conversations/{conversationId} {
  allow update: if isSignedIn() && request.auth.uid in resource.data.participants;
}
```

This allows participants to update the conversation, including the `unreadCount` field.

## Expected Behavior After Fix

✅ Sending a message increments recipient's unread count
✅ Badge appears on conversation item in chat list
✅ Badge shows correct number (1, 2, 3, etc.)
✅ Badge shows "99+" for 100+ unread
✅ Tab icon shows total unread count
✅ Opening conversation resets count to 0
✅ Badge disappears when count is 0
✅ Real-time updates when messages arrive

## Contact Points

If badges still don't show after these steps, please share:
1. Screenshot of Firebase Console showing a conversation document with `unreadCount`
2. Browser console logs showing the debug output
3. Screenshot of the chat list (to see if badge is there)
4. Your current user ID (from console log)
