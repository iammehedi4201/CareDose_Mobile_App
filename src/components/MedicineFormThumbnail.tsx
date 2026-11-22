import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../theme/tokens';

export type MedicineFormCategory =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'drops'
  | 'suppository'
  | 'injection'
  | 'cream'
  | 'inhaler'
  | 'powder'
  | 'default';

export function normalizeMedicineFormCategory(
  dosageForm?: string | null,
): MedicineFormCategory {
  const norm = (dosageForm ?? '').trim().toLowerCase();
  if (!norm) return 'default';
  if (norm.includes('suppository')) return 'suppository';
  if (
    norm.includes('drop') ||
    norm.includes('ophthalmic solution') ||
    norm.includes('nasal spray') ||
    norm.includes('ear') ||
    norm.includes('eye')
  ) {
    if (norm.includes('ointment') || norm.includes('gel')) return 'cream';
    return 'drops';
  }
  if (
    norm.includes('syrup') ||
    norm.includes('suspension') ||
    norm.includes('elixir') ||
    norm.includes('oral solution') ||
    norm.includes('oral liquid') ||
    norm.includes('solution')
  ) {
    if (norm.includes('respirator') || norm.includes('nebul')) return 'inhaler';
    return 'syrup';
  }
  if (norm.includes('inhaler') || norm.includes('spray') || norm.includes('rotacap')) {
    return 'inhaler';
  }
  if (
    norm.includes('injection') ||
    norm.includes('infusion') ||
    norm.includes('vial') ||
    norm.includes('prefilled') ||
    norm.includes('syringe')
  ) {
    return 'injection';
  }
  if (
    norm.includes('cream') ||
    norm.includes('ointment') ||
    norm.includes('gel') ||
    norm.includes('lotion')
  ) {
    return 'cream';
  }
  if (norm.includes('capsule')) return 'capsule';
  if (norm.includes('sachet') || norm.includes('effervescent powder')) return 'powder';
  if (norm.includes('tablet')) return 'tablet';
  return 'default';
}

export function formatThumbnailFormLabel(dosageForm?: string | null): string {
  const raw = (dosageForm ?? '').trim();
  if (!raw) return 'Medicine';

  const lower = raw.toLowerCase();
  if (lower === 'tablet (extended release)') return 'Tablet ER';
  if (lower === 'tablet (sustained release)') return 'Tablet SR';
  if (lower === 'tablet (delayed release)') return 'Tablet DR';
  if (lower === 'iv injection or infusion') return 'IV Injection';
  if (lower === 'powder for suspension') return 'Suspension';
  if (lower === 'pediatric drops' || lower === 'paediatric drops') return 'Paediatric Drops';
  if (lower === 'suppository') return 'Suppository';
  if (lower === 'syrup') return 'Syrup';
  if (lower === 'tablet') return 'Tablet';
  if (lower === 'capsule') return 'Capsule';
  if (raw.length > 16) {
    return raw.split('(')[0].trim().slice(0, 16);
  }
  return raw;
}

