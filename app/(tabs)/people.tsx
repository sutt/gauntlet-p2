import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/auth';
import { getAllUsers } from '@/services/users';
import { getOrCreateDirectConversation } from '@/services/conversations';
import { User } from '@/types/chat';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  View,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';

/**
 * V1: People tab - Browse and search all users
 */
export default function PeopleScreen() {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      const allUsers = await getAllUsers();

      // Filter out current user
      const otherUsers = allUsers.filter((u) => u.id !== authUser?.uid);

      // Sort by display name
      otherUsers.sort((a, b) => a.displayName.localeCompare(b.displayName));

      setUsers(otherUsers);
      setFilteredUsers(otherUsers);
      setLoading(false);
    };

    loadUsers();
  }, [authUser]);

  // Client-side search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleUserPress = (user: User) => {
    console.log('[People] User pressed:', user.id, user.displayName);
    // Use setTimeout to prevent blocking the UI thread
    setTimeout(() => {
      console.log('[People] Setting selected user...');
      try {
        setSelectedUser(user);
        console.log('[People] Selected user set successfully');
      } catch (error) {
        console.error('[People] Error setting selected user:', error);
      }
    }, 0);
  };

  const handleCloseModal = () => {
    console.log('[People] Closing modal');
    setSelectedUser(null);
    setCreatingChat(false); // Reset creating state
  };

  const handleStartChat = async () => {
    if (!authUser || !selectedUser) {
      console.warn('[People] handleStartChat called without authUser or selectedUser');
      return;
    }

    console.log('[People] Starting chat with:', selectedUser.id);

    try {
      setCreatingChat(true);

      // Create or get existing conversation
      console.log('[People] Calling getOrCreateDirectConversation...');
      const conversationId = await getOrCreateDirectConversation(
        authUser.uid,
        selectedUser.id
      );
      console.log('[People] Got conversation ID:', conversationId);

      // Close modal
      setSelectedUser(null);

      // Navigate to chat
      console.log('[People] Navigating to chat:', conversationId);
      router.push(`/chat/${conversationId}`);
    } catch (error: any) {
      console.error('[People] Error starting chat:', error);
      Alert.alert('Error', error.message || 'Failed to start chat');
    } finally {
      setCreatingChat(false);
    }
  };

  // Calculate online status (online if last seen < 5 minutes ago)
  const isUserOnline = (user: User): boolean => {
    if (!user.lastSeen) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return user.lastSeen.getTime() > fiveMinutesAgo;
  };

  // Memoize key extractor
  const keyExtractor = React.useCallback((item: User) => item.id, []);

  const renderUserItem = React.useCallback(({ item }: { item: User }) => {
    const online = isUserOnline(item);

    return (
      <TouchableOpacity
        style={[styles.userItem, { borderBottomColor: borderColor }]}
        onPress={() => handleUserPress(item)}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            userId={item.id}
            displayName={item.displayName}
            profileImageUrl={item.profileImageUrl}
            size={50}
          />
          {online && <View style={[styles.onlineDot, { borderColor: backgroundColor }]} />}
        </View>

        <View style={styles.userInfo}>
          <ThemedText style={styles.displayName}>{item.displayName}</ThemedText>
          <ThemedText style={[styles.email, { color: mutedColor }]}>{item.email}</ThemedText>
        </View>

        <Ionicons name="chevron-forward" size={20} color={mutedColor} />
      </TouchableOpacity>
    );
  }, [borderColor, backgroundColor, mutedColor]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.header}>
          People
        </ThemedText>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <ThemedText type="title" style={styles.header}>
        People
      </ThemedText>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor, borderColor }]}>
        <Ionicons name="search" size={20} color={mutedColor} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search by name or email..."
          placeholderTextColor={mutedColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={mutedColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* User List */}
      {filteredUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={mutedColor} />
          <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
            {searchQuery ? 'No users found' : 'No users yet'}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}

      {/* User Profile Modal */}
      {selectedUser && (
        <View style={[styles.modalOverlay, StyleSheet.absoluteFillObject]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <View style={[styles.modalContent, { backgroundColor }]}>
            {selectedUser ? (
                <>
                  {(() => {
                    console.log('[People] Rendering modal content for:', selectedUser.id);
                    return null;
                  })()}
                  {/* Close Button */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleCloseModal}
                    disabled={creatingChat}
                  >
                    <Ionicons name="close" size={28} color={textColor} />
                  </TouchableOpacity>

                  {/* User Info */}
                  <View style={styles.modalUserInfo}>
                    {(() => {
                      console.log('[People] Rendering Avatar for:', selectedUser.id, 'url:', selectedUser.profileImageUrl);
                      return null;
                    })()}
                    {/* TEMPORARY: Avatar disabled for debugging */}
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#ccc' }} />

                    {(() => {
                      console.log('[People] Rendering display name');
                      return null;
                    })()}
                    <ThemedText type="title" style={styles.modalDisplayName}>
                      {selectedUser.displayName}
                    </ThemedText>

                    {(() => {
                      console.log('[People] Rendering email');
                      return null;
                    })()}
                    <ThemedText style={[styles.modalEmail, { color: mutedColor }]}>
                      {selectedUser.email}
                    </ThemedText>

                    {(() => {
                      console.log('[People] Checking isUserOnline for:', selectedUser.id);
                      const online = isUserOnline(selectedUser);
                      console.log('[People] isUserOnline result:', online);
                      return null;
                    })()}
                    {isUserOnline(selectedUser) && (
                      <View style={styles.onlineStatus}>
                        {(() => {
                          console.log('[People] Rendering online status');
                          return null;
                        })()}
                        <View style={styles.onlineStatusDot} />
                        <ThemedText style={[styles.onlineStatusText, { color: tintColor }]}>
                          Online
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  {(() => {
                    console.log('[People] Rendering message button, creatingChat:', creatingChat);
                    return null;
                  })()}
                  <TouchableOpacity
                    style={[styles.messageButton, { backgroundColor: tintColor }]}
                    onPress={handleStartChat}
                    disabled={creatingChat}
                  >
                    {(() => {
                      console.log('[People] Rendering button content');
                      return null;
                    })()}
                    {creatingChat ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="chatbubble" size={20} color="#fff" />
                        <ThemedText style={styles.messageButtonText}>Message</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalUserInfo: {
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 24,
  },
  modalDisplayName: {
    marginTop: 16,
    marginBottom: 4,
  },
  modalEmail: {
    fontSize: 14,
    marginBottom: 12,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  onlineStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  onlineStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
