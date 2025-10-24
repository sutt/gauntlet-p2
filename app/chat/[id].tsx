import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { useNotifications } from '@/context/notifications';
import { useThemeColor } from '@/hooks/use-theme-color';
import { sendMessage, subscribeToMessages, markMessagesAsRead, loadMoreMessages, SendMessageData } from '@/services/messages';
import { getUser } from '@/services/users';
import { getConversation } from '@/services/conversations';
import { Message, User } from '@/types/chat';
import { formatMessageTime, getDateDividerText } from '@/utils/date-format';
import { formatLastSeen, isUserOnline } from '@/services/presence';
import { pickImage, uploadImageToStorage, ImageUploadProgress } from '@/utils/image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import TranslationModal from '@/components/TranslationModal';
import { Image } from 'expo-image';

// Type for items in the FlatList (can be message or date divider)
type ChatListItem =
  | { type: 'message'; data: Message }
  | { type: 'dateDivider'; data: { date: Date; text: string } };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { setCurrentConversation } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]); // Milestone 7: Optimistic UI
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [otherUser, setOtherUser] = useState<User | null>(null); // Milestone 8: Other user profile
  const [isGroupChat, setIsGroupChat] = useState(false); // Milestone 10: Track if conversation is a group
  const [groupName, setGroupName] = useState<string>(''); // Milestone 10: Store group name
  // Milestone 12: Pagination state
  const [lastMessageSnapshot, setLastMessageSnapshot] = useState<QueryDocumentSnapshot | null>(null);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  // Milestone 13: Auto-scroll functionality
  const flatListRef = useRef<FlatList>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  // Translation modal state
  const [translationModal, setTranslationModal] = useState<{
    visible: boolean;
    messageText: string;
  }>({
    visible: false,
    messageText: '',
  });
  // V1: Image handling state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  // Milestone 14: Notify NotificationsProvider when entering/exiting this conversation
  // This prevents notifications from being shown for messages in the current conversation
  useEffect(() => {
    if (!id) return;

    console.log('🔔 ChatScreen: Setting current conversation to:', id);
    setCurrentConversation(id);

    // Clear current conversation when leaving this screen
    return () => {
      console.log('🔔 ChatScreen: Clearing current conversation');
      setCurrentConversation(null);
    };
  }, [id, setCurrentConversation]);

  // Fetch current user's display name
  useEffect(() => {
    if (!user) return;

    getUser(user.uid).then((userProfile) => {
      if (userProfile) {
        setDisplayName(userProfile.displayName);
      } else {
        // Fallback to email prefix if profile doesn't exist yet
        setDisplayName(user.email?.split('@')[0] || 'Unknown');
      }
    });
  }, [user]);

  // Milestone 8: Fetch conversation and other user's profile
  // Milestone 10: Also detect if this is a group chat
  useEffect(() => {
    if (!id || !user) return;

    const fetchConversationData = async () => {
      const conversation = await getConversation(id);
      if (!conversation) return;

      // Milestone 10: Check if this is a group chat
      const isGroup = conversation.type === 'group' || conversation.participants.length > 2;
      setIsGroupChat(isGroup);

      if (isGroup && conversation.groupName) {
        setGroupName(conversation.groupName);
      }

      // Get the other user(s) in the conversation
      const otherUserId = conversation.participants.find(p => p !== user.uid);
      if (!otherUserId) return;

      const otherUserProfile = await getUser(otherUserId);
      setOtherUser(otherUserProfile);
    };

    fetchConversationData();

    // Re-fetch periodically to update online status (every 30 seconds)
    const interval = setInterval(fetchConversationData, 30000);

    return () => clearInterval(interval);
  }, [id, user]);

  // Subscribe to real-time messages
  // Milestone 12: Enhanced to handle pagination snapshot
  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToMessages(
      id,
      (newMessages, snapshot) => {
        setMessages(newMessages);
        setLastMessageSnapshot(snapshot);
        setLoading(false);
        // Reset pagination state on new subscription
        setOlderMessages([]);
        setHasMoreMessages(true);
      },
      (error) => {
        console.error('Error subscribing to messages:', error);
        setLoading(false);
        // Milestone 13: Better error messages
        Alert.alert(
          'Connection Error',
          'Unable to load messages. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
    );

    return unsubscribe;
  }, [id, user]);

  // Milestone 9: Auto-mark messages as read when viewing conversation
  // Debounced to avoid too many writes
  useEffect(() => {
    if (!id || !user || messages.length === 0) return;

    // Find messages that current user hasn't read yet
    const unreadMessageIds = messages
      .filter((msg) => {
        // Don't mark own messages
        if (msg.senderId === user.uid) return false;
        // Check if not already read by current user
        return !msg.readBy || !msg.readBy[user.uid];
      })
      .map((msg) => msg.id);

    if (unreadMessageIds.length === 0) return;

    // Debounce marking as read (wait 500ms after messages load)
    const timer = setTimeout(() => {
      markMessagesAsRead(id, unreadMessageIds, user.uid).catch((error) => {
        console.error('Error marking messages as read:', error);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [id, user, messages]);

  // Milestone 7: Combine server messages with pending (optimistic) messages
  // Milestone 12: Include older loaded messages
  const allMessages = useMemo(() => {
    return [...olderMessages, ...messages, ...pendingMessages];
  }, [olderMessages, messages, pendingMessages]);

  // Milestone 13: Auto-scroll to bottom when new messages arrive or when sending
  useEffect(() => {
    if (shouldAutoScroll && allMessages.length > 0 && !loading) {
      // Small delay to ensure FlatList has rendered
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [allMessages.length, shouldAutoScroll, loading]);

  // Process messages to insert date dividers
  const chatListItems = useMemo(() => {
    const items: ChatListItem[] = [];
    let lastDate: string | null = null;

    allMessages.forEach((message) => {
      const messageDate = new Date(message.timestamp);
      const dateDividerText = getDateDividerText(messageDate);

      // Add date divider if date changed
      if (dateDividerText !== lastDate) {
        items.push({
          type: 'dateDivider',
          data: { date: messageDate, text: dateDividerText },
        });
        lastDate = dateDividerText;
      }

      // Add message
      items.push({
        type: 'message',
        data: message,
      });
    });

    return items;
  }, [allMessages]);

  // Milestone 7: Retry failed message
  const retryMessage = async (tempId: string) => {
    if (!user || !id) return;

    // Find the failed message
    const failedMessage = pendingMessages.find((m) => m.tempId === tempId);
    if (!failedMessage) return;

    // Mark as sending again
    setPendingMessages((prev) =>
      prev.map((m) =>
        m.tempId === tempId ? { ...m, status: 'sending' as const } : m
      )
    );

    try {
      const userName = displayName || user.email?.split('@')[0] || 'Unknown';
      // V1: Use new SendMessageData interface
      await sendMessage(id, { text: failedMessage.text }, user.uid, userName);

      // Remove from pending messages on success
      setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } catch (error) {
      console.error('Error retrying message:', error);
      // Mark as failed again
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: 'failed' as const } : m
        )
      );
    }
  };

  // Milestone 9: Helper function to get read receipt status
  const getReadReceiptStatus = useCallback((message: Message): 'sent' | 'read' | null => {
    // Only show for own messages
    if (message.senderId !== user?.uid) return null;

    // Don't show for pending messages
    if (message.status === 'sending' || message.status === 'failed') return null;

    // Check if any other participant has read it
    if (!message.readBy) return 'sent';

    const otherParticipantsRead = Object.keys(message.readBy).some(
      (userId) => userId !== user?.uid
    );

    return otherParticipantsRead ? 'read' : 'sent';
  }, [user]);

  // Milestone 12: Load older messages
  const handleLoadMore = useCallback(async () => {
    if (!id || !lastMessageSnapshot || loadingMore || !hasMoreMessages) {
      return;
    }

    setLoadingMore(true);
    try {
      const { messages: newOlderMessages, lastSnapshot } = await loadMoreMessages(
        id,
        lastMessageSnapshot,
        50
      );

      if (newOlderMessages.length === 0) {
        // No more messages to load
        setHasMoreMessages(false);
      } else {
        // Prepend older messages
        setOlderMessages((prev) => [...newOlderMessages, ...prev]);
        setLastMessageSnapshot(lastSnapshot);
      }
    } catch (error: any) {
      console.error('Error loading more messages:', error);
      // Milestone 13: Better error messages
      Alert.alert(
        'Could Not Load Messages',
        'Failed to load older messages. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingMore(false);
    }
  }, [id, lastMessageSnapshot, loadingMore, hasMoreMessages]);

  // Handler for long-press on message to translate
  const handleLongPressMessage = useCallback((message: Message) => {
    setTranslationModal({
      visible: true,
      messageText: message.text,
    });
  }, []);

  // V1: Handler for picking and uploading images
  const handlePickImage = async () => {
    try {
      const asset = await pickImage();
      if (!asset) return;

      setSelectedImage(asset.uri);
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };

  // V1: Handler for removing selected image
  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handleSend = async () => {
    // V1: Allow sending if either text or image is present
    if ((!inputText.trim() && !selectedImage) || !user || !id) return;

    const messageText = inputText;
    const imageUri = selectedImage;
    setInputText(''); // Clear input immediately for better UX
    setSelectedImage(null); // Clear selected image

    // Milestone 7: Generate temporary ID for optimistic message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Milestone 7: Create optimistic message
    const userName = displayName || user.email?.split('@')[0] || 'Unknown';
    const optimisticMessage: Message = {
      id: tempId,
      text: messageText,
      senderId: user.uid,
      senderName: userName,
      timestamp: new Date(),
      conversationId: id,
      status: 'sending',
      tempId,
    };

    // Milestone 7: Add to pending messages immediately (instant feedback)
    setPendingMessages((prev) => [...prev, optimisticMessage]);
    setSending(true);

    try {
      // V1: Build message data
      const messageData: SendMessageData = {
        text: messageText || undefined,
      };

      // V1: Upload image if present
      if (imageUri) {
        setUploadingImage(true);
        try {
          const uploadResult = await uploadImageToStorage(
            imageUri,
            id,
            (progress: ImageUploadProgress) => {
              setUploadProgress(progress.progress);
            }
          );

          messageData.mediaUrl = uploadResult.url;
          messageData.mediaPath = uploadResult.path;
          messageData.mediaMetadata = {
            width: uploadResult.width,
            height: uploadResult.height,
            fileSize: uploadResult.fileSize,
            mimeType: uploadResult.mimeType,
          };

          console.log('✅ Image uploaded successfully:', uploadResult.url);
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
          // Remove pending message
          setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
          return;
        } finally {
          setUploadingImage(false);
          setUploadProgress(0);
        }
      }

      // Send message with text and/or image
      await sendMessage(id, messageData, user.uid, userName);

      // Milestone 7: Remove from pending messages on success (will appear in server messages)
      setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Milestone 7: Mark as failed (keep in pending for retry)
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: 'failed' as const } : m
        )
      );
      // Milestone 13: Show error to user
      const errorMessage = error?.message?.includes('permission')
        ? 'You do not have permission to send messages in this conversation.'
        : 'Failed to send message. Please check your connection and tap "Retry" to try again.';
      Alert.alert('Message Failed', errorMessage, [{ text: 'OK' }]);
    } finally {
      setSending(false);
    }
  };

  const renderChatItem = ({ item }: { item: ChatListItem }) => {
    // Render date divider
    if (item.type === 'dateDivider') {
      return (
        <View style={styles.dateDividerContainer}>
          <View style={styles.dateDividerLine} />
          <ThemedText style={styles.dateDividerText}>
            {item.data.text}
          </ThemedText>
          <View style={styles.dateDividerLine} />
        </View>
      );
    }

    // Render message
    const message = item.data;
    const isOwnMessage = message.senderId === user?.uid;

    // Milestone 10: In group chats, show sender name for ALL messages (including your own)
    const shouldShowSenderName = isGroupChat;

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {/* Milestone 10: Show sender name in group chats for all messages */}
        {shouldShowSenderName && (
          <ThemedText style={[
            styles.senderName,
            isOwnMessage && styles.ownSenderName
          ]}>
            {isOwnMessage ? 'You' : message.senderName}
          </ThemedText>
        )}
        <Pressable
          onLongPress={() => handleLongPressMessage(message)}
          style={[
            styles.messageBubble,
            isOwnMessage
              ? { backgroundColor: '#007AFF' } // iOS blue, consistent across platforms
              : { backgroundColor: '#E5E5EA' },
            // Milestone 7: Visual feedback for sending/failed messages
            message.status === 'sending' && { opacity: 0.6 },
            message.status === 'failed' && { backgroundColor: '#FF3B30' },
            // V1: Adjust padding for images
            message.mediaUrl && { padding: 4 },
          ]}
        >
          {/* V1: Display image if present */}
          {message.mediaUrl && (
            <TouchableOpacity
              onPress={() => setFullScreenImage(message.mediaUrl!)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: message.mediaUrl }}
                style={[
                  styles.messageImage,
                  {
                    aspectRatio:
                      message.mediaMetadata?.width && message.mediaMetadata?.height
                        ? message.mediaMetadata.width / message.mediaMetadata.height
                        : 1,
                  },
                ]}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />
            </TouchableOpacity>
          )}
          {/* Display text if present (can be caption for image) */}
          {message.text && (
            <ThemedText
              style={[
                styles.messageText,
                isOwnMessage ? { color: '#fff' } : { color: '#000' },
                // V1: Add top margin if image is also present
                message.mediaUrl && { marginTop: 8, padding: 8 },
              ]}
            >
              {message.text}
            </ThemedText>
          )}
          <View style={styles.messageFooter}>
            <ThemedText
              style={[
                styles.timestamp,
                isOwnMessage ? { color: '#fff' } : { color: '#000' },
              ]}
            >
              {formatMessageTime(message.timestamp)}
              {/* Milestone 7: Status indicators */}
              {message.status === 'sending' && ' • Sending...'}
              {message.status === 'failed' && ' • Failed'}
            </ThemedText>
            {/* Milestone 9: Read receipts - show checkmarks for own messages */}
            {isOwnMessage && !message.status && (() => {
              const receiptStatus = getReadReceiptStatus(message);
              if (!receiptStatus) return null;

              return (
                <View style={styles.readReceiptContainer}>
                  {receiptStatus === 'read' ? (
                    // Double checkmark for read
                    <View style={styles.doubleCheckmark}>
                      <Ionicons
                        name="checkmark-done"
                        size={14}
                        color={isOwnMessage ? '#4CD964' : '#999'}
                      />
                    </View>
                  ) : (
                    // Single checkmark for sent
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={isOwnMessage ? '#fff' : '#999'}
                    />
                  )}
                </View>
              );
            })()}
          </View>
        </Pressable>
        {/* Milestone 7: Retry button for failed messages */}
        {message.status === 'failed' && message.tempId && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => retryMessage(message.tempId!)}
          >
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading messages...</ThemedText>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor }]}>
        <ThemedText>Please log in to view messages</ThemedText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : insets.bottom}
    >
      {/* Milestone 8: Chat Header with Online Status */}
      {/* Milestone 10: Show group name for group chats */}
      <View
        style={[
          styles.chatHeader,
          { borderBottomColor: borderColor, paddingTop: insets.top },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={tintColor} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
            {isGroupChat ? (groupName || 'Group Chat') : (otherUser?.displayName || 'Loading...')}
          </ThemedText>
          {/* Milestone 10: Don't show online status for group chats */}
          {!isGroupChat && otherUser && (
            <View style={styles.headerStatus}>
              {isUserOnline(otherUser.lastSeen) && (
                <View style={styles.headerOnlineDot} />
              )}
              <ThemedText style={styles.headerStatusText}>
                {formatLastSeen(otherUser.lastSeen)}
              </ThemedText>
            </View>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={chatListItems}
        renderItem={renderChatItem}
        keyExtractor={(item, index) =>
          item.type === 'message'
            ? item.data.id
            : `divider-${item.data.text}-${index}`
        }
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          // Milestone 13: Detect if user scrolled up manually
          const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
          const isNearBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 50;
          setShouldAutoScroll(isNearBottom);
        }}
        scrollEventThrottle={400}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No messages yet. Start the conversation!
            </ThemedText>
          </View>
        }
        ListHeaderComponent={
          // Milestone 12: Load More button at top of chat
          hasMoreMessages && messages.length >= 50 ? (
            <View style={styles.loadMoreContainer}>
              <TouchableOpacity
                style={[styles.loadMoreButton, { borderColor }]}
                onPress={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={tintColor} />
                ) : (
                  <>
                    <Ionicons name="arrow-up" size={16} color={tintColor} />
                    <ThemedText style={[styles.loadMoreText, { color: tintColor }]}>
                      Load older messages
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.inputContainer,
          {
            borderTopColor: borderColor,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        {/* V1: Image preview */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.imagePreview}
              contentFit="cover"
            />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={handleRemoveImage}
            >
              <Ionicons name="close-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* V1: Upload progress indicator */}
        {uploadingImage && (
          <View style={styles.uploadProgressContainer}>
            <ActivityIndicator size="small" color={tintColor} />
            <ThemedText style={styles.uploadProgressText}>
              Uploading... {(uploadProgress * 100).toFixed(0)}%
            </ThemedText>
          </View>
        )}

        <View style={styles.inputRow}>
          {/* V1: Image picker button */}
          <TouchableOpacity
            style={styles.imagePickerButton}
            onPress={handlePickImage}
            disabled={sending || uploadingImage}
          >
            <Ionicons name="image-outline" size={24} color={tintColor} />
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { borderColor, color: textColor }]}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={5000}
            editable={!sending && !uploadingImage}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  (inputText.trim() || selectedImage) && !sending && !uploadingImage
                    ? tintColor
                    : '#ccc',
              },
            ]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !selectedImage) || sending || uploadingImage}
          >
            {sending || uploadingImage ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.sendButtonText}>Send</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Translation Modal */}
      <TranslationModal
        visible={translationModal.visible}
        onClose={() => setTranslationModal({ visible: false, messageText: '' })}
        messageText={translationModal.messageText}
        conversationId={id}
        defaultTargetLanguage="Spanish"
      />

      {/* V1: Full-screen image viewer */}
      <Modal
        visible={!!fullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullScreenImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  // Milestone 8: Chat header with online status
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759', // iOS green
    marginRight: 6,
  },
  headerStatusText: {
    fontSize: 12,
    opacity: 0.7,
  },
  messagesList: {
    padding: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  messageBubbleContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 12,
    opacity: 0.7,
  },
  // Milestone 10: Style for own sender name in group chats
  ownSenderName: {
    marginLeft: 0,
    marginRight: 12,
    textAlign: 'right',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 16,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
  // Milestone 9: Read receipt styles
  readReceiptContainer: {
    marginLeft: 4,
    justifyContent: 'center',
  },
  doubleCheckmark: {
    // Container for double checkmark icon
  },
  retryButton: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  imagePickerButton: {
    padding: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // V1: Image preview styles
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  uploadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  uploadProgressText: {
    marginLeft: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  // V1: Message image styles
  messageImage: {
    width: 200,
    maxHeight: 300,
    borderRadius: 12,
  },
  // V1: Full-screen image viewer styles
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  dateDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  dateDividerText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },
  // Milestone 12: Load More button styles
  loadMoreContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
