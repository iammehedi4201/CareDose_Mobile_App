import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../theme/tokens';
import { StatusBadge, StatusVariant } from './StatusBadge';

export interface DoseCardProps {
  medicineName: string;
  strength?: string | null;
  doseInstruction: string;
  scheduledTime: string;
  status: StatusVariant;
  onMarkTaken?: () => void;
  onSkip?: () => void;
  actionLoading?: boolean;
}

export function DoseCard({
  medicineName,
  strength,
  doseInstruction,
  scheduledTime,
  status,
  onMarkTaken,
  onSkip,
  actionLoading = false,
}: DoseCardProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const isCompleted = status === 'taken' || status === 'skipped';
  const titleText =
    strength && strength.trim().length > 0 ? `${medicineName} ${strength.trim()}` : medicineName;

  return (
    <View style={[styles.card, { padding: layout.cardPadding }]}>
      <View style={styles.topRow}>
        <View style={styles.iconCircle}>
          <Feather name="clock" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </View>
        <View style={styles.infoCol}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{titleText}</Text>
            <StatusBadge variant={status} />
          </View>
          <Text style={styles.instruction}>{doseInstruction}</Text>
          <Text style={styles.timeText}>{scheduledTime}</Text>
        </View>
      </View>

      {!isCompleted && (onMarkTaken || onSkip) ? (
        <View style={styles.actionsRow}>
          {onMarkTaken ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mark ${titleText} as taken`}
              disabled={actionLoading}
              onPress={onMarkTaken}
              style={styles.takenBtn}
            >
              <Text style={styles.takenBtnText}>Taken</Text>
            </Pressable>
          ) : null}
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Skip ${titleText}`}
              disabled={actionLoading}
              onPress={onSkip}
              style={styles.skipBtn}
            >
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  instruction: {
    marginTop: 3,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  timeText: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  takenBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  takenBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  skipBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
});
