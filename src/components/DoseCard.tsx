import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
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
    <View
      className="mb-2.5 rounded-card border border-border bg-white"
      style={{ padding: layout.cardPadding }}
    >
      <View className="flex-row items-start">
        <View className="mt-0.5 mr-2.5 h-[34px] w-[34px] items-center justify-center rounded-full bg-mint">
          <Feather name="clock" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 min-w-0 text-sm font-semibold text-main">{titleText}</Text>
            <StatusBadge variant={status} />
          </View>
          <Text className="mt-[3px] text-xs text-[#5A706B]">{doseInstruction}</Text>
          <Text className="mt-[3px] text-[11px] font-semibold text-primary">
            {scheduledTime}
          </Text>
        </View>
      </View>

      {!isCompleted && (onMarkTaken || onSkip) ? (
        <View className="mt-3 flex-row gap-2.5">
          {onMarkTaken ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mark ${titleText} as taken`}
              disabled={actionLoading}
              onPress={onMarkTaken}
              className="min-h-[40px] flex-1 items-center justify-center rounded-[10px] border border-border bg-white px-2.5 py-2"
            >
              <Text className="text-xs font-semibold text-primary">Taken</Text>
            </Pressable>
          ) : null}
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Skip ${titleText}`}
              disabled={actionLoading}
              onPress={onSkip}
              className="min-h-[40px] flex-1 items-center justify-center rounded-[10px] border border-border bg-white px-2.5 py-2"
            >
              <Text className="text-xs font-semibold text-[#5A706B]">Skip</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
