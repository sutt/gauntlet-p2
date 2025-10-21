import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { sendMessage, subscribeToMessages, markMessagesAsRead } from '@/services/messages';
import { getUser } from '@/services/users';
import { getConversation } from '@/services/conversations';
import { Message, User } from '@/types/chat';
import { formatMessageTime, getDateDividerText } from '@/utils/date-format';
import { formatLastSeen, isUserOnline } from '@/services/presence';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Type for items in the FlatList (can be message or date divider)
type ChatListItem =
  | { type: 'message'; data: Message }
  | { type: 'dateDivider'; data: { date: Date; text: string } };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]); // Milestone 7: Optimistic UI
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [otherUser, setOtherUser] = useState<User | null>(null); // Milestone 8: Other user profile

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

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
  useEffect(() => {
    if (!id || !user) return;

    const fetchConversationData = async () => {
      const conversation = await getConversation(id);
      if (!conversation) return;

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
  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToMessages(
      id,
      (newMessages) => {
        setMessages(newMessages);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to messages:', error);
        setLoading(false);
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
  const allMessages = useMemo(() => {
    return [...messages, ...pendingMessages];
  }, [messages, pendingMessages]);

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
      await sendMessage(id, failedMessage.text, user.uid, userName);

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

  const handleSend = async () => {
    if (!inputText.trim() || !user || !id) return;

    const messageText = inputText;
    setInputText(''); // Clear input immediately for better UX

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
      await sendMessage(id, messageText, user.uid, userName);

      // Milestone 7: Remove from pending messages on success (will appear in server messages)
      setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } catch (error) {
      console.error('Error sending message:', error);
      // Milestone 7: Mark as failed (keep in pending for retry)
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: 'failed' as const } : m
        )
      );
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

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {/* Show sender name for other users' messages */}
        {!isOwnMessage && (
          <ThemedText style={styles.senderName}>
            {message.senderName}
          </ThemedText>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwnMessage
              ? { backgroundColor: '#007AFF' } // iOS blue, consistent across platforms
              : { backgroundColor: '#E5E5EA' },
            // Milestone 7: Visual feedback for sending/failed messages
            message.status === 'sending' && { opacity: 0.6 },
            message.status === 'failed' && { backgroundColor: '#FF3B30' },
          ]}
        >
          <ThemedText
            style={[
              styles.messageText,
              isOwnMessage ? { color: '#fff' } : { color: '#000' },
            ]}
          >
            {message.text}
          </ThemedText>
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
        </View>
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
            {otherUser?.displayName || 'Loading...'}
          </ThemedText>
          {otherUser && (
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
        data={chatListItems}
        renderItem={renderChatItem}
        keyExtractor={(item, index) =>
          item.type === 'message'
            ? item.data.id
            : `divider-${item.data.text}-${index}`
        }
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No messages yet. Start the conversation!
            </ThemedText>
          </View>
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
        <TextInput
          style={[styles.input, { borderColor, color: textColor }]}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={5000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() && !sending ? tintColor : '#ccc' },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.sendButtonText}>Send</ThemedText>
          )}
        </TouchableOpacity>
      </View>
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
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
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
});
