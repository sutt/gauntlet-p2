import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';

import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/context/auth';
import { NotificationsProvider } from '@/context/notifications';
import { requestNotificationPermissions } from '@/services/notifications';

export const unstable_settings = {
  // Default to chats tab since home/index was removed
  initialRouteName: '(tabs)/chats',
};

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  // Handle authentication routing
  useEffect(() => {
    if (loading) {
      return;
    }

    const inAuthFlow = segments[0] === 'login';

    if (!user && !inAuthFlow) {
      router.replace('/login');
    } else if (user && inAuthFlow) {
      // Redirect to chats tab (home/index tab was removed)
      router.replace('/chats');
    }
  }, [user, loading, segments]);

  // Request notification permissions when user is logged in
  useEffect(() => {
    if (user && !loading) {
      // Request permissions after a short delay to avoid interrupting login flow
      const timer = setTimeout(() => {
        requestNotificationPermissions().catch(error => {
          console.error('Failed to request notification permissions:', error);
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  // Set up notification listeners
  useEffect(() => {
    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // The notification will be displayed automatically by the handler we configured
      // in services/notifications.ts
    });

    // This listener is fired whenever a user taps on or interacts with a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);

      // Get the conversation ID from the notification data
      const conversationId = response.notification.request.content.data?.conversationId;

      if (conversationId && typeof conversationId === 'string') {
        // Navigate to the conversation
        router.push(`/chat/${conversationId}` as any);
      }
    });

    return () => {
      // Clean up listeners on unmount
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <ThemeProvider value={DefaultTheme}>
          <RootLayoutNav />
          <StatusBar style="auto" />
        </ThemeProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
