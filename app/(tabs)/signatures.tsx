import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import SignatureCard from '@/components/SignatureCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SignatureTabType = 'mine' | 'received';

export default function SignaturesTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SignatureTabType>('mine');
  const [mySignatures, setMySignatures] = useState<any[]>([]);
  const [receivedSignatures, setReceivedSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  // Subscribe to my signatures
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('[Signatures] Subscribing to my signatures for user:', user.uid);

    const q = query(
      collection(db, 'users', user.uid, 'signatures'),
      where('signerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sigs = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
        }));

        console.log('[Signatures] Loaded', sigs.length, 'my signatures');
        setMySignatures(sigs);
        setLoading(false);
      },
      (error) => {
        console.error('[Signatures] Error loading my signatures:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  // Subscribe to received signatures
  useEffect(() => {
    if (!user) {
      return;
    }

    console.log('[Signatures] Subscribing to received signatures for user:', user.uid);

    const q = query(
      collection(db, 'users', user.uid, 'signatures'),
      where('signerId', '!=', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sigs = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
        }));

        console.log('[Signatures] Loaded', sigs.length, 'received signatures');
        setReceivedSignatures(sigs);
      },
      (error) => {
        console.error('[Signatures] Error loading received signatures:', error);
      }
    );

    return unsubscribe;
  }, [user]);

  const renderTabButton = (tab: SignatureTabType, label: string) => {
    const isActive = activeTab === tab;
    const count = tab === 'mine' ? mySignatures.length : receivedSignatures.length;

    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          isActive && { borderBottomColor: tintColor, borderBottomWidth: 2 },
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <ThemedText
          style={[
            styles.tabButtonText,
            isActive && { color: tintColor, fontWeight: '600' },
          ]}
        >
          {label} {count > 0 && `(${count})`}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const isMineTab = activeTab === 'mine';

    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={styles.emptyIcon}>🔏</ThemedText>
        <ThemedText style={styles.emptyTitle}>
          {isMineTab ? 'No Signatures Yet' : 'No Received Signatures'}
        </ThemedText>
        <ThemedText style={styles.emptyText}>
          {isMineTab
            ? 'Start by signing messages in a conversation.\n\n1. Open a chat\n2. Switch to "sign mode" (toggle in top-right)\n3. Long-press to select messages\n4. Tap "Sign" to create a signature'
            : 'When others sign messages in conversations with you, their signatures will appear here.\n\nYou can collect cryptographically signed approvals and attestations from your conversation partners.'}
        </ThemedText>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading signatures...</ThemedText>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor }]}>
        <ThemedText>Please log in to view signatures</ThemedText>
      </View>
    );
  }

  const displayedSignatures = activeTab === 'mine' ? mySignatures : receivedSignatures;

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Signatures
        </ThemedText>
      </View>

      {/* Tab Buttons */}
      <View style={[styles.tabContainer, { borderBottomColor: borderColor }]}>
        {renderTabButton('mine', 'My Signatures')}
        {renderTabButton('received', 'Received')}
      </View>

      {/* List */}
      <FlatList
        data={displayedSignatures}
        keyExtractor={(item) => item.signatureId || item.id}
        renderItem={({ item }) => <SignatureCard signature={item} isMine={activeTab === 'mine'} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
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
    paddingVertical: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 16,
  },
  listContent: {
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
  },
});
