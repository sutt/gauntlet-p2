# Milestone 3: "User Profiles" - Testing Guide

## Overview

This guide walks you through testing Milestone 3: User Profiles feature.

**Goal**: Verify that user profiles are automatically created and display names are shown throughout the app.

## Prerequisites

Before testing, ensure:
- ✅ Milestone 1 completed (Chat screen working)
- ✅ Milestone 2 completed (Chat list working)
- ✅ Firestore security rules deployed
- ✅ App is running (`npm start`)

## Test 1: Auto-Create User Profile on Login

### Purpose
Verify that logging in automatically creates a user profile in Firestore.

### Steps

1. **Create a new test user in Firebase:**
   - Go to Firebase Console → Authentication → Users
   - Click "Add user"
   - Email: `alice@example.com`
   - Password: `password123`
   - Click "Add user"

2. **Log in with the new user in the app:**
   - Open your app
   - Log out if already logged in
   - Log in with `alice@example.com` / `password123`

3. **Verify profile was created:**
   - Go to Firebase Console → Firestore Database
   - Navigate to `users` collection
   - Find document with the user's UID
   - Verify it contains:
     ```
     id: [user's UID]
     email: "alice@example.com"
     displayName: "alice"
     createdAt: [timestamp]
     lastSeen: [timestamp]
     online: true
     ```

### Expected Results
- ✅ Login succeeds
- ✅ User document created in Firestore
- ✅ Display name is "alice" (email prefix)
- ✅ All fields populated correctly
- ✅ No errors in console

### Troubleshooting
- If profile not created: Check security rules allow user creation
- If login fails: Check Firebase Authentication is enabled
- Check browser console for error messages

---

## Test 2: Display Names in Chat Messages

### Purpose
Verify that sender names appear above messages in the chat screen.

### Steps

1. **Create two test users if not already:**
   - User 1: `alice@example.com` (from Test 1)
   - User 2: `bob@example.com` (create new)

2. **Log in as Alice:**
   - Email: `alice@example.com`
   - Password: [your password]

3. **Create conversation with Bob:**
   - Navigate to Chats tab
   - Tap "+" button
   - Enter Bob's User ID (from Firebase Console → Authentication)
   - Tap "Create"

4. **Send message as Alice:**
   - Type: "Hello Bob!"
   - Tap "Send"

5. **Verify message appearance:**
   - Message appears on right side (your message)
   - No sender name above your own message
   - Message sent successfully

6. **Log in as Bob (different browser or incognito):**
   - Open app in new browser/incognito
   - Log in as `bob@example.com`
   - Navigate to the conversation with Alice

7. **Send message as Bob:**
   - Type: "Hi Alice!"
   - Tap "Send"

8. **Verify sender names:**
   - Bob sees: "alice" above Alice's message (left side)
   - Bob sees: His own message on right side, no name
   - Alice sees: "bob" above Bob's message (left side)
   - Alice sees: Her own message on right side, no name

### Expected Results
- ✅ Messages show sender names for other users
- ✅ Own messages don't show sender name
- ✅ Names are display names, not user IDs
- ✅ Names appear consistently

### Visual Example
```
[Left side - Alice's view]
bob
┌─────────────┐
│ Hi Alice!   │
└─────────────┘
3:45 PM

[Right side - Alice's view]
        ┌─────────────┐
        │ Hello Bob!  │
        └─────────────┘
        3:44 PM
```

---

## Test 3: Display Names in Chat List

### Purpose
Verify that conversation list shows display names instead of user IDs.

### Steps

1. **Log in as Alice**
2. **Navigate to Chats tab**
3. **Check conversation items:**
   - Should show "bob" instead of Bob's user ID
   - Avatar shows "B" (first letter of name)
   - If multiple conversations, all show names

4. **Create another conversation:**
   - Tap "+" button
   - Add another user (e.g., `charlie@example.com`)
   - Conversation created

5. **Return to Chats list:**
   - Should now see both conversations
   - "bob" for first conversation
   - "charlie" for second conversation

### Expected Results
- ✅ Conversation list shows display names
- ✅ Avatar letters match display names
- ✅ No user IDs visible
- ✅ Names update when profiles change

### Visual Example
```
Chats
─────────────────

[B] bob
    Tap to open conversation
    Now

[C] charlie
    Tap to open conversation
    Now
```

---

## Test 4: Existing User Migration

### Purpose
Verify that existing users (before Milestone 3) get profiles on next login.

### Steps

1. **If you have an existing user from Milestone 1 or 2:**
   - This user won't have a profile yet

2. **Log out and log back in with the existing user**

3. **Verify profile created:**
   - Check Firestore `users` collection
   - Document should now exist
   - Display name should be email prefix

4. **Test in conversation:**
   - Send a message
   - Other users should see your display name
   - Check chat list shows your name in conversations

### Expected Results
- ✅ Existing users get profiles on next login
- ✅ Display names populate automatically
- ✅ No user action required
- ✅ Backwards compatible with old conversations

---

## Test 5: User Profile Caching

### Purpose
Verify that user profiles are cached for performance.

### Steps

1. **Open browser console (F12)**
2. **Navigate to Chats tab**
3. **Watch console logs:**
   - Should see: "🔍 ChatsScreen: Received X conversations"
   - User profiles fetched once per conversation load

4. **Navigate away and back:**
   - Go to Profile tab
   - Return to Chats tab
   - User profiles should be fetched again (expected)

