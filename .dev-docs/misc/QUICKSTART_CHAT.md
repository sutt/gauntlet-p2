# Chat Feature Quick Start Guide

## 🚀 Get Your Chat Working in 5 Minutes

### Step 1: Deploy Security Rules (2 minutes)

```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

✅ **Done?** Go to Firebase Console → Firestore Database → Rules to verify

---

### Step 2: Create Test Conversation (1 minute)

1. **Get your User ID**:
   - Firebase Console → Authentication → Users
   - Copy your User UID

2. **Create Conversation**:
   - Firebase Console → Firestore Database
   - Add Collection: `conversations`
   - Add Document: `test-chat-1`
   - Add fields:
     ```json
     {
       "participants": ["YOUR_USER_ID_HERE"],
       "lastMessage": "",
       "lastMessageTime": [current timestamp],
       "lastMessageSenderId": ""
     }
     ```

✅ **Done?** You should see the document in Firestore

---

### Step 3: Test It! (2 minutes)

```bash
# Start the dev server
npm start

# Press 'w' for web
```

Navigate to: `http://localhost:8081/chat/test-chat-1`

✅ **Success?** You should see:
- Loading spinner (brief)
- Empty state message
- Text input at bottom
- Send button

Send a message and watch it appear! 🎉

---

## 🐛 Something Wrong?

### Can't send messages?
→ Check: Did you deploy security rules?
→ Fix: Run `firebase deploy --only firestore:rules`

### "Permission denied" error?
→ Check: Is your user ID in the `participants` array?
→ Fix: Add your User UID to the conversation document

### Conversation not found?
→ Check: Does the conversation document exist?
→ Fix: Create it in Firestore Console (Step 2)

### Not logged in?
→ Fix: Go to `/login` and sign in with your Firebase account

---

## 📱 Test on Mobile

```bash
npm start
# Scan QR code with Expo Go app
```

Navigate to the chat screen using deep linking (or wait for Milestone 2 chat list)

---

## 🎯 What's Next?

Now that chat is working:

1. **Read**: `CHAT_README.md` for full documentation
2. **Test**: Try sending messages from different devices
3. **Build**: Continue to Milestone 2 for the chat list screen

---

## 💡 Pro Tips

- **View Messages**: Firebase Console → Firestore → conversations/{id}/messages
- **Debug**: Check browser console for errors
- **Test Real-time**: Open in two browsers with different accounts
- **Clean Data**: Delete test messages from Firestore Console

---

**Need Help?**

1. Check browser console for errors
2. Read `.dev-docs/milestone1-testing.md`
3. Verify Firebase Console settings
4. Check that you're logged in

**Still Stuck?**

Check these files:
- `CHAT_README.md` - Full documentation
- `.dev-docs/milestone1-summary.md` - Implementation details
- `.dev-docs/milestone1-testing.md` - Detailed testing guide

---

**🎉 Enjoy your real-time chat!**
