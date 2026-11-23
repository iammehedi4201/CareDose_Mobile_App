import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { MedicineFormThumbnail } from './MedicineFormThumbnail';
import { StatusBadge, StatusVariant } from './StatusBadge';

export interface MedicineCardProps {
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  imageUrl?: string | null;
  stockText?: string;
  priceText?: string;
  statusVariant: StatusVariant;
  statusLabel?: string;
  showStatusBadge?: boolean;
  onPress?: () => void;
  secondaryNote?: string;
  rightSubtext?: string;
}

export function formatMedicineMeta(
  strength?: string | null,
  dosageForm?: string | null,
  genericName?: string | null,
): string {
  const s = strength && strength.trim().length > 0 ? strength.trim() : 'Strength: Not available';
  const f = dosageForm && dosageForm.trim().length > 0 ? dosageForm.trim() : 'Form: Not available';
  const g = genericName && genericName.trim().length > 0 ? genericName.trim() : null;
  return g ? `${g} · ${s} · ${f}` : `${s} · ${f}`;
}

export function resolveDosageFormIcon(dosageForm?: string | null): keyof typeof Feather.glyphMap {
  const norm = (dosageForm ?? '').toLowerCase();
  if (
    norm.includes('syrup') ||
    norm.includes('suspension') ||
    norm.includes('drop') ||
    norm.includes('liquid')
  ) {
    return 'droplet';
  }
  if (norm.includes('injection') || norm.includes('infusion') || norm.includes('vial')) {
    return 'thermometer';
  }
  if (norm.includes('cream') || norm.includes('ointment') || norm.includes('gel')) {
    return 'feather';
  }
  return 'disc';
}

export function MedicineCard({
  name,
  genericName,
  strength,
  dosageForm,
  manufacturer,
  imageUrl,
  stockText,
  priceText,
  statusVariant,
  statusLabel,
  showStatusBadge = true,
  onPress,
  secondaryNote,
  rightSubtext,
}: MedicineCardProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const metaLine = formatMedicineMeta(strength, dosageForm, genericName);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${name}, ${metaLine}`}
      disabled={!onPress}
      onPress={onPress}
      className="mb-2.5 rounded-card border border-border bg-white"
      style={{ padding: layout.cardPadding }}
    >
      <View className="flex-row items-start">
        <View className="mr-3 shrink-0">
          <MedicineFormThumbnail
            size="card"
            dosageForm={dosageForm}
            imageUrl={imageUrl}
            accessibilityLabel={`${name} ${dosageForm ?? 'medicine'}`}
          />
        </View>

        <View className="flex-1 min-w-0">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 min-w-0 text-sm font-semibold text-main" numberOfLines={2}>
              {name}
            </Text>
            {stockText ? (
              <Text className="shrink-0 text-right text-[13px] font-bold text-main">
                {stockText}
              </Text>
            ) : null}
          </View>

          <View className="mt-[3px] flex-row flex-wrap items-start justify-between gap-1.5">
            <Text className="flex-1 min-w-0 text-xs text-[#5A706B]" numberOfLines={2}>
              {metaLine}
            </Text>
            {rightSubtext ? (
              <Text className="shrink-0 text-[11px] font-medium text-[#5A706B]">
                {rightSubtext}
              </Text>
            ) : null}
          </View>

          {manufacturer ? (
            <Text className="mt-[3px] text-[11.5px] font-medium text-primary-dark" numberOfLines={1}>
              {manufacturer}
            </Text>
          ) : null}

          {secondaryNote ? (
            <Text className="mt-1 text-xs text-main" numberOfLines={2}>
              {secondaryNote}
            </Text>
          ) : null}

          {showStatusBadge || priceText ? (
            <View className="mt-2.5 flex-row flex-wrap items-center justify-between gap-2">
              {showStatusBadge ? (
                <StatusBadge variant={statusVariant} label={statusLabel} />
              ) : (
                <View />
              )}
              {priceText ? (
                <Text className="shrink text-xs font-semibold text-[#5A706B]">{priceText}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