function renderDosageFormVector(category: MedicineFormCategory, scale = 1): React.JSX.Element {
  const s = (v: number) => Math.round(v * scale);

  switch (category) {
    case 'tablet':
      return (
        <View style={styles.vectorStage}>
          <View
            style={[
              styles.tabletBack,
              { width: s(20), height: s(20), borderRadius: s(10), left: s(8), top: s(2) },
            ]}
          >
            <View style={[styles.tabletScore, { width: s(14), transform: [{ rotate: '-35deg' }] }]} />
          </View>
          <View
            style={[
              styles.tabletFront,
              { width: s(20), height: s(20), borderRadius: s(10), right: s(8), bottom: s(2) },
            ]}
          >
            <View style={[styles.tabletScore, { width: s(14), transform: [{ rotate: '35deg' }] }]} />
          </View>
        </View>
      );

    case 'capsule':
      return (
        <View style={styles.vectorStage}>
          <View
            style={[
              styles.capsuleShell,
              {
                width: s(32),
                height: s(15),
                borderRadius: s(8),
                transform: [{ rotate: '-32deg' }],
              },
            ]}
          >
            <View style={styles.capsuleTopHalf} />
            <View style={styles.capsuleDivider} />
            <View style={styles.capsuleBottomHalf} />
          </View>
        </View>
      );

    case 'syrup':
      return (
        <View style={[styles.vectorStage, styles.columnCenter]}>
          <View style={[styles.bottleCap, { width: s(12), height: s(5) }]} />
          <View style={[styles.bottleNeck, { width: s(10), height: s(3) }]} />
          <View style={[styles.bottleBody, { width: s(18), height: s(21), borderRadius: s(3) }]}>
            <View style={[styles.bottleLabelBand, { height: s(7), width: s(12) }]} />
          </View>
        </View>
      );

    case 'drops':
      return (
        <View style={[styles.vectorStage, styles.columnCenter]}>
          <View
            style={[
              styles.dropperGroup,
              { transform: [{ rotate: '28deg' }] },
            ]}
          >
            <View style={[styles.dropperBulb, { width: s(8), height: s(9), borderRadius: s(4) }]} />
            <View style={[styles.dropperCollar, { width: s(12), height: s(3) }]} />
            <View style={[styles.dropperStem, { width: s(6), height: s(16) }]} />
          </View>
          <View
            style={[
              styles.dropBubble,
              { width: s(5), height: s(5), borderRadius: s(3), marginTop: s(2), marginRight: s(8) },
            ]}
          />
        </View>
      );

    case 'suppository':
      return (
        <View style={styles.vectorStage}>
          <View
            style={[
              styles.suppOuter,
              { width: s(26), height: s(26), borderRadius: s(5), transform: [{ rotate: '45deg' }] },
            ]}
          >
            <View style={[styles.suppInner, { width: s(13), height: s(13), borderRadius: s(2) }]} />
          </View>
        </View>
      );

    case 'injection':
      return (
        <View style={styles.vectorStage}>
          <View style={[styles.syringeGroup, { transform: [{ rotate: '-35deg' }] }]}>
            <View style={[styles.syringePlungerTop, { width: s(8), height: s(2) }]} />
            <View style={[styles.syringePlungerStem, { width: s(2), height: s(5) }]} />
            <View style={[styles.syringeBarrel, { width: s(10), height: s(17), borderRadius: s(2) }]}>
              <View style={styles.syringeTick} />
              <View style={styles.syringeTick} />
            </View>
            <View style={[styles.syringeNeedle, { width: s(2), height: s(8) }]} />
          </View>
        </View>
      );

    case 'cream':
      return (
        <View style={[styles.vectorStage, styles.columnCenter]}>
          <View style={[styles.tubeCrimp, { width: s(20), height: s(3) }]} />
          <View style={[styles.tubeBody, { width: s(16), height: s(18) }]}>
            <View style={[styles.tubeStripe, { width: s(10), height: s(5) }]} />
          </View>
          <View style={[styles.tubeCap, { width: s(8), height: s(5) }]} />
        </View>
      );

    case 'inhaler':
      return (
        <View style={styles.vectorStage}>
          <View style={[styles.inhalerCanister, { width: s(9), height: s(10) }]} />
          <View style={[styles.inhalerBody, { width: s(20), height: s(14), borderRadius: s(3) }]} />
        </View>
      );

    case 'powder':
      return (
        <View style={styles.vectorStage}>
          <View style={[styles.sachetBox, { width: s(22), height: s(24), borderRadius: s(3) }]}>
            <View style={[styles.sachetLine, { width: s(14) }]} />
            <View style={[styles.sachetDotRow]}>
              <View style={styles.sachetDot} />
              <View style={styles.sachetDot} />
              <View style={styles.sachetDot} />
            </View>
          </View>
        </View>
      );

    default:
      return (
        <View style={styles.vectorStage}>
          <View style={[styles.defaultPill, { width: s(22), height: s(22), borderRadius: s(11) }]}>
            <View style={[styles.tabletScore, { width: s(14), transform: [{ rotate: '-35deg' }] }]} />
          </View>
        </View>
      );
  }
}

