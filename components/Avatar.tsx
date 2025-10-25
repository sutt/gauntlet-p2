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

  // Always render initials as base layer
  const initialsView = (
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

  // If there's a profile image URL and no error, overlay image on top of initials
  if (profileImageUrl && !imageError) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        {/* Initials as background/fallback */}
        {initialsView}
        {/* Image overlay */}
        <Image
          source={{ uri: profileImageUrl }}
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size / 2,
              zIndex: 1,
            },
          ]}
          contentFit="cover"
          cachePolicy="none"
          transition={0}
          onLoad={() => {
            console.log('[Avatar] Image loaded successfully:', profileImageUrl);
          }}
          onError={(error) => {
            console.log('[Avatar] Image error:', error, profileImageUrl);
            setImageError(true);
          }}
        />
      </View>
    );
  }

  // Show just initials if no image or error
  return initialsView;
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
