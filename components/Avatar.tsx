import React from 'react';
import { View, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from './themed-text';
import { getInitials, getAvatarColor } from '@/utils/image';

/**
 * V1: Avatar component
 * Shows profile image or initials with colored background
 */

interface AvatarProps {
  userId: string; // For color consistency
  displayName: string; // For initials
  profileImageUrl?: string; // Optional profile image
  size?: number; // Diameter in pixels
  style?: ViewStyle | ImageStyle;
}

export function Avatar({
  userId,
  displayName,
  profileImageUrl,
  size = 40,
  style,
}: AvatarProps) {
  const initials = getInitials(displayName);
  const backgroundColor = getAvatarColor(userId);
  const [imageError, setImageError] = React.useState(false);
  const imageUrlRef = React.useRef(profileImageUrl);

  // Track URL changes with ref (no state updates, no re-renders)
  if (imageUrlRef.current !== profileImageUrl) {
    imageUrlRef.current = profileImageUrl;
    // Reset error synchronously without triggering re-render
    if (imageError) {
      setImageError(false);
    }
  }

  if (profileImageUrl && !imageError) {
    // Show profile image with error fallback
    return (
      <Image
        source={{ uri: profileImageUrl }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style as any, // Cast to any to allow ViewStyle
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        placeholder={require('@/assets/images/partial-react-logo.png')}
        placeholderContentFit="cover"
        onError={() => {
          setImageError(true);
        }}
      />
    );
  }

  // Show initials with colored background
  return (
    <View
      style={[
        styles.avatar,
        styles.initialsContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style,
      ]}
    >
      <ThemedText
        style={[
          styles.initials,
          {
            fontSize: size * 0.4, // Scale font with avatar size
            color: '#fff',
          },
        ]}
      >
        {initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: '600',
  },
});
