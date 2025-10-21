# Chat Input Box Positioning Fix - Android

## Problem Description

On Android devices, the "Type a message" input box in `chat/[id]` is being covered by the system navigation buttons (home and back buttons). This creates a poor user experience as users cannot see what they're typing.

### Expected Behavior

1. When the keyboard is **not active**: Input box should be positioned above the system navigation bar
2. When the keyboard is **activated**: Input box should move up with the keyboard, remaining visible
3. When the keyboard is **dismissed**: Input box should return to its original position above the navigation bar

## Technical Context

### React Native Keyboard Handling

React Native provides several approaches for handling keyboard interactions:

- `KeyboardAvoidingView`: Automatically adjusts view position when keyboard appears
- `KeyboardAvoidingView.behavior`: Platform-specific behavior (`padding`, `height`, or `position`)
- `android:windowSoftInputMode` in AndroidManifest.xml: Controls how the window interacts with soft keyboard

### Expo Router Context

Since this is an Expo Router project using file-based routing (`chat/[id]`), we need to ensure keyboard handling works within the router's screen structure.

## Investigation Steps

1. **Locate the chat input component**
   - Find `app/chat/[id].tsx` or equivalent chat screen file
   - Identify the TextInput component for "Type a message"
   - Check current layout structure and styling

2. **Check AndroidManifest.xml configuration**
   - Verify `android:windowSoftInputMode` setting
   - Common values: `adjustResize`, `adjustPan`, `adjustNothing`

3. **Review current keyboard handling**
   - Check if `KeyboardAvoidingView` is already implemented
   - Verify any existing keyboard event listeners
   - Check for `react-native-keyboard-aware-scroll-view` or similar libraries

## Proposed Solutions

### Option 1: KeyboardAvoidingView (Recommended)

Wrap the chat input area with `KeyboardAvoidingView`:

```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'android' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'android' ? 90 : 0}
  style={{ flex: 1 }}
>
  {/* Chat messages */}
  <View style={styles.inputContainer}>
    <TextInput placeholder="Type a message" />
  </View>
</KeyboardAvoidingView>
```

### Option 2: AndroidManifest.xml + SafeAreaView

Combine manifest configuration with SafeAreaView:

1. Set `android:windowSoftInputMode="adjustResize"` in AndroidManifest.xml
2. Use `SafeAreaView` or `useSafeAreaInsets()` to handle bottom insets
3. Add paddingBottom based on safe area insets

### Option 3: react-native-keyboard-controller

Use a more robust keyboard handling library:
- Better performance than KeyboardAvoidingView
- More predictable behavior across Android versions
- Provides hooks like `useKeyboardAnimation()`

## Implementation Plan

1. **Audit current implementation**
   - Read chat screen file
   - Document current layout structure
   - Test on Android emulator/device

2. **Implement fix**
   - Choose appropriate solution based on current setup
   - Add KeyboardAvoidingView or alternative
   - Configure keyboardVerticalOffset to account for navigation bar

3. **Handle safe areas**
   - Import `useSafeAreaInsets` from `react-native-safe-area-context`
   - Add bottom padding/margin equal to `insets.bottom`
   - Ensure input stays above system navigation

4. **Test behavior**
   - Input visible when keyboard closed
   - Input moves up correctly when keyboard opens
   - Input returns to original position when keyboard closes
   - Works with different keyboard heights
   - No visual glitches during transitions

## Potential Gotchas

- **Keyboard offset calculation**: May need to adjust `keyboardVerticalOffset` based on header height
- **Android API differences**: Behavior varies between Android versions (especially <11 vs >=11)
- **Navigation bar types**: Gestural vs button-based navigation affects inset values
- **FlatList/ScrollView**: If messages are in a scrollable list, may need `keyboardShouldPersistTaps="handled"`

## Testing Checklist

- [ ] Test on Android device with button navigation
- [ ] Test on Android device with gesture navigation
- [ ] Test with different keyboard heights (default, GBoard, SwiftKey)
- [ ] Verify input doesn't overlap with messages
- [ ] Verify smooth animation transitions
- [ ] Test rapid keyboard open/close cycles
- [ ] Check landscape orientation

## References

- [React Native KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview)
- [React Native Keyboard API](https://reactnative.dev/docs/keyboard)
- [Expo Router Keyboard Handling](https://docs.expo.dev/router/advanced/keyboard/)
- [Android windowSoftInputMode](https://developer.android.com/guide/topics/manifest/activity-element#wsoft)
