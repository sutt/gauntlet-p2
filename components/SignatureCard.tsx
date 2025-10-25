import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';

interface SignatureCardProps {
  signature: any;
  isMine: boolean;
}

export default function SignatureCard({ signature, isMine }: SignatureCardProps) {
  const router = useRouter();
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  const handlePress = () => {
    console.log('[SignatureCard] Navigating to signature:', signature.signatureId);
    router.push(`/signatures/${signature.signatureId}` as any);
  };

  // Format relative time (similar to user presence)
  const getRelativeTime = (date: Date): string => {
    if (!date) return 'Unknown time';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;

    // For older dates, show actual date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get signer display name
  const getSignerDisplay = (): string => {
    if (isMine) return 'You';
    return signature.signedPayload?.signerId || 'Unknown';
  };

  // Get participants display (excluding the signer)
  const getParticipantsDisplay = (): string => {
    const participants = signature.signedPayload?.participants || [];
    const signerId = signature.signedPayload?.signerId;

    if (participants.length === 0) return '';

    if (isMine) {
      // For "My Signatures", show who we signed with
      const others = participants.filter((p: any) => p.email !== signerId);
      if (others.length === 0) return '';
      if (others.length === 1) return `with ${others[0].displayName}`;
      return `with ${others.length} participants`;
    } else {
      // For "Received", show "in conversation with you"
      return 'in conversation with you';
    }
  };

  const messageCount = signature.signedPayload?.messages?.length || 0;
  const relativeTime = getRelativeTime(signature.createdAt);
  const signerDisplay = getSignerDisplay();
  const participantsDisplay = getParticipantsDisplay();

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="create-outline" size={24} color={tintColor} style={styles.icon} />
        <View style={styles.headerContent}>
          <ThemedText style={styles.signerText}>
            {signerDisplay} signed {messageCount} message{messageCount !== 1 ? 's' : ''}
          </ThemedText>
          {participantsDisplay && (
            <ThemedText style={styles.participantsText}>{participantsDisplay}</ThemedText>
          )}
        </View>
        {signature.verified && (
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
        )}
      </View>

      {/* Footer with time and purpose */}
      <View style={styles.footer}>
        <ThemedText style={styles.timeText}>{relativeTime}</ThemedText>
        {signature.purpose && (
          <ThemedText style={styles.purposeText}>• {signature.purpose}</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  headerContent: {
    flex: 1,
  },
  signerText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  participantsText: {
    fontSize: 14,
    opacity: 0.7,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
  },
  purposeText: {
    fontSize: 12,
    opacity: 0.6,
    marginLeft: 8,
    fontStyle: 'italic',
  },
});