5. **Open a conversation:**
   - User's display name loads from cache
   - No additional Firestore reads for user profile

### Expected Results
- ✅ User profiles fetched once per session
- ✅ Cached data used for subsequent views
- ✅ No excessive Firestore reads
- ✅ Names appear instantly from cache

---

## Test 6: Fallback Behavior

### Purpose
Verify graceful handling when user profiles don't exist.

### Steps

1. **Manually create a conversation with invalid user ID:**
   - Firebase Console → Firestore Database
   - Create conversation with participants: `[your-uid, "fake-user-id-123"]`

2. **Open Chats tab in app**

3. **Verify conversation appears:**
   - Should show "fake-user-id-123" (fallback to ID)
   - Avatar shows "F" (first letter)
   - No errors or crashes

4. **Open the conversation:**
   - Should work normally
   - If "fake-user" sends message, shows their ID as name

### Expected Results
- ✅ App doesn't crash with missing profiles
- ✅ Falls back to user ID gracefully
- ✅ No error messages to user
- ✅ Console logs error but continues

---

## Test 7: Multiple Participant Conversations

### Purpose
Verify display names work with 3+ participants (group chat prep).

### Steps

1. **Create conversation with 3+ participants:**
   - Firebase Console → Firestore Database
   - Create conversation with participants: `[alice-uid, bob-uid, charlie-uid]`

2. **Open conversation as Alice**

3. **Verify chat list shows:**
   - "bob, charlie" (comma-separated names)
   - Avatar shows "B" (first participant)

4. **Send messages from different users:**
   - Alice sends: "Hey everyone!"
   - Bob sends: "Hi team!"
   - Charlie sends: "Hello!"

5. **Verify all sender names appear:**
   - Each message shows correct sender name
   - Names are display names, not IDs

### Expected Results
- ✅ Group conversations show all participant names
- ✅ Comma-separated in chat list
- ✅ Each message shows correct sender
- ✅ No confusion about who sent what

---

## Common Issues & Solutions

### Issue: User profile not created on login

**Symptoms**:
- User document missing in Firestore
- Display name shows as user ID

**Solutions**:
1. Check Firestore security rules are deployed
2. Check security rules allow user document creation:
   ```javascript
   allow create: if isSignedIn() && request.auth.uid == userId;
   ```
3. Check browser console for permission errors
4. Try logging out and back in
5. Check Firebase project connection

### Issue: Display names not showing in chat list

**Symptoms**:
- Chat list shows user IDs instead of names
- Empty conversation names

**Solutions**:
1. Wait a few seconds for user profiles to load
2. Check Firestore `users` collection has profiles
3. Check security rules allow reading user documents:
   ```javascript
   allow read: if isSignedIn();
   ```
4. Check browser console for Firestore errors
5. Try refreshing the page

### Issue: Sender names not appearing in messages

**Symptoms**:
- Messages don't show sender name above bubble
- Shows "Unknown" instead of name

**Solutions**:
1. Check message document has `senderName` field
2. Older messages might not have sender name (expected)
3. Send a new message to verify it works
4. Check user profile exists in Firestore
5. Check message service is passing sender name

### Issue: "Permission denied" errors

**Symptoms**:
- Firestore errors in console
- Features not working
- Login fails

**Solutions**:
1. Deploy Firestore security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
2. Verify rules in Firebase Console
3. Check user is authenticated
4. Check rules match the template in `firestore.rules`

---

## Performance Testing

### Load Testing

1. **Create 10+ conversations**
2. **Navigate to Chats tab**
3. **Verify:**
   - List loads in < 2 seconds
   - All names display correctly
   - No lag when scrolling
   - User profiles cached

### Memory Testing

1. **Open conversation**
2. **Send 50+ messages**
3. **Navigate away and back**
4. **Verify:**
   - No memory leaks
   - App remains responsive
   - Names load instantly from cache

---

## Success Criteria Checklist

Mark each item as you verify it works:

- [ ] User profiles auto-created on login
- [ ] Display names extracted from email prefix
- [ ] Sender names shown in chat messages
- [ ] User names shown in conversation list
- [ ] User profile caching working
- [ ] Fallback to user ID when profile missing
- [ ] No errors in console
- [ ] No crashes or freezes
- [ ] Works with multiple participants
- [ ] Performance is acceptable

---

## Next Steps After Testing

Once all tests pass:

1. ✅ Milestone 3 is complete!
2. Proceed to **Milestone 4 or 5**:
   - Milestone 4: Security testing (optional)
   - Milestone 5: Last message preview
3. Update documentation with any issues found
4. Consider enhancements (edit display name, profile photos)

---

## Test Report Template

Copy this template to document your testing:

```
# Milestone 3 Test Report

Date: [DATE]
Tester: [NAME]
Environment: [Web/iOS/Android]

## Test Results

| Test | Status | Notes |
|------|--------|-------|
| Auto-create profile | ✅/❌ | |
| Display names in chat | ✅/❌ | |
| Display names in list | ✅/❌ | |
| Existing user migration | ✅/❌ | |
| User caching | ✅/❌ | |
| Fallback behavior | ✅/❌ | |
| Multiple participants | ✅/❌ | |

## Issues Found

1. [Issue description]
   - Severity: Low/Medium/High
   - Steps to reproduce:
   - Expected:
   - Actual:

## Overall Result

✅ PASS / ❌ FAIL

Ready for next milestone: YES / NO
```

---

**Good luck with testing! 🧪**
