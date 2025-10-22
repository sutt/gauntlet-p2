import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './auth';
import { subscribeToConversations } from '@/services/conversations';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { showMessageNotification } from '@/services/notifications';
import { getUser } from '@/services/users';

// Context for managing notifications
interface NotificationsContextType {
  setCurrentConversation: (conversationId: string | null) => void;
}

const NotificationsContext = createContext<NotificationsContextType>({
  setCurrentConversation: () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const lastMessageTimestamps = useRef<Record<string, Date>>({});
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const currentConversationId = useRef<string | null>(null);

  // Function to set the current conversation
  const setCurrentConversation = (conversationId: string | null) => {
    console.log('🔔 NotificationsProvider: Current conversation set to:', conversationId);
    currentConversationId.current = conversationId;
  };

  // Track which conversation is currently being viewed
  // This will be set by the chat screen
  useEffect(() => {
    // Listen to app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Set up notification listeners for all conversations
  useEffect(() => {
    if (!user) {
      return;
    }

    console.log('🔔 NotificationsProvider: Setting up notification listeners for user:', user.uid);

    let conversationUnsubscribes: Array<() => void> = [];

    // Subscribe to all user's conversations
    const conversationsUnsubscribe = subscribeToConversations(
      user.uid,
      async (conversations) => {
        console.log('🔔 NotificationsProvider: Monitoring', conversations.length, 'conversations');

        // Clean up previous message listeners
        conversationUnsubscribes.forEach(unsub => unsub());
        conversationUnsubscribes = [];

        // Set up message listener for each conversation
        conversations.forEach(conversation => {
          // Initialize last message timestamp for this conversation if not exists
          if (!lastMessageTimestamps.current[conversation.id]) {
            lastMessageTimestamps.current[conversation.id] = new Date();
          }

          // Listen to new messages in this conversation
          const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
          const messagesQuery = query(
            messagesRef,
            where('timestamp', '>', Timestamp.fromDate(lastMessageTimestamps.current[conversation.id])),
            orderBy('timestamp', 'desc'),
            limit(1)
          );

          const unsubscribe = onSnapshot(
            messagesQuery,
            async (snapshot) => {
              snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                  const message = change.doc.data();
                  const messageTimestamp = message.timestamp?.toDate() || new Date();

                  // Update last message timestamp
                  lastMessageTimestamps.current[conversation.id] = messageTimestamp;

                  // Only show notification if:
                  // 1. Message is not from current user
                  // 2. App is in foreground (active state)
                  // 3. User is not currently viewing this conversation
                  const isFromCurrentUser = message.senderId === user.uid;
                  const isAppInForeground = appState.current === 'active';
                  const isViewingThisConversation = currentConversationId.current === conversation.id;

                  if (!isFromCurrentUser && isAppInForeground && !isViewingThisConversation) {
                    console.log('🔔 NotificationsProvider: Showing notification for new message in conversation:', conversation.id);

                    // Get sender's display name
                    const senderName = message.senderName || 'Someone';

                    // Show notification
                    await showMessageNotification(
                      senderName,
                      message.text,
                      conversation.id
                    );
                  }
                }
              });
            },
            (error) => {
              console.error('🔔 NotificationsProvider: Error listening to messages:', error);
            }
          );

          conversationUnsubscribes.push(unsubscribe);
        });
      },
      (error) => {
        console.error('🔔 NotificationsProvider: Error subscribing to conversations:', error);
      }
    );

    return () => {
      console.log('🔔 NotificationsProvider: Cleaning up notification listeners');
      conversationsUnsubscribe();
      conversationUnsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  return (
    <NotificationsContext.Provider value={{ setCurrentConversation }}>
      {children}
    </NotificationsContext.Provider>
  );
}
