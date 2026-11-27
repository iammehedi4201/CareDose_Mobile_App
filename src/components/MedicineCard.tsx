import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { formatSimplifiedDosageForm, MedicineFormThumbnail } from './MedicineFormThumbnail';
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
  showStatusIcon?: boolean;
  stackedMetrics?: boolean;
  onPress?: () => void;
  secondaryNote?: string;
  rightSubtext?: string;
  highlightVariants?: boolean;
}

export function formatMedicineMeta(
  strength?: string | null,
  dosageForm?: string | null,
  genericName?: string | null,
): string {
  const s = strength && strength.trim().length > 0 ? strength.trim() : 'Strength: Not available';
  const simplifiedForm = formatSimplifiedDosageForm(dosageForm);
  const f = simplifiedForm ?? 'Form: Not available';
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
  showStatusIcon = false,
  stackedMetrics = false,
  onPress,
  secondaryNote,
  rightSubtext,
  highlightVariants = false,
}: MedicineCardProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const metaLine = formatMedicineMeta(strength, dosageForm, genericName);
  const cleanStrength = strength && strength.trim().length > 0 ? strength.trim() : null;
  const cleanForm = formatSimplifiedDosageForm(dosageForm);
  const cleanGeneric = genericName && genericName.trim().length > 0 ? genericName.trim() : null;
  const stockMetricColor =
    statusVariant === 'low_stock'
      ? CAREDOSE_EXTENDED_COLORS.warning
      : statusVariant === 'out_of_stock'
        ? CAREDOSE_EXTENDED_COLORS.error
        : statusVariant === 'archived'
          ? CAREDOSE_EXTENDED_COLORS.secondaryText
          : CAREDOSE_EXTENDED_COLORS.primary;

  if (stackedMetrics) {
    const hasMetrics = Boolean(stockText || rightSubtext || priceText);
    return (
      <Pressable
        accessibilityRole={onPress ? 'button' : 'summary'}
        accessibilityLabel={`${name}, ${metaLine}`}
        disabled={!onPress}
        onPress={onPress}
        className="mb-2.5 rounded-card border border-border bg-white shadow-sm active:opacity-95"
        style={{ padding: layout.cardPadding }}
      >
        <View className="flex-row items-stretch">
          <View className="mr-3 shrink-0 self-center">
            <MedicineFormThumbnail
              size="card"
              dosageForm={dosageForm}
              imageUrl={imageUrl}
              accessibilityLabel={`${name} ${dosageForm ?? 'medicine'}`}
            />
          </View>

          <View className="flex-1 min-w-0 justify-between pr-2">
            <View>
              <Text
                className="font-bold text-main"
                style={{ fontSize: layout.isCompact ? 14 : 15, lineHeight: 20 }}
                numberOfLines={2}
              >
                {name}
              </Text>
              <Text className="mt-[3px] text-[12px] leading-[17px] text-[#5A706B]" numberOfLines={2}>
                {metaLine}
              </Text>
              {manufacturer ? (
                <Text className="mt-[2px] text-[11.5px] font-medium text-primary-dark" numberOfLines={1}>
                  {manufacturer}
                </Text>
              ) : null}
              {secondaryNote ? (
                <Text className="mt-1 text-xs text-main" numberOfLines={2}>
                  {secondaryNote}
                </Text>
              ) : null}
            </View>

            {showStatusBadge ? (
              <View className="mt-2.5">
                <StatusBadge
                  variant={statusVariant}
                  label={statusLabel}
                  showIcon={showStatusIcon}
                />
              </View>
            ) : null}
          </View>

          {hasMetrics ? (
            <View className="shrink-0 items-end justify-between pl-1">
              <View className="items-end">
                {stockText ? (
                  <Text
                    className="text-right font-bold"
                    style={{
                      color: stockMetricColor,
                      fontSize: layout.isCompact ? 13.5 : 15,
                      lineHeight: 20,
                    }}
                    numberOfLines={1}
                  >
                    {stockText}
                  </Text>
                ) : null}
                {rightSubtext ? (
                  <Text
                    className="mt-0.5 text-right text-[11.5px] font-medium text-[#5A706B]"
                    numberOfLines={1}
                  >
                    {rightSubtext}
                  </Text>
                ) : null}
              </View>

              {priceText ? (
                <Text
                  className="mt-2.5 text-right text-[12px] font-semibold text-main"
                  numberOfLines={1}
                >
                  {priceText}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${name}, ${metaLine}`}
      disabled={!onPress}
      onPress={onPress}
      className="mb-2.5 rounded-card border border-border bg-white shadow-sm"
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

          {highlightVariants ? (
            <>
              <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
                <View className="max-w-full rounded-full border border-[#C5E8D8] bg-mint px-2 py-0.5">
                  <Text className="text-[11px] font-bold text-primary-dark">
                    {cleanStrength ?? 'Strength: N/A'}
                  </Text>
                </View>
                <View className="max-w-full rounded-full border border-border bg-background px-2 py-0.5">
                  <Text className="text-[11px] font-semibold text-main">
                    {cleanForm ?? 'Form: N/A'}
                  </Text>
                </View>
              </View>

              {(cleanGeneric || rightSubtext) ? (
                <View className="mt-1 flex-row flex-wrap items-start justify-between gap-1.5">
                  <Text className="flex-1 min-w-0 text-xs text-[#5A706B]" numberOfLines={1}>
                    {cleanGeneric ?? 'Generic: Not available'}
                  </Text>
                  {rightSubtext ? (
                    <Text className="shrink-0 text-[11px] font-medium text-[#5A706B]">
                      {rightSubtext}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
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
          )}

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
                <StatusBadge variant={statusVariant} label={statusLabel} showIcon={showStatusIcon} />
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
