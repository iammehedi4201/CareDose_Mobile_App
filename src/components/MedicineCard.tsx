import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../theme/tokens';
import { StatusBadge, StatusVariant } from './StatusBadge';

export interface MedicineCardProps {
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  stockText?: string;
  priceText?: string;
  statusVariant: StatusVariant;
  statusLabel?: string;
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
  stockText,
  priceText,
  statusVariant,
  statusLabel,
  onPress,
  secondaryNote,
  rightSubtext,
}: MedicineCardProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const metaLine = formatMedicineMeta(strength, dosageForm, genericName);
  const iconName = resolveDosageFormIcon(dosageForm);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${name}, ${metaLine}`}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, { padding: layout.cardPadding }]}
    >
      <View style={styles.topRow}>
        <View style={styles.iconCircle}>
          <Feather name={iconName} size={18} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </View>

        <View style={styles.mainCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {name}
            </Text>
            {stockText ? <Text style={styles.stockText}>{stockText}</Text> : null}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={2}>
              {metaLine}
            </Text>
            {rightSubtext ? <Text style={styles.rightSubtext}>{rightSubtext}</Text> : null}
          </View>

          {manufacturer ? (
            <Text style={styles.manufacturerText} numberOfLines={1}>
              {manufacturer}
            </Text>
          ) : null}

          {secondaryNote ? (
            <Text style={styles.noteText} numberOfLines={2}>
              {secondaryNote}
            </Text>
          ) : null}

          <View style={styles.bottomRow}>
            <StatusBadge variant={statusVariant} label={statusLabel} />
            {priceText ? <Text style={styles.priceText}>{priceText}</Text> : null}
          </View>
        </View>
      </View>
    </Pressable>
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
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
  stockText: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    flexShrink: 0,
    textAlign: 'right',
  },
  metaRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  rightSubtext: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    fontWeight: '500',
    flexShrink: 0,
  },
  manufacturerText: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.mutedText,
  },
  noteText: {
    marginTop: 4,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  bottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    flexShrink: 1,
  },
});
