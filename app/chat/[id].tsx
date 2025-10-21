import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { sendMessage, subscribeToMessages } from '@/services/messages';
import { getUser } from '@/services/users';
import { Message } from '@/types/chat';
import { formatMessageTime, getDateDividerText } from '@/utils/date-format';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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

// Type for items in the FlatList (can be message or date divider)
type ChatListItem =
  | { type: 'message'; data: Message }
  | { type: 'dateDivider'; data: { date: Date; text: string } };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]); // Milestone 7: Optimistic UI
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');

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
