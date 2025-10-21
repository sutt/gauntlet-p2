# Plan: Update colorScheme Method to Only Allow Light Mode

## Current State

The application currently supports both light and dark color schemes through the `useColorScheme` hook, which automatically detects the system's preferred theme setting.

### Key Files Affected
- `hooks/use-color-scheme.ts` - Native platform implementation
- `hooks/use-color-scheme.web.ts` - Web platform implementation
- `hooks/use-theme-color.ts` - Theme color resolution hook
- `constants/theme.ts` - Color definitions
- `app/_layout.tsx` - Root layout with navigation theme
- `app/(tabs)/_layout.tsx` - Tab navigation layout
- `components/themed-view.tsx` - Themed view component
- `components/themed-text.tsx` - Themed text component
- `components/parallax-scroll-view.tsx` - Parallax scroll component
- `components/ui/collapsible.tsx` - Collapsible UI component
- `app.json` - Expo configuration

## Objective

Force the application to only use light mode, disabling dark mode entirely and ignoring system preferences.

## Implementation Plan

### Step 1: Update Expo Configuration
**File: `app.json`**

- Change `userInterfaceStyle` from `"automatic"` to `"light"`
- Remove dark mode splash screen configuration (optional, but recommended for consistency)

```json
{
  "expo": {
    "userInterfaceStyle": "light",
    "plugins": [
      ["expo-splash-screen", {
        "backgroundColor": "#ffffff"
        // Remove "dark" configuration
      }]
    ]
  }
}
```

**Impact:** Forces the app to use light mode at the Expo configuration level

### Step 2: Update Native Hook Implementation
**File: `hooks/use-color-scheme.ts`**

Replace the current implementation to always return `'light'`:

```typescript
export function useColorScheme() {
  return 'light' as const;
}
```

**Impact:** Ensures native platforms (iOS/Android) always use light mode

### Step 3: Update Web Hook Implementation
**File: `hooks/use-color-scheme.web.ts`**

Replace the current implementation to always return `'light'`:

```typescript
export function useColorScheme() {
  return 'light' as const;
}
```

**Impact:** Ensures web platform always uses light mode, removes unnecessary hydration logic

### Step 4: Update Theme Color Hook (Optional)
**File: `hooks/use-theme-color.ts`**

Simplify the implementation since theme will always be `'light'`:

```typescript
import { Colors } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = 'light'; // Always light mode
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
```

**Impact:** Simplifies theme resolution logic

### Step 5: Update Root Layout (Optional)
**File: `app/_layout.tsx`**

Consider hardcoding to use `DefaultTheme` instead of conditionally switching:

```typescript
<ThemeProvider value={DefaultTheme}>
  {/* ... */}
</ThemeProvider>
```

**Impact:** Removes conditional theme switching from React Navigation

### Step 6: Cleanup Dark Mode Colors (Optional - Future)
**File: `constants/theme.ts`**

Consider removing the `dark` color definitions if not needed:

```typescript
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  // Remove dark colors if not needed
};
```

**Impact:** Simplifies codebase by removing unused dark theme colors

## Testing Checklist

After implementation, verify the following:

- [ ] App displays in light mode on iOS devices (regardless of system setting)
- [ ] App displays in light mode on Android devices (regardless of system setting)
- [ ] App displays in light mode on web (regardless of system setting)
- [ ] Tab bar colors are correct
- [ ] All themed components (ThemedView, ThemedText) display correctly
- [ ] ParallaxScrollView header displays correctly
- [ ] Collapsible components display correctly
- [ ] Splash screen shows only light background
- [ ] No console errors or warnings related to theming
- [ ] App behavior is consistent across all platforms

## Rollback Plan

If issues arise, revert changes in reverse order:

1. Restore `app.json` to `"userInterfaceStyle": "automatic"`
2. Restore `hooks/use-color-scheme.ts` to re-export from React Native
3. Restore `hooks/use-color-scheme.web.ts` with hydration logic
4. Restore any other modified files

## Notes

- **Minimal Approach:** Steps 1-3 are sufficient to force light mode
- **Complete Approach:** Steps 1-6 provide a cleaner, more maintainable solution
- **User Experience:** Users will no longer see dark mode even if they prefer it system-wide
- **Accessibility:** Ensure light mode colors meet WCAG contrast requirements
- **Future Flexibility:** Keep dark mode colors defined in case requirement changes

## Estimated Effort

- **Minimal Implementation (Steps 1-3):** ~15 minutes
- **Complete Implementation (Steps 1-6):** ~45 minutes
- **Testing:** ~30 minutes per platform

## Priority

**Required Changes:** Steps 1-3
**Recommended Changes:** Steps 4-5
**Optional Cleanup:** Step 6
