import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/auth';
import { Conversation, User } from '@/types/chat';
import {
  subscribeToConversations,
  createConversation,
  findDirectConversation,
} from '@/services/conversations';
import { getUsers } from '@/services/users';

export default function ChatsScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [creating, setCreating] = useState(false);
  const [userCache, setUserCache] = useState<Record<string, User>>({});

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');

  // Subscribe to conversations
  useEffect(() => {
    if (!user) {
      console.log('🔍 ChatsScreen: No user logged in');
      setLoading(false);
      return;
    }

    console.log('🔍 ChatsScreen: Subscribing to conversations for user:', user.uid);

    const unsubscribe = subscribeToConversations(
      user.uid,
      async (convs) => {
        console.log('🔍 ChatsScreen: Received', convs.length, 'conversations');
        if (convs.length > 0) {
          console.log('🔍 ChatsScreen: First conversation:', {
            id: convs[0].id,
            participants: convs[0].participants,
          });
        }
        setConversations(convs);

        // Fetch user profiles for all participants
        const allParticipants = new Set<string>();
        convs.forEach(conv => {
          conv.participants.forEach(p => {
            if (p !== user.uid) {
              allParticipants.add(p);
            }
          });
        });

        if (allParticipants.size > 0) {
          const users = await getUsers(Array.from(allParticipants));
          const newCache: Record<string, User> = {};
          users.forEach(u => {
            newCache[u.id] = u;
          });
          setUserCache(prev => ({ ...prev, ...newCache }));
        }

        setLoading(false);
      },
      (error) => {
        console.error('❌ ChatsScreen: Error subscribing to conversations:', error);
        console.error('❌ ChatsScreen: Error details:', error.message);
        setLoading(false);
        Alert.alert('Error', 'Failed to load conversations. Please try again.');
      }
    );

    return unsubscribe;
  }, [user]);

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const handleCreateConversation = async () => {
    if (!newUserId.trim()) {
      Alert.alert('Error', 'Please enter a user ID');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a conversation');
      return;
    }

    setCreating(true);

    try {
      const otherUserId = newUserId.trim();

      // Check if conversation already exists
      const existing = await findDirectConversation(user.uid, otherUserId);

      if (existing) {
        // Navigate to existing conversation
        setModalVisible(false);
        setNewUserId('');
        router.push(`/chat/${existing.id}`);
        Alert.alert('Info', 'Conversation already exists');
        return;
      }

      // Create new conversation
      const conversationId = await createConversation([otherUserId], user.uid);

      setModalVisible(false);
      setNewUserId('');

      // Navigate to the new conversation
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to create conversation. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    // Get the other user(s) in the conversation
    const otherParticipants = item.participants.filter(p => p !== user?.uid);

    // Get display names from user cache
    const displayNames = otherParticipants
      .map(userId => userCache[userId]?.displayName || userId)
      .filter(Boolean);

    const displayText = displayNames.length > 0
      ? displayNames.join(', ')
      : 'Unknown User';

    return (
      <TouchableOpacity
        style={[styles.conversationItem, { borderBottomColor: borderColor }]}
        onPress={() => handleConversationPress(item.id)}
      >
        <View style={styles.avatarPlaceholder}>
          <ThemedText style={styles.avatarText}>
            {displayText[0]?.toUpperCase() || '?'}
          </ThemedText>
        </View>

        <View style={styles.conversationContent}>
          <ThemedText type="defaultSemiBold" style={styles.conversationName}>
            {displayText}
          </ThemedText>
          <ThemedText style={styles.conversationPreview}>
            Tap to open conversation
          </ThemedText>
        </View>

        <View style={styles.conversationMeta}>
          <ThemedText style={styles.timestamp}>Now</ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading conversations...</ThemedText>
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ThemedText>Please log in to view your chats</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <ThemedText type="title">Chats</ThemedText>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No conversations yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Tap the + button to start a new chat
            </ThemedText>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: tintColor }]}
        onPress={() => setModalVisible(true)}
      >
        <ThemedText style={styles.fabText}>+</ThemedText>
      </TouchableOpacity>

      {/* Create Conversation Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              New Conversation
            </ThemedText>

            <ThemedText style={styles.modalLabel}>
              Enter User ID:
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { borderColor, color: textColor }]}
              placeholder="user-id-here"
              placeholderTextColor="#999"
              value={newUserId}
              onChangeText={setNewUserId}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ThemedText style={styles.modalHint}>
              For testing: Use any user ID like &ldquo;test-user-2&rdquo;
            </ThemedText>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor }]}
                onPress={() => {
                  setModalVisible(false);
                  setNewUserId('');
                }}
              >
                <ThemedText>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: tintColor }]}
                onPress={handleCreateConversation}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.createButtonText}>Create</ThemedText>
                )}
              </TouchableOpacity>
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
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: 14,
    opacity: 0.6,
  },
  conversationMeta: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 36,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    padding: 24,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
