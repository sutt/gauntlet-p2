import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/Avatar';
import { auth, db } from '@/config/firebase';
import { useAuth } from '@/context/auth';
import { getUser, updateUserProfile } from '@/services/users';
import { pickImage, uploadProfileImage, ImageUploadProgress } from '@/utils/image';
import { signOut } from 'firebase/auth';
import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfileScreen() {
  const { user: authUser } = useAuth();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasSignatureKeys, setHasSignatureKeys] = useState(false);
  const [signatureFingerprint, setSignatureFingerprint] = useState('');
  const [showKeysModal, setShowKeysModal] = useState(false);

  const router = useRouter();
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

  // Check for signature keys whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!authUser) return;

      const checkSignatureKeys = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          const data = userDoc.data();

          if (data?.publicKey) {
            setHasSignatureKeys(true);
            setSignatureFingerprint(data.publicKeyFingerprint || '');
            console.log('[Profile] Keys detected. Fingerprint:', data.publicKeyFingerprint);
          } else {
            setHasSignatureKeys(false);
            setSignatureFingerprint('');
            console.log('[Profile] No keys found');
          }
        } catch (error) {
          console.error('Error checking signature keys:', error);
        }
      };

      checkSignatureKeys();
    }, [authUser])
  );

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleDigitalSignatures = () => {
    console.log('[Profile] handleDigitalSignatures called');
    console.log('[Profile] hasSignatureKeys:', hasSignatureKeys);
    console.log('[Profile] signatureFingerprint:', signatureFingerprint);

    if (hasSignatureKeys) {
      console.log('[Profile] Showing keys modal');
      setShowKeysModal(true);
    } else {
      console.log('[Profile] Navigating to setup screen');
      router.push('/settings/signature-setup');
    }
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
          onPress={handleDigitalSignatures}
        >
          <Ionicons name="shield-checkmark-outline" size={24} color={tintColor} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.actionButtonText}>Digital Signatures</ThemedText>
            {hasSignatureKeys && (
              <ThemedText style={styles.actionButtonSubtext}>✓ Keys configured</ThemedText>
            )}
          </View>
          {!hasSignatureKeys && (
            <Ionicons name="chevron-forward" size={20} color={tintColor} />
          )}
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

      {/* Digital Signatures Keys Modal */}
      <Modal
        visible={showKeysModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowKeysModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <ThemedText type="subtitle" style={styles.modalTitle}>
                  Digital Signatures
                </ThemedText>
                <TouchableOpacity onPress={() => setShowKeysModal(false)}>
                  <Ionicons name="close" size={28} color={textColor} />
                </TouchableOpacity>
              </View>

              {/* Status */}
              <View style={styles.keysStatusSection}>
                <View style={styles.statusBadge}>
                  <Ionicons name="shield-checkmark" size={24} color="green" />
                  <ThemedText style={styles.statusText}>Keys Configured</ThemedText>
                </View>
                <ThemedText style={styles.statusDescription}>
                  Your signature keys are set up and ready to use. You can now sign messages in conversations.
                </ThemedText>
              </View>

              {/* Fingerprint */}
              <View style={styles.fingerprintSection}>
                <ThemedText style={styles.inputLabel}>Key Fingerprint:</ThemedText>
                <View style={[styles.fingerprintBox, { borderColor, backgroundColor: backgroundColor + '80' }]}>
                  <ThemedText style={styles.fingerprintText} selectable>
                    {signatureFingerprint}
                  </ThemedText>
                </View>
                <ThemedText style={styles.fingerprintHint}>
                  This unique identifier proves your key's authenticity
                </ThemedText>
              </View>

              {/* Info */}
              <View style={styles.keysInfoSection}>
                <ThemedText style={styles.infoTitle}>About Digital Signatures:</ThemedText>
                <ThemedText style={styles.infoText}>• Sign messages to prove authenticity</ThemedText>
                <ThemedText style={styles.infoText}>• AI agents can verify your signatures</ThemedText>
                <ThemedText style={styles.infoText}>• Signatures are tamper-proof</ThemedText>
                <ThemedText style={styles.infoText}>• Keys are stored securely on the server</ThemedText>
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.saveButton,
                    { backgroundColor: tintColor },
                  ]}
                  onPress={() => setShowKeysModal(false)}
                >
                  <ThemedText style={styles.saveButtonText}>OK</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
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
  actionButtonSubtext: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
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
  // Digital Signatures Modal styles
  keysStatusSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'green',
  },
  statusDescription: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  fingerprintSection: {
    marginBottom: 20,
  },
  fingerprintBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  fingerprintText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    wordBreak: 'break-all',
  },
  fingerprintHint: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  keysInfoSection: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
    marginBottom: 4,
  },
});
