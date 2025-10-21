# Milestone 2 - Developer Checklist

## ✅ Implementation Status

All code has been written and is ready to use!

---

## 🎉 No Manual Steps Required!

Unlike Milestone 1, Milestone 2 works immediately after deployment. The Firestore security rules from Milestone 1 already support:
- ✅ Reading conversations where you're a participant
- ✅ Creating conversations with yourself in participants
- ✅ Querying conversations by participant

**If you completed Milestone 1 setup, you're ready to go!**

---

## 🧪 Testing Checklist

### [ ] 1. Start the App

```bash
npm start
# Press 'w' for web or scan QR for mobile
```

**Status**: ⚠️ REQUIRED

---

### [ ] 2. Navigate to Chats Tab

**Steps**:
1. Log in to the app
2. Look at bottom tab navigation
3. Tap the second tab (Chats) with the message icon

**Verify**:
- [ ] Chats tab is visible in navigation
- [ ] Tapping it shows the Chats screen
- [ ] See either conversations or empty state

**Status**: ⚠️ REQUIRED

---

### [ ] 3. View Empty State (if no conversations)

**If you see "No conversations yet"**:
- [ ] Message is centered and clear
- [ ] See "Tap the + button" hint
- [ ] Floating "+" button visible in bottom-right

**Status**: ✅ OPTIONAL (only if no conversations exist)

---

### [ ] 4. Create Your First Conversation

**Steps**:
1. Tap the "+" button
2. Modal appears with "New Conversation" title
3. Enter another user's Firebase Auth UID
   - Get from: Firebase Console → Authentication → Users
   - Copy the User UID
4. Tap "Create" button

**Verify**:
- [ ] Modal opens smoothly
- [ ] Can type in input field
- [ ] "Create" button shows loading spinner
- [ ] Modal closes after creation
- [ ] Navigated to chat screen
- [ ] Can send messages

**Status**: ⚠️ REQUIRED - Core feature

---

### [ ] 5. Return to Conversation List

**Steps**:
1. From chat screen, tap back button or Chats tab
2. Should see conversation list

**Verify**:
- [ ] Conversation appears in list
- [ ] Shows user ID(s) of other participant(s)
- [ ] Avatar shows first letter of user ID
- [ ] Can tap to open again

**Status**: ⚠️ REQUIRED

---

### [ ] 6. Create Second Conversation

**Steps**:
1. Tap "+" button again
2. Enter different user ID
3. Create conversation

**Verify**:
- [ ] Second conversation created
- [ ] Both conversations visible in list
- [ ] Can navigate to either conversation

**Status**: ⚠️ REQUIRED

---

### [ ] 7. Test Duplicate Prevention

**Steps**:
1. Note one of your existing conversation's user ID
2. Try creating conversation with same user again
3. Tap "Create"

**Verify**:
- [ ] Alert shows "Conversation already exists"
- [ ] Navigated to existing conversation (not new one)
- [ ] No duplicate in conversation list

**Status**: ✅ RECOMMENDED

---

### [ ] 8. Test Real-time Updates (Optional)

**Requires**: Two devices/browsers with different accounts

**Steps**:
1. Device A: View Chats tab as User A
2. Device B: Create conversation with User A
3. Watch Device A

**Verify**:
- [ ] Conversation appears on Device A instantly
- [ ] No refresh needed
- [ ] Both users can open and message

**Status**: ✅ OPTIONAL - Advanced testing

---

### [ ] 9. Send Messages in Multiple Chats

**Steps**:
1. Open first conversation, send message
2. Return to list
3. Open second conversation, send message
4. Return to list

**Verify**:
- [ ] Messages saved in correct conversations
- [ ] No mixing of messages between conversations
- [ ] Can navigate freely between chats

**Status**: ⚠️ REQUIRED

---

### [ ] 10. Test Persistence

**Steps**:
1. Create 2-3 conversations and send messages
2. Close app/browser
3. Reopen and log in
4. Navigate to Chats tab

**Verify**:
- [ ] All conversations still there
- [ ] Can open each conversation
- [ ] Messages are preserved
- [ ] No data loss

**Status**: ⚠️ REQUIRED

---

## 🐛 Troubleshooting

### Problem: Chats tab not visible

**Fix**: Restart dev server
```bash
# Stop the server (Ctrl+C)
npm start
```

---

### Problem: "Permission denied" when loading conversations

**Fix**:
1. Ensure Milestone 1 security rules are deployed
2. `firebase deploy --only firestore:rules`
3. Verify you're logged in

---

### Problem: "Failed to create conversation"

**Common causes**:
- User ID doesn't exist in Firebase Auth
- Security rules not deployed
- Not logged in

**Fix**:
1. Verify user ID exists: Firebase Console → Authentication
2. Check browser console for specific error
3. Deploy rules if needed

---

### Problem: Conversations not updating in real-time

**Fix**:
1. Check browser console for listener errors
2. Refresh page to verify data loads
3. Verify Firestore connection is active

---

## 📋 Completion Checklist

Before moving to Milestone 3, verify:

- [ ] Can navigate to Chats tab
- [ ] Can create conversations from UI
- [ ] Conversations appear in list
- [ ] Can tap to open conversations
- [ ] Can send messages in each conversation
- [ ] Duplicate conversations are prevented
- [ ] Loading states appear appropriately
- [ ] Empty state shows when no conversations
- [ ] No errors in browser console
- [ ] Works on your primary platform (web/iOS/Android)

---

## 🎯 Success Criteria

Milestone 2 is complete when:

- ✅ User can view list of conversations
- ✅ User can create conversations from UI
- ✅ User can navigate to individual chats
- ✅ Conversations update in real-time
- ✅ Duplicate conversations are prevented
- ✅ UI is responsive and intuitive

---

## 🚀 Ready for Milestone 3?

Once all checks pass, proceed to:

**Milestone 3: "User Profiles"**

This will replace user IDs with actual display names, making the chat much more user-friendly!

Changes in Milestone 3:
- Create user documents on signup
- Show "John Doe" instead of "abc123xyz"
- Store display names with messages
- Much better UX overall

See `.dev-docs/tasks-mvp.md` for implementation details.

---

## 📚 Documentation Reference

- **Testing Guide**: `.dev-docs/milestone2-testing.md`
- **Implementation Summary**: `.dev-docs/milestone2-summary.md`
- **Main README**: `CHAT_README.md`
- **Architecture**: `.dev-docs/mvp-arch.md`

---

## 🎊 Congratulations!

You've completed Milestone 2!

Major achievements:
- ✅ Full conversation list UI
- ✅ Create conversations without touching Firestore
- ✅ Real-time updates across all conversations
- ✅ Clean, intuitive navigation
- ✅ Duplicate prevention

**The app is becoming fully functional!** 🚀

---

**Time to Complete**: ~5 minutes for testing

**Next Milestone**: Milestone 3 - "User Profiles" (~2-3 days implementation)
