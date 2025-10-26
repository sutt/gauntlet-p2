import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SignatureData {
  signatureId: string;
  signedPayload: {
    version: string;
    timestamp: number;
    signedAt: string;
    nonce: string;
    signerId: string;
    conversationId: string;
    participants: Array<{ email: string; displayName: string }>;
    messages: Array<{
      messageId: string;
      text: string;
      senderId: string;
      senderName: string;
      timestamp: number;
      sentAt: string;
    }>;
    purpose?: string;
    notes?: string;
  };
  pgpSignature: string;
  createdAt: Date;
  conversationId: string;
  messageIds: string[];
  signerId: string;
  verified: boolean;
  purpose?: string;
}

export default function SignatureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [signature, setSignature] = useState<SignatureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pgpExpanded, setPgpExpanded] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (!user || !id) {
      setLoading(false);
      return;
    }

    const loadSignature = async () => {
      try {
        console.log('[SignatureDetail] Loading signature:', id);
        const sigDoc = await getDoc(doc(db, 'users', user.uid, 'signatures', id));

        if (!sigDoc.exists()) {
          console.error('[SignatureDetail] Signature not found:', id);
          setError('Signature not found');
          setLoading(false);
          return;
        }

        const data = sigDoc.data();
        const sigData: SignatureData = {
          ...data,
          createdAt: data.createdAt?.toDate(),
        } as SignatureData;

        console.log('[SignatureDetail] Loaded signature:', sigData);
        setSignature(sigData);
        setLoading(false);
      } catch (err) {
        console.error('[SignatureDetail] Error loading signature:', err);
        setError('Failed to load signature');
        setLoading(false);
      }
    };

    loadSignature();
  }, [user, id]);

  const formatAbsoluteTimestamp = (date: Date): string => {
    if (!date) return 'Unknown time';
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSignerDisplay = (): string => {
    if (!signature) return '';
    const isMine = signature.signerId === user?.uid;
    if (isMine) return 'You';
    return signature.signedPayload?.signerId || 'Unknown';
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading signature...</ThemedText>
      </ThemedView>
    );
  }

  if (error || !signature) {
    return (
      <ThemedView style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle" size={64} color="#FF3B30" />
        <ThemedText style={styles.errorText}>{error || 'Signature not found'}</ThemedText>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: tintColor }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const isMine = signature.signerId === user?.uid;
  const messageCount = signature.signedPayload?.messages?.length || 0;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Signature Details
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Status Section */}
        <View style={[styles.section, { backgroundColor: backgroundColor, borderColor }]}>
          <View style={styles.statusHeader}>
            <Ionicons name="create-outline" size={32} color={tintColor} />
            <View style={styles.statusTextContainer}>
              <ThemedText style={styles.statusTitle}>
                {getSignerDisplay()} signed {messageCount} message{messageCount !== 1 ? 's' : ''}
              </ThemedText>
              <ThemedText style={styles.statusSubtitle}>
                {formatAbsoluteTimestamp(signature.createdAt)}
              </ThemedText>
            </View>
            {signature.verified && (
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            )}
          </View>
        </View>

        {/* Purpose Section */}
        {signature.purpose && (
          <View style={[styles.section, { backgroundColor: backgroundColor, borderColor }]}>
            <ThemedText style={styles.sectionLabel}>Purpose</ThemedText>
            <ThemedText style={styles.purposeText}>{signature.purpose}</ThemedText>
          </View>
        )}

        {/* Notes Section */}
        {signature.signedPayload?.notes && (
          <View style={[styles.section, { backgroundColor: backgroundColor, borderColor }]}>
            <ThemedText style={styles.sectionLabel}>Notes</ThemedText>
            <ThemedText style={styles.notesText}>{signature.signedPayload.notes}</ThemedText>
          </View>
        )}

        {/* Participants Section */}
        {signature.signedPayload?.participants && signature.signedPayload.participants.length > 0 && (
          <View style={[styles.section, { backgroundColor: backgroundColor, borderColor }]}>
            <ThemedText style={styles.sectionLabel}>Participants</ThemedText>
            {signature.signedPayload.participants.map((participant, index) => (
              <View key={index} style={styles.participantRow}>
                <Ionicons name="person-circle" size={20} color={tintColor} />
                <ThemedText style={styles.participantName}>{participant.displayName}</ThemedText>
                <ThemedText style={styles.participantEmail}>{participant.email}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Signed Messages Section */}
        <View style={[styles.section, { backgroundColor: backgroundColor, borderColor }]}>
          <ThemedText style={styles.sectionLabel}>
            Signed Messages ({messageCount})
          </ThemedText>
          {signature.signedPayload?.messages?.map((message, index) => (
            <View key={message.messageId} style={[styles.messageCard, { borderColor }]}>
              <View style={styles.messageHeader}>
                <ThemedText style={styles.messageSender}>{message.senderName}</ThemedText>
                <ThemedText style={styles.messageTime}>
                  {new Date(message.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </ThemedText>
              </View>
              <ThemedText style={styles.messageText}>{message.text}</ThemedText>
            </View>
          ))}
        </View>

        {/* PGP Signature Section (Collapsible) */}
        <View style={[styles.section, { backgroundColor: backgroundColor, borderColor }]}>
          <TouchableOpacity
            style={styles.pgpHeader}
            onPress={() => setPgpExpanded(!pgpExpanded)}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.sectionLabel}>PGP Signature</ThemedText>
            <Ionicons
              name={pgpExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={textColor}
            />
          </TouchableOpacity>

          {pgpExpanded && (
            <View style={[styles.pgpBox, { borderColor, backgroundColor: backgroundColor + '80' }]}>
              <ThemedText style={styles.pgpText} selectable>
                {signature.pgpSignature}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Technical Details Section */}
        <View style={[styles.section, { backgroundColor: backgroundColor, borderColor }]}>
          <ThemedText style={styles.sectionLabel}>Technical Details</ThemedText>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Signature ID:</ThemedText>
            <ThemedText style={styles.detailValue} selectable>
              {signature.signatureId}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Version:</ThemedText>
            <ThemedText style={styles.detailValue}>{signature.signedPayload?.version}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Nonce:</ThemedText>
            <ThemedText style={styles.detailValue} selectable>
              {signature.signedPayload?.nonce}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Verified:</ThemedText>
            <ThemedText style={[styles.detailValue, { color: signature.verified ? '#34C759' : '#FF9500' }]}>
              {signature.verified ? 'Yes' : 'Pending'}
            </ThemedText>
          </View>
        </View>
      </ScrollView>
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
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    color: '#FF3B30',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  purposeText: {
    fontSize: 16,
    lineHeight: 24,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  participantEmail: {
    fontSize: 14,
    opacity: 0.6,
    marginLeft: 8,
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  pgpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pgpBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  pgpText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
});
