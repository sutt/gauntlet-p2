import { Redirect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/themed-view';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  // Redirect based on auth state
  if (user) {
    return <Redirect href="/chats" />;
  }

  return <Redirect href="/login" />;
}