export interface MedicineFormThumbnailProps {
  dosageForm?: string | null;
  imageUrl?: string | null;
  accessibilityLabel?: string;
  size?: 'card' | 'hero';
}

export function MedicineFormThumbnail({
  dosageForm,
  imageUrl,
  accessibilityLabel,
  size = 'card',
}: MedicineFormThumbnailProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const category = normalizeMedicineFormCategory(dosageForm);
  const label = formatThumbnailFormLabel(dosageForm);

  const boxWidth = size === 'hero' ? 92 : layout.isCompact ? 78 : 88;
  const boxHeight = size === 'hero' ? 88 : 84;
  const scale = size === 'hero' ? 1.12 : 1;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${label} dosage form`}
      style={[
        styles.container,
        {
          width: boxWidth,
          minHeight: boxHeight,
        },
      ]}
    >
      <View style={styles.formTag}>
        <Text numberOfLines={1} style={styles.formTagText}>
          {label}
        </Text>
      </View>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.realPhoto}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.vectorArea}>
          {renderDosageFormVector(category, scale)}
        </View>
      )}
    </View>
  );
}

const OUTLINE = CAREDOSE_EXTENDED_COLORS.primaryDark;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.field,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    overflow: 'hidden',
    flexShrink: 0,
  },
  formTag: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderBottomRightRadius: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#A9DAC9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  formTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  vectorArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  realPhoto: {
    flex: 1,
    width: '100%',
    minHeight: 54,
  },
  vectorStage: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  columnCenter: {
    flexDirection: 'column',
  },
  tabletBack: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: OUTLINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabletFront: {
    position: 'absolute',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1.5,
    borderColor: OUTLINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabletScore: {
    height: 1.5,
    backgroundColor: OUTLINE,
    borderRadius: 1,
  },
  capsuleShell: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  capsuleTopHalf: {
    flex: 1,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  capsuleDivider: {
    width: 1.5,
    backgroundColor: OUTLINE,
  },
  capsuleBottomHalf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bottleCap: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  bottleNeck: {
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: '#FFFFFF',
  },
  bottleBody: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottleLabelBand: {
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: 1,
  },
  dropperGroup: {
    alignItems: 'center',
  },
  dropperBulb: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1.5,
    borderColor: OUTLINE,
  },
  dropperCollar: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderRadius: 1,
  },
  dropperStem: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  dropBubble: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  suppOuter: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suppInner: {
    borderWidth: 1.5,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
  },
  syringeGroup: {
    alignItems: 'center',
  },
  syringePlungerTop: {
    backgroundColor: OUTLINE,
    borderRadius: 1,
  },
  syringePlungerStem: {
    backgroundColor: OUTLINE,
  },
  syringeBarrel: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingRight: 1,
  },
  syringeTick: {
    width: 4,
    height: 1.2,
    backgroundColor: OUTLINE,
  },
  syringeNeedle: {
    backgroundColor: OUTLINE,
  },
  tubeCrimp: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderRadius: 1,
  },
  tubeBody: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tubeStripe: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  tubeCap: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  inhalerCanister: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    marginBottom: -2,
    marginLeft: -8,
  },
  inhalerBody: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: '#FFFFFF',
  },
  sachetBox: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sachetLine: {
    height: 1.5,
    backgroundColor: OUTLINE,
  },
  sachetDotRow: {
    flexDirection: 'row',
    gap: 3,
  },
  sachetDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  defaultPill: {
    borderWidth: 1.5,
    borderColor: OUTLINE,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
