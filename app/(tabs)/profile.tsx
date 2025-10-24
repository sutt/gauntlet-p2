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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  // Load user profile
  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      const profile = await getUser(authUser.uid);
      setUserProfile(profile);
      setLoading(false);
    };

    loadProfile();
  }, [authUser]);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleEditName = () => {
    if (!userProfile) return;
    setEditedDisplayName(userProfile.displayName);
    setEditModalVisible(true);
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditedDisplayName('');
  };

  const handleSaveName = async () => {
    if (!authUser || !userProfile) return;

    // Validation
    const trimmedName = editedDisplayName.trim();
    if (trimmedName.length < 2) {
      Alert.alert('Invalid Name', 'Display name must be at least 2 characters');
      return;
    }
    if (trimmedName.length > 50) {
      Alert.alert('Invalid Name', 'Display name must be less than 50 characters');
      return;
    }

    // Check if name actually changed
    if (trimmedName === userProfile.displayName) {
      setEditModalVisible(false);
      return;
    }

    try {
      setSaving(true);

      // Update in Firestore
      await updateUserProfile(authUser.uid, {
        displayName: trimmedName,
      });

      // Update local state
      setUserProfile({
        ...userProfile,
        displayName: trimmedName,
      });

      setEditModalVisible(false);
      Alert.alert('Success', 'Display name updated!');
    } catch (error: any) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', error.message || 'Failed to update display name');
    } finally {
      setSaving(false);
    }
  };

  // Validate display name for save button
  const isNameValid = () => {
    const trimmed = editedDisplayName.trim();
    return (
      trimmed.length >= 2 &&
      trimmed.length <= 50 &&
      trimmed !== userProfile?.displayName
    );
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

      // Update user profile in Firestore
      await updateUserProfile(authUser.uid, {
        profileImageUrl: uploadResult.url,
        profileImagePath: uploadResult.path,
      });

      // Update local state
      setUserProfile({
        ...userProfile,
        profileImageUrl: uploadResult.url,
        profileImagePath: uploadResult.path,
        profileImageUpdatedAt: new Date(),
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
          onPress={handleEditName}
        >
          <Ionicons name="create-outline" size={24} color={tintColor} />
          <ThemedText style={styles.actionButtonText}>Edit Display Name</ThemedText>
        </TouchableOpacity>

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

      {/* Edit Display Name Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <ThemedText type="subtitle" style={styles.modalTitle}>
                  Edit Display Name
                </ThemedText>
                <TouchableOpacity onPress={handleCancelEdit} disabled={saving}>
                  <Ionicons name="close" size={28} color={textColor} />
                </TouchableOpacity>
              </View>

              {/* Input */}
              <View style={styles.inputSection}>
                <ThemedText style={styles.inputLabel}>Display Name</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor,
                      color: textColor,
                      backgroundColor,
                    },
                  ]}
                  value={editedDisplayName}
                  onChangeText={setEditedDisplayName}
                  placeholder="Enter your display name"
                  placeholderTextColor={textColor + '80'}
                  maxLength={50}
                  autoFocus
                  editable={!saving}
                />
                <ThemedText style={styles.inputHint}>
                  {editedDisplayName.trim().length}/50 characters (min 2)
                </ThemedText>
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor }]}
                  onPress={handleCancelEdit}
                  disabled={saving}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.saveButton,
                    {
                      backgroundColor: isNameValid() ? tintColor : borderColor,
                      opacity: isNameValid() && !saving ? 1 : 0.5,
                    },
                  ]}
                  onPress={handleSaveName}
                  disabled={!isNameValid() || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.saveButtonText}>Save</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    borderWidth: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
