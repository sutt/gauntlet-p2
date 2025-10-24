import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/Avatar';
import { auth } from '@/config/firebase';
import { useAuth } from '@/context/auth';
import { getUser, updateUserProfile } from '@/services/users';
import { pickImage, uploadProfileImage, ImageUploadProgress } from '@/utils/image';
import { signOut } from 'firebase/auth';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { User } from '@/types/chat';

export default function ProfileScreen() {
  const { user: authUser } = useAuth();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'border');

  // Load user profile
  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      const profile = await getUser(authUser.uid);
      console.log('📥 Loaded user profile from Firestore:', {
        userId: profile?.id,
        displayName: profile?.displayName,
        profileImageUrl: profile?.profileImageUrl,
        profileImagePath: profile?.profileImagePath,
      });
      setUserProfile(profile);
      setLoading(false);
    };

    loadProfile();
  }, [authUser]);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleChangePhoto = async () => {
    if (!authUser || !userProfile) return;

    try {
      // Pick image from gallery
      const asset = await pickImage();
      if (!asset) return;

      setUploading(true);

      // Upload to Firebase Storage
      const uploadResult = await uploadProfileImage(
        asset.uri,
        authUser.uid,
        (progress: ImageUploadProgress) => {
          setUploadProgress(progress.progress);
        }
      );

      console.log('✅ Profile image uploaded:', uploadResult.url);

      // Update user profile in Firestore
      await updateUserProfile(authUser.uid, {
        profileImageUrl: uploadResult.url,
        profileImagePath: uploadResult.path,
      });
      console.log('✅ Firestore updated with profileImageUrl:', uploadResult.url);

      // Update local state
      const updatedProfile = {
        ...userProfile,
        profileImageUrl: uploadResult.url,
        profileImagePath: uploadResult.path,
        profileImageUpdatedAt: new Date(),
      };
      setUserProfile(updatedProfile);
      console.log('✅ Local state updated:', {
        profileImageUrl: updatedProfile.profileImageUrl,
        userId: authUser.uid,
        displayName: updatedProfile.displayName,
      });

      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', error.message || 'Failed to update profile picture');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={tintColor} />
      </ThemedView>
    );
  }

  if (!authUser || !userProfile) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Please log in to view your profile</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.profileSection}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Avatar
            userId={authUser.uid}
            displayName={userProfile.displayName}
            profileImageUrl={userProfile.profileImageUrl}
            size={120}
          />

          {/* Change Photo Button */}
          <TouchableOpacity
            style={[styles.changePhotoButton, { backgroundColor: tintColor }]}
            onPress={handleChangePhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Upload Progress */}
        {uploading && (
          <View style={styles.uploadProgressContainer}>
            <View style={[styles.progressBar, { borderColor }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${uploadProgress * 100}%`, backgroundColor: tintColor },
                ]}
              />
            </View>
            <ThemedText style={styles.uploadProgressText}>
              Uploading... {(uploadProgress * 100).toFixed(0)}%
            </ThemedText>
          </View>
        )}

        {/* Display Name */}
        <ThemedText type="title" style={styles.displayName}>
          {userProfile.displayName}
        </ThemedText>

        {/* Email */}
        <ThemedText style={styles.email}>{authUser.email}</ThemedText>

        {/* Profile Image Info */}
        {userProfile.profileImageUrl && userProfile.profileImageUpdatedAt && (
          <ThemedText style={styles.imageInfo}>
            Updated {new Date(userProfile.profileImageUpdatedAt).toLocaleDateString()}
          </ThemedText>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor }]}
          onPress={handleChangePhoto}
          disabled={uploading}
        >
          <Ionicons name="image-outline" size={24} color={tintColor} />
          <ThemedText style={styles.actionButtonText}>Change Photo</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { borderColor }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={24} color={tintColor} />
          <ThemedText style={styles.actionButtonText}>Sign Out</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  uploadProgressContainer: {
    width: '80%',
    alignItems: 'center',
    marginTop: 16,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  uploadProgressText: {
    fontSize: 12,
    opacity: 0.7,
  },
  displayName: {
    marginBottom: 8,
  },
  email: {
    opacity: 0.7,
    marginBottom: 4,
  },
  imageInfo: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 8,
  },
  actionsSection: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
