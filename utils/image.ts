import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/**
 * Image utilities for chat application
 * Handles picking, compressing, and uploading images
 */

export interface ImageUploadResult {
  url: string; // Firebase Storage download URL
  path: string; // Storage path
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface ImageUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number; // 0-1
}

/**
 * Request camera roll permissions
 */
export const requestImagePermissions = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }
  return true;
};

/**
 * Pick image from gallery
 */
export const pickImage = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    throw new Error('Camera roll permission is required to send images');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: false, // Allow any aspect ratio
    quality: 1, // Max quality (we'll compress later)
    exif: false, // Don't need EXIF data
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0];
};

/**
 * Take photo with camera
 */
export const takePhoto = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  // Request camera permission
  const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
  if (cameraPermission.status !== 'granted') {
    throw new Error('Camera permission is required to take photos');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0];
};

/**
 * Compress image to reasonable size
 * Target: Max 1920x1920px, ~200-500KB
 */
export const compressImage = async (
  uri: string,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<ImageManipulator.ImageResult> => {
  try {
    // Get original dimensions
    const originalImage = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );

    // If already small enough, just compress quality
    const needsResize = originalImage.width > maxWidth || originalImage.height > maxHeight;

    const manipulations: ImageManipulator.Action[] = [];

    if (needsResize) {
      // Calculate resize dimensions maintaining aspect ratio
      const aspectRatio = originalImage.width / originalImage.height;
      let newWidth = originalImage.width;
      let newHeight = originalImage.height;

      if (originalImage.width > maxWidth) {
        newWidth = maxWidth;
        newHeight = maxWidth / aspectRatio;
      }

      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = maxHeight * aspectRatio;
      }

      manipulations.push({
        resize: {
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        },
      });
    }

    // Compress
    const result = await ImageManipulator.manipulateAsync(
      uri,
      manipulations,
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
};

/**
 * Upload image to Firebase Storage with progress callback
 */
export const uploadImageToStorage = async (
  uri: string,
  conversationId: string,
  onProgress?: (progress: ImageUploadProgress) => void
): Promise<ImageUploadResult> => {
  try {
    // Compress image first
    console.log('Compressing image...');
    const compressed = await compressImage(uri);

    // Convert to blob
    const response = await fetch(compressed.uri);
    const blob = await response.blob();

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const filename = `${timestamp}_${randomId}.jpg`;
    const storagePath = `conversations/${conversationId}/images/${filename}`;

    // Create storage reference
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          if (onProgress) {
            onProgress({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              progress,
            });
          }
          console.log(`Upload progress: ${(progress * 100).toFixed(0)}%`);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(new Error('Failed to upload image'));
        },
        async () => {
          // Upload complete, get download URL
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            resolve({
              url: downloadURL,
              path: storagePath,
              width: compressed.width,
              height: compressed.height,
              fileSize: blob.size,
              mimeType: 'image/jpeg',
            });
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(new Error('Failed to get image URL'));
          }
        }
      );
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    throw new Error(error.message || 'Failed to upload image');
  }
};

/**
 * Get file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * V1: Crop image to square and resize for profile picture
 * Target: 500x500px square, ~50-100KB
 */
export const cropToSquareProfile = async (uri: string): Promise<ImageManipulator.ImageResult> => {
  try {
    // First, get the original image info
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );

    const { width, height } = result;

    // Calculate crop dimensions to make it square
    const cropSize = Math.min(width, height);
    const cropX = (width - cropSize) / 2;
    const cropY = (height - cropSize) / 2;

    // Crop to square, then resize to 500x500
    const manipulations: ImageManipulator.Action[] = [
      {
        crop: {
          originX: cropX,
          originY: cropY,
          width: cropSize,
          height: cropSize,
        },
      },
      {
        resize: {
          width: 500,
          height: 500,
        },
      },
    ];

    const cropped = await ImageManipulator.manipulateAsync(
      uri,
      manipulations,
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return cropped;
  } catch (error) {
    console.error('Error cropping image to square:', error);
    throw new Error('Failed to crop image');
  }
};

/**
 * V1: Upload profile image to Firebase Storage
 * Overwrites existing profile image if present
 */
export const uploadProfileImage = async (
  uri: string,
  userId: string,
  onProgress?: (progress: ImageUploadProgress) => void
): Promise<ImageUploadResult> => {
  try {
    // Crop and resize to square 500x500
    console.log('Cropping profile image to square...');
    const cropped = await cropToSquareProfile(uri);

    // Convert to blob
    const response = await fetch(cropped.uri);
    const blob = await response.blob();

    // Fixed filename for profile (will overwrite existing)
    const storagePath = `users/${userId}/profile.jpg`;

    // Create storage reference
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          if (onProgress) {
            onProgress({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              progress,
            });
          }
          console.log(`Profile upload progress: ${(progress * 100).toFixed(0)}%`);
        },
        (error) => {
          console.error('Profile upload error:', error);
          reject(new Error('Failed to upload profile image'));
        },
        async () => {
          // Upload complete, get download URL
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('✅ Profile image uploaded successfully!');
            console.log('📍 Storage path:', storagePath);
            console.log('🔗 Download URL:', downloadURL);
            console.log('📦 File size:', blob.size, 'bytes');

            resolve({
              url: downloadURL,
              path: storagePath,
              width: 500,
              height: 500,
              fileSize: blob.size,
              mimeType: 'image/jpeg',
            });
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(new Error('Failed to get profile image URL'));
          }
        }
      );
    });
  } catch (error: any) {
    console.error('Error uploading profile image:', error);
    throw new Error(error.message || 'Failed to upload profile image');
  }
};

/**
 * V1: Generate initials from display name
 * Used for default avatar
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';

  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    // First and last name
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // Single name - take first two characters
  return name.substring(0, 2).toUpperCase();
};

/**
 * V1: Generate consistent color from userId for default avatar
 * Uses hash to pick from predefined color palette
 */
export const getAvatarColor = (userId: string): string => {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky blue
    '#F8B739', // Orange
    '#52B788', // Green
  ];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
