# Milestone 1: "Hello Chat" - Testing Guide

## ✅ What We've Implemented

1. ✅ Basic chat types (Message, Conversation, User)
2. ✅ Chat screen with real-time message display
3. ✅ Message service (send and subscribe to messages)
4. ✅ Firebase integration with authentication
5. ✅ Firestore security rules

## 🔧 MANUAL STEPS REQUIRED

### Step 1: Deploy Firestore Security Rules

**MANUAL: You need to deploy the security rules to Firebase Console**

Option A - Using Firebase CLI (Recommended):
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init firestore
# Select your existing project
# Use firestore.rules when prompted

# Deploy rules
firebase deploy --only firestore:rules
```

Option B - Using Firebase Console:
1. Go to https://console.firebase.google.com
2. Select your project
3. Navigate to Firestore Database → Rules
4. Copy the contents of `firestore.rules` and paste into the rules editor
5. Click "Publish"

### Step 2: Create Test Conversation

**MANUAL: You need to manually create a conversation document in Firestore Console**

1. Go to Firebase Console → Firestore Database
2. Click "Start collection"
3. Collection ID: `conversations`
4. Document ID: `test-chat-1` (or use auto-ID)
5. Add fields:
   ```
   participants (array):
     - Add your Firebase Auth user ID (get it from Authentication tab)
     - Add another user ID (create another test account or use a friend's ID)

   lastMessage (string): "" (empty string for now)
   lastMessageTime (timestamp): current timestamp
   lastMessageSenderId (string): "" (empty string for now)
   ```
6. Click "Save"

### Step 3: Test the Chat

1. Make sure you're logged in to the app
2. Navigate to the chat screen:
   - For web: `http://localhost:8081/chat/test-chat-1`
   - For mobile: Use the navigation (we'll add chat list in Milestone 2)
3. Type a message and hit "Send"
4. The message should appear in the chat
5. Check Firebase Console - you should see the message in:
   `conversations/test-chat-1/messages/{messageId}`

### Step 4: Test Real-time Updates

1. Open the app in two different browsers/devices
2. Log in with two different accounts
3. Make sure both accounts are in the `participants` array of the conversation
4. Send a message from one device
5. You should see it appear in real-time on the other device

## 🎉 SUCCESS CRITERIA

Milestone 1 is complete when:

- ✅ User can navigate to `/chat/{id}`
- ✅ User sees loading state while messages load
- ✅ User can type a message in the input field
- ✅ User can send a message
- ✅ Message appears in the chat immediately
- ✅ Message is saved to Firestore
- ✅ Other users see the message in real-time
- ✅ Security rules prevent unauthorized access

## 🐛 Troubleshooting

### Issue: "Permission denied" error

**Solution**: Make sure:
1. Firestore security rules are deployed
2. You're logged in (check Authentication in Firebase Console)
3. Your user ID is in the conversation's `participants` array

### Issue: "Cannot read properties of undefined"

**Solution**: Make sure the conversation document exists in Firestore with the correct ID

### Issue: Messages not appearing in real-time

**Solution**:
1. Check browser console for errors
2. Verify Firestore connection is active
3. Make sure the conversation ID is correct

## 📝 Notes for Future Milestones

Things we'll add later:
- Chat list screen (Milestone 2)
- User profiles with display names (Milestone 3)
- Create conversation UI (Milestone 2)
- Timestamps (Milestone 6)
- Read receipts (Milestone 9)
- Online status (Milestone 8)
- Optimistic UI (Milestone 7)

## 🔍 Current Limitations (Expected)

- No way to create conversations from UI (manual creation only)
- No chat list (must navigate directly to `/chat/{id}`)
- Display names are email prefixes (will improve in Milestone 3)
- No user profiles yet
- No timestamps display (hardcoded format for now)
- No read receipts
- No online status
- No pagination (loads all messages)
