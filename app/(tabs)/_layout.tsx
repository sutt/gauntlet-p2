import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth';
import { subscribeToConversations } from '@/services/conversations';
import { Conversation } from '@/types/chat';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  // Milestone 11: Track total unread count for tab badge
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Subscribe to conversations to calculate total unread count
  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeToConversations(
      user.uid,
      (conversations: Conversation[]) => {
        // Calculate total unread count for current user
        const total = conversations.reduce((sum, conv) => {
          const userUnread = (conv.unreadCount && user.uid) ? (conv.unreadCount[user.uid] || 0) : 0;
          return sum + userUnread;
        }, 0);
        setTotalUnreadCount(total);
      },
      (error) => {
        console.error('Error subscribing to conversations for badge:', error);
      }
    );

    return unsubscribe;
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="message.fill" color={color} />,
          // Milestone 11: Show unread count badge on tab
          tabBarBadge: totalUnreadCount > 0 ? (totalUnreadCount > 99 ? '99+' : totalUnreadCount) : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
