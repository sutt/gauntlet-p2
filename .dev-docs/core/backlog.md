
### v1
- feat: addin images to chats, storing them in backend
- feat: adding optional upload image to user profile
    - allow them to upload in the profile
- feat: adding edit field for user profile
- 
- feat: people tab: display all users available with a search
    - implement pagination
- feat: new conversation: direct chat uses 
- feat: add a "is typing" indicator.
- bug: new conversation appears in conuter-party's chats list before the first message is sent
- bug: chat/[id] screen input box doesn't handle lower keyboard layout correctly.
- bug: permission err on login screen for prescence



### v2
- splash screen / branding
- clean up:
    - remove console logs
    - remove typescript / lint errs
    - implement feedback
- bug: goto newest messages onOpen chat/[id]
    - opening conversation (new messages) 
        with page_legnth > screen_height doesnt scroll down
- feat: send user message via username
- feat: online status in group conversation 