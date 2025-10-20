import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '@/config/firebase';
import { useAuth } from '@/context/auth';
import { signOut } from 'firebase/auth';
import { Button, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  const { user } = useAuth();

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Profile</ThemedText>
      {user && <ThemedText>Signed in as: {user.email}</ThemedText>}
      <Button title="Sign Out" onPress={handleSignOut} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
});
