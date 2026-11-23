import React from 'react';
import { Image, Text, View } from 'react-native';
import { useResponsiveLayout } from '../theme/responsive';

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
        <View className="w-[44px] h-[36px] items-center justify-center relative">
          <View
            className="absolute bg-white border-[1.5px] border-primary-dark items-center justify-center"
            style={{ width: s(20), height: s(20), borderRadius: s(10), left: s(8), top: s(2) }}
          >
            <View
              className="h-[1.5px] bg-primary-dark rounded-[1px]"
              style={{ width: s(14), transform: [{ rotate: '-35deg' }] }}
            />
          </View>
          <View
            className="absolute bg-mint border-[1.5px] border-primary-dark items-center justify-center"
            style={{ width: s(20), height: s(20), borderRadius: s(10), right: s(8), bottom: s(2) }}
          >
            <View
              className="h-[1.5px] bg-primary-dark rounded-[1px]"
              style={{ width: s(14), transform: [{ rotate: '35deg' }] }}
            />
          </View>
        </View>
      );

    case 'capsule':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative">
          <View
            className="border-[1.5px] border-primary-dark overflow-hidden flex-row bg-white"
            style={{
              width: s(32),
              height: s(15),
              borderRadius: s(8),
              transform: [{ rotate: '-32deg' }],
            }}
          >
            <View className="flex-1 bg-primary" />
            <View className="w-[1.5px] bg-primary-dark" />
            <View className="flex-1 bg-white" />
          </View>
        </View>
      );

    case 'syrup':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative flex-col">
          <View
            className="border-[1.5px] border-primary-dark bg-mint rounded-t-[2px]"
            style={{ width: s(12), height: s(5) }}
          />
          <View
            className="border-l-[1.5px] border-r-[1.5px] border-primary-dark bg-white"
            style={{ width: s(10), height: s(3) }}
          />
          <View
            className="border-[1.5px] border-primary-dark bg-white items-center justify-center"
            style={{ width: s(18), height: s(21), borderRadius: s(3) }}
          >
            <View
              className="border border-primary bg-mint rounded-[1px]"
              style={{ height: s(7), width: s(12) }}
            />
          </View>
        </View>
      );

    case 'drops':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative flex-col">
          <View
            className="items-center"
            style={{ transform: [{ rotate: '28deg' }] }}
          >
            <View
              className="bg-mint border-[1.5px] border-primary-dark"
              style={{ width: s(8), height: s(9), borderRadius: s(4) }}
            />
            <View
              className="bg-primary rounded-[1px]"
              style={{ width: s(12), height: s(3) }}
            />
            <View
              className="border-[1.5px] border-primary-dark bg-white rounded-b-[3px]"
              style={{ width: s(6), height: s(16) }}
            />
          </View>
          <View
            className="bg-primary"
            style={{ width: s(5), height: s(5), borderRadius: s(3), marginTop: s(2), marginRight: s(8) }}
          />
        </View>
      );

    case 'suppository':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative">
          <View
            className="border-[1.5px] border-primary-dark bg-white items-center justify-center"
            style={{ width: s(26), height: s(26), borderRadius: s(5), transform: [{ rotate: '45deg' }] }}
          >
            <View
              className="border-[1.5px] border-primary bg-mint"
              style={{ width: s(13), height: s(13), borderRadius: s(2) }}
            />
          </View>
        </View>
      );

    case 'injection':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative">
          <View className="items-center" style={{ transform: [{ rotate: '-35deg' }] }}>
            <View className="bg-primary-dark rounded-[1px]" style={{ width: s(8), height: s(2) }} />
            <View className="bg-primary-dark" style={{ width: s(2), height: s(5) }} />
            <View
              className="border-[1.5px] border-primary-dark bg-mint justify-evenly items-end pr-[1px]"
              style={{ width: s(10), height: s(17), borderRadius: s(2) }}
            >
              <View className="w-1 h-[1.2px] bg-primary-dark" />
              <View className="w-1 h-[1.2px] bg-primary-dark" />
            </View>
            <View className="bg-primary-dark" style={{ width: s(2), height: s(8) }} />
          </View>
        </View>
      );

    case 'cream':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative flex-col">
          <View className="bg-primary rounded-[1px]" style={{ width: s(20), height: s(3) }} />
          <View
            className="border-[1.5px] border-primary-dark bg-white items-center justify-center"
            style={{ width: s(16), height: s(18) }}
          >
            <View className="bg-mint border border-primary" style={{ width: s(10), height: s(5) }} />
          </View>
          <View
            className="border-[1.5px] border-primary-dark bg-mint rounded-b-[2px]"
            style={{ width: s(8), height: s(5) }}
          />
        </View>
      );

    case 'inhaler':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative">
          <View
            className="border-[1.5px] border-primary-dark bg-mint rounded-t-[3px] -mb-[2px] -ml-2"
            style={{ width: s(9), height: s(10) }}
          />
          <View
            className="border-[1.5px] border-primary-dark bg-white"
            style={{ width: s(20), height: s(14), borderRadius: s(3) }}
          />
        </View>
      );

    case 'powder':
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative">
          <View
            className="border-[1.5px] border-primary-dark bg-mint items-center justify-center gap-1"
            style={{ width: s(22), height: s(24), borderRadius: s(3) }}
          >
            <View className="h-[1.5px] bg-primary-dark" style={{ width: s(14) }} />
            <View className="flex-row gap-[3px]">
              <View className="w-[3px] h-[3px] rounded-[1.5px] bg-primary" />
              <View className="w-[3px] h-[3px] rounded-[1.5px] bg-primary" />
              <View className="w-[3px] h-[3px] rounded-[1.5px] bg-primary" />
            </View>
          </View>
        </View>
      );

    default:
      return (
        <View className="w-[44px] h-[36px] items-center justify-center relative">
          <View
            className="border-[1.5px] border-primary-dark bg-mint items-center justify-center"
            style={{ width: s(22), height: s(22), borderRadius: s(11) }}
          >
            <View
              className="h-[1.5px] bg-primary-dark rounded-[1px]"
              style={{ width: s(14), transform: [{ rotate: '-35deg' }] }}
            />
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
      className="bg-white rounded-field border border-border overflow-hidden shrink-0"
      style={{
        width: boxWidth,
        minHeight: boxHeight,
      }}
    >
      <View className="self-start max-w-[94%] bg-mint rounded-br-[10px] border-r border-b border-[#A9DAC9] px-[7px] py-[2.5px]">
        <Text numberOfLines={1} className="text-[9.5px] font-bold text-primary-dark">
          {label}
        </Text>
      </View>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="flex-1 w-full min-h-[54px]"
          resizeMode="cover"
        />
      ) : (
        <View className="flex-1 items-center justify-center py-2 px-1.5">
          {renderDosageFormVector(category, scale)}
        </View>
      )}
    </View>
  );
}
