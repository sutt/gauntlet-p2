# Milestone 1 - Developer Checklist

## ✅ Implementation Status

All code has been written! Now you need to complete these manual steps:

---

## 🔧 MANUAL STEPS REQUIRED

### [ ] 1. Deploy Firestore Security Rules

**Why**: Without this, users will get "Permission denied" errors

**Command**:
```bash
firebase deploy --only firestore:rules
```

**Alternative**: Copy `firestore.rules` content into Firebase Console → Firestore Database → Rules

**Verify**:
- Go to Firebase Console → Firestore Database → Rules
- Rules should show participant-based access control for conversations and messages

**Status**: ⚠️ CRITICAL - Required for chat to work

---

### [ ] 2. Create Test Conversation

**Why**: Need a conversation to test the chat (UI for creating conversations comes in Milestone 2)

**Steps**:
1. Firebase Console → Firestore Database
2. Create collection: `conversations`
3. Add document: `test-chat-1`
4. Add fields:
   - `participants` (array): [your-user-id]
   - `lastMessage` (string): ""
   - `lastMessageTime` (timestamp): current time
   - `lastMessageSenderId` (string): ""

**Get your User ID**: Firebase Console → Authentication → Users → Copy UID

**Verify**: Document exists at `conversations/test-chat-1` in Firestore

**Status**: ⚠️ REQUIRED - Needed to test chat

---

### [ ] 3. Test the Chat

**Command**:
```bash
npm start
# Press 'w' for web
```

**Navigate to**: `http://localhost:8081/chat/test-chat-1`

**Test**:
- [ ] Page loads without errors
- [ ] See loading state briefly
- [ ] See empty state message
- [ ] Can type in input field
- [ ] Send button is disabled when empty
- [ ] Send button is enabled with text
- [ ] Can send a message
- [ ] Message appears in chat
- [ ] Message persists after refresh
- [ ] Message visible in Firestore Console

**Status**: ⚠️ REQUIRED - Verify implementation works

---

### [ ] 4. Test Real-time Updates (Optional but Recommended)

**Why**: Verify messages sync across devices

**Steps**:
1. Open app in two browsers
2. Log in with different accounts
3. Add both user IDs to conversation `participants` array
4. Send message from browser 1
5. Verify it appears in browser 2 instantly

**Status**: ✅ OPTIONAL - But validates core feature

---

### [ ] 5. Verify Security

**Test**: Try accessing conversation without being in participants

**Expected**: Should get permission denied

**Status**: ✅ OPTIONAL - Security should work if rules deployed correctly

---

## 📋 Completion Checklist

Before moving to Milestone 2, verify:

- [ ] Firestore security rules deployed
- [ ] Test conversation created
- [ ] Can send messages successfully
- [ ] Messages appear in real-time
- [ ] Messages persist after refresh
- [ ] No errors in browser console
- [ ] Linter passes (`npm run lint`)

---

## 🎯 Ready for Milestone 2?

Once all checkboxes are complete, you're ready to proceed to:

**Milestone 2: "Chat List"**
- Display list of all conversations
- Create new conversations from UI
- Navigate to chat by tapping conversation

See `.dev-docs/tasks-mvp.md` for details.

---

## 📚 Documentation Files

Quick reference to all docs created:

- `QUICKSTART_CHAT.md` - 5-minute setup guide
- `CHAT_README.md` - Full documentation
- `.dev-docs/milestone1-testing.md` - Detailed testing guide
- `.dev-docs/milestone1-summary.md` - Implementation summary
- `.dev-docs/mvp-arch.md` - Architecture reference
- `.dev-docs/requirements-mvp.md` - Requirements
- `.dev-docs/tasks-mvp.md` - All milestones

---

## 🐛 Troubleshooting

### Problem: "Permission denied" when sending messages

**Cause**: Security rules not deployed or user not in participants

**Fix**:
1. Deploy rules: `firebase deploy --only firestore:rules`
2. Verify user ID in participants array
3. Check you're logged in

---

### Problem: Conversation not found

**Cause**: Conversation document doesn't exist

**Fix**: Create conversation document (see Step 2 above)

---

### Problem: Messages not appearing

**Cause**: JavaScript errors or Firestore connection issue

**Fix**:
1. Check browser console for errors
2. Verify Firebase project ID in `.env.local`
3. Check internet connection
4. Verify conversation ID matches URL

---

## 🎉 Success!

When all steps are complete and tests pass, you have:

✅ A working real-time chat application
✅ Secure Firebase integration
✅ Clean, maintainable code
✅ A solid foundation for the MVP

**Congratulations on completing Milestone 1!** 🚀

---

**Time to Complete Manual Steps**: ~5 minutes

**Ready to Start**: Milestone 2 implementation (~2-3 days)
