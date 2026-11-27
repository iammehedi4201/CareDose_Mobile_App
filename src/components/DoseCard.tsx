import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { resolveDosageFormIcon } from './MedicineCard';
import { StatusBadge, StatusVariant } from './StatusBadge';

export interface DoseCardProps {
  medicineName: string;
  strength?: string | null;
  dosageForm?: string | null;
  doseAmountText?: string | null;
  instructions?: string | null;
  doseInstruction: string;
  scheduledTime: string;
  status: StatusVariant;
  recordedAtText?: string | null;
  onMarkTaken?: () => void;
  onSkip?: () => void;
  actionLoading?: boolean;
}

function resolveDoseDisplayParts(
  doseInstruction: string,
  explicitAmount?: string | null,
  explicitInstructions?: string | null,
): { amountLine: string; instructionLine: string | null } {
  const cleanExplicitAmount = explicitAmount?.trim();
  const cleanExplicitInstructions = explicitInstructions?.trim() || null;
  if (cleanExplicitAmount) {
    return {
      amountLine: cleanExplicitAmount,
      instructionLine: cleanExplicitInstructions,
    };
  }

  const parts = doseInstruction
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return {
      amountLine: parts[0],
      instructionLine: parts.slice(1).join(' · '),
    };
  }
  return {
    amountLine: doseInstruction.trim(),
    instructionLine: cleanExplicitInstructions,
  };
}

export function DoseCard({
  medicineName,
  strength,
  dosageForm,
  doseAmountText,
  instructions,
  doseInstruction,
  scheduledTime,
  status,
  recordedAtText,
  onMarkTaken,
  onSkip,
  actionLoading = false,
}: DoseCardProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const isCompleted = status === 'taken' || status === 'skipped';
  const titleText =
    strength && strength.trim().length > 0 ? `${medicineName} ${strength.trim()}` : medicineName;
  const leadingIcon = dosageForm ? resolveDosageFormIcon(dosageForm) : 'clock';
  const { amountLine, instructionLine } = resolveDoseDisplayParts(
    doseInstruction,
    doseAmountText,
    instructions,
  );

  const cardSurfaceStyle =
    status === 'taken'
      ? { backgroundColor: '#F4FBF7', borderColor: '#CBE7DB' }
      : status === 'due'
        ? { backgroundColor: '#FFFDF7', borderColor: '#F3D9A4' }
        : status === 'missed'
          ? { backgroundColor: '#FFF9F9', borderColor: '#F3C1BE' }
          : status === 'skipped'
            ? { backgroundColor: '#F8FAF9', borderColor: CAREDOSE_EXTENDED_COLORS.border }
            : { backgroundColor: CAREDOSE_EXTENDED_COLORS.surface, borderColor: CAREDOSE_EXTENDED_COLORS.border };

  const iconBadgeBg =
    status === 'missed'
      ? CAREDOSE_EXTENDED_COLORS.errorSurface
      : status === 'due'
        ? CAREDOSE_EXTENDED_COLORS.warningSurface
        : status === 'skipped'
          ? CAREDOSE_EXTENDED_COLORS.neutralSurface
          : CAREDOSE_EXTENDED_COLORS.mintSurface;

  const iconColor =
    status === 'missed'
      ? CAREDOSE_EXTENDED_COLORS.error
      : status === 'due'
        ? CAREDOSE_EXTENDED_COLORS.warning
        : status === 'skipped'
          ? CAREDOSE_EXTENDED_COLORS.secondaryText
          : CAREDOSE_EXTENDED_COLORS.primary;

  const recordedSummaryLabel =
    status === 'taken'
      ? recordedAtText
        ? `Taken at ${recordedAtText}`
        : 'Recorded as taken'
      : recordedAtText
        ? `Skipped at ${recordedAtText}`
        : 'Marked as skipped · No stock deducted';

  return (
    <View
      className="mb-2.5 rounded-card shadow-sm"
      style={{
        padding: layout.cardPadding,
        borderWidth: 1,
        borderColor: cardSurfaceStyle.borderColor,
        backgroundColor: cardSurfaceStyle.backgroundColor,
      }}
    >
      <View className="flex-row items-start">
        <View
          accessible={false}
          className="mt-0.5 mr-3 h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBadgeBg }}
        >
          <Feather name={leadingIcon} size={16} color={iconColor} />
        </View>

        <View className="flex-1 min-w-0">
          {/* Top row: Medicine name + strength & Status badge */}
          <View className="flex-row items-start justify-between gap-2">
            <Text
              className="flex-1 min-w-0 text-[15px] font-bold leading-[20px] text-main"
              numberOfLines={2}
            >
              {titleText}
            </Text>
            <StatusBadge variant={status} />
          </View>

          {/* Middle hierarchy: Dose amount, personal instructions, scheduled time */}
          <Text
            accessibilityLabel={`Dose details ${doseInstruction}`}
            className="mt-1.5 text-[13.5px] font-semibold leading-[19px] text-main"
            numberOfLines={2}
          >
            {amountLine}
          </Text>

          {instructionLine ? (
            <Text className="mt-0.5 text-[12.5px] leading-[17px] text-[#5A706B]" numberOfLines={2}>
              {instructionLine}
            </Text>
          ) : null}

          <View className="mt-1.5 flex-row items-center gap-1.5">
            <Feather name="clock" size={12} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text
              accessibilityLabel={`Scheduled time ${scheduledTime}`}
              className="text-[12.5px] font-semibold text-primary"
              numberOfLines={1}
            >
              {scheduledTime}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom: Taken / Skip actions or read-only recorded status */}
      {isCompleted ? (
        <View
          className="mt-3 flex-row items-center gap-1.5 pt-2.5"
          style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
        >
          <Feather
            name={status === 'taken' ? 'check-circle' : 'skip-forward'}
            size={13}
            color={
              status === 'taken'
                ? CAREDOSE_EXTENDED_COLORS.success
                : CAREDOSE_EXTENDED_COLORS.secondaryText
            }
          />
          <Text
            className={`text-xs font-medium ${
              status === 'taken' ? 'text-primary-dark' : 'text-[#5A706B]'
            }`}
            numberOfLines={1}
          >
            {recordedSummaryLabel}
          </Text>
        </View>
      ) : onMarkTaken || onSkip ? (
        <View
          className="mt-3 flex-row gap-2.5 pt-2.5"
          style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
        >
          {onMarkTaken ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mark ${titleText} as taken`}
              disabled={actionLoading}
              hitSlop={4}
              onPress={onMarkTaken}
              className={`min-h-[44px] flex-1 min-w-0 flex-row items-center justify-center gap-1.5 rounded-field px-3 py-2 ${
                actionLoading ? 'bg-[#9BBFB7]' : 'bg-primary active:bg-primary-dark'
              }`}
            >
              <Feather name="check" size={15} color="#FFFFFF" />
              <Text className="text-[13px] font-semibold text-white" numberOfLines={1}>
                Taken
              </Text>
            </Pressable>
          ) : null}
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Skip ${titleText}`}
              disabled={actionLoading}
              hitSlop={4}
              onPress={onSkip}
              className="min-h-[44px] flex-1 min-w-0 flex-row items-center justify-center rounded-field border border-border bg-white px-3 py-2 active:bg-mint"
            >
              <Text className="text-[13px] font-semibold text-main" numberOfLines={1}>
                Skip
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
