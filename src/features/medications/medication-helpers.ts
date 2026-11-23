import type { PatientMedicationDto } from '../../api/medications';
import type { StatusVariant } from '../../components/StatusBadge';

export type MedFilter = 'all' | 'active' | 'low_stock' | 'archived';

export interface PersonalMedicationRecord {
  id: string;
  catalogueBrandId?: string | null;
  genericSourceId?: string | null;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm: string;
  manufacturer?: string | null;
  instructions: string;
  stockRemaining: number;
  stockUnit: string;
  stripUnits?: number | null;
  openingEntryText?: string | null;
  unitPriceText: string;
  totalStockPrice?: number | null;
  priceScopeLabel?: string | null;
  referencePackText?: string | null;
  lowStockThreshold: number;
  archived: boolean;
}

export const INITIAL_PERSONAL_MEDS: PersonalMedicationRecord[] = [];

export const DEMO_FIXTURE_MEDS: PersonalMedicationRecord[] = [
  {
    id: 'm1',
    catalogueBrandId: '101',
    genericSourceId: 'g-cardizen',
    name: 'Corvalen 5 mg',
    genericName: 'Ivabradine',
    strength: '5 mg',
    dosageForm: 'Tablet',
    manufacturer: 'Apex Pharma Ltd.',
    instructions: '1 tablet twice daily after meal',
    stockRemaining: 24,
    stockUnit: 'tablets',
    unitPriceText: '৳18.50/unit',
    referencePackText: '30 tablets · ৳555.00',
    lowStockThreshold: 7,
    archived: false,
  },
  {
    id: 'm2',
    name: 'Glymexa 500 mg',
    genericName: 'Metformin',
    strength: '500 mg',
    dosageForm: 'Tablet',
    instructions: '1 tablet with morning meal',
    stockRemaining: 5,
    stockUnit: 'tablets',
    unitPriceText: '৳9.00/unit',
    referencePackText: '30 tablets · ৳270.00',
    lowStockThreshold: 7,
    archived: false,
  },
  {
    id: 'm3',
    name: 'Vitamin D3 1000 IU',
    genericName: 'Cholecalciferol',
    strength: '1000 IU',
    dosageForm: 'Capsule',
    instructions: '1 capsule after lunch',
    stockRemaining: 18,
    stockUnit: 'capsules',
    unitPriceText: '৳7.50/unit',
    referencePackText: '60 capsules · ৳450.00',
    lowStockThreshold: 5,
    archived: false,
  },
  {
    id: 'm4',
    name: 'Serenil 10 mg',
    genericName: 'Escitalopram',
    strength: '10 mg',
    dosageForm: 'Tablet',
    instructions: '1 tablet before sleep',
    stockRemaining: 12,
    stockUnit: 'tablets',
    unitPriceText: '৳12.00/unit',
    referencePackText: '30 tablets · ৳360.00',
    lowStockThreshold: 5,
    archived: false,
  },
  {
    id: 'm5',
    name: 'Lumigan Drops 0.01%',
    genericName: 'Bimatoprost',
    strength: '0.01%',
    dosageForm: 'Eye Drops',
    instructions: '1 drop every evening',
    stockRemaining: 1,
    stockUnit: 'bottle',
    unitPriceText: '৳320.00/bottle',
    referencePackText: '1 bottle · ৳320.00',
    lowStockThreshold: 1,
    archived: false,
  },
  {
    id: 'm6',
    name: 'Amoxilox 250 mg',
    genericName: 'Amoxicillin',
    strength: '250 mg',
    dosageForm: 'Capsule',
    instructions: 'Completed 7-day course',
    stockRemaining: 0,
    stockUnit: 'capsules',
    unitPriceText: '৳6.00/unit',
    referencePackText: '30 capsules · ৳180.00',
    lowStockThreshold: 5,
    archived: true,
  },
];

export function formatStockQuantity(value: number | string): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '0';
  if (Number.isInteger(num)) return String(num);
  return String(Number(num.toFixed(2)));
}

export function isPersonalMedicationLowStock(
  med: Pick<PersonalMedicationRecord, 'archived' | 'stockRemaining' | 'lowStockThreshold'>,
): boolean {
  return !med.archived && med.stockRemaining <= med.lowStockThreshold;
}

export function resolveMedicationStatusVariant(
  med: Pick<PersonalMedicationRecord, 'archived' | 'stockRemaining' | 'lowStockThreshold'>,
): StatusVariant {
  if (med.archived) return 'archived';
  if (med.stockRemaining <= med.lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

export function inferStockUnit(dosageForm?: string | null): string {
  const norm = (dosageForm ?? '').trim().toLowerCase();
  if (norm.includes('suppository') || norm.includes('pessary')) return 'pieces';
  if (norm.includes('sachet') || norm.includes('granules') || norm.includes('oral powder')) {
    return 'sachets';
  }
  if (norm.includes('capsule')) return 'capsules';
  if (norm.includes('syrup') || norm.includes('suspension') || norm.includes('solution') || norm.includes('elixir')) {
    if (norm.includes('ophthalmic') || norm.includes('drop')) return 'bottle';
    return 'ml';
  }
  if (norm.includes('drop')) return 'bottle';
  if (norm.includes('injection') || norm.includes('infusion') || norm.includes('vial')) {
    return 'vials';
  }
  if (norm.includes('cream') || norm.includes('ointment') || norm.includes('gel')) {
    return 'tube';
  }
  if (norm.includes('inhaler') || norm.includes('spray')) return 'puffs';
  return 'tablets';
}

export function parseNonNegativeNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Number(parsed.toFixed(2));
}

export function filterPersonalMedications(
  medications: PersonalMedicationRecord[],
  options: { query?: string; filter?: MedFilter },
): PersonalMedicationRecord[] {
  const filter = options.filter ?? 'all';
  const query = (options.query ?? '').trim().toLowerCase();

  return medications.filter((m) => {
    if (filter === 'active' && m.archived) return false;
    if (filter === 'archived' && !m.archived) return false;
    if (filter === 'low_stock' && !isPersonalMedicationLowStock(m)) {
      return false;
    }
    if (query.length > 0) {
      const hay = `${m.name} ${m.genericName ?? ''} ${m.strength ?? ''} ${m.dosageForm} ${m.manufacturer ?? ''}`.toLowerCase();
      return hay.includes(query);
    }
    return true;
  });
}

export function mapApiMedicationToRecord(dto: PatientMedicationDto): PersonalMedicationRecord {
  const pack = dto.catalogueBrand?.primaryPack;
  const unitPriceText = pack?.unitPrice
    ? `৳${pack.unitPrice}/unit`
    : pack?.packPrice
      ? `৳${pack.packPrice}/pack`
      : 'Not listed';
  const referencePackText =
    pack?.packQuantity && pack?.packPrice
      ? `${pack.packQuantity} · ৳${pack.packPrice}`
      : null;

  return {
    id: dto.id,
    catalogueBrandId: dto.catalogueBrandId,
    genericSourceId: dto.catalogueBrand?.generic?.sourceId ?? null,
    name: dto.name,
    genericName: dto.genericName,
    strength: dto.strength,
    dosageForm: dto.dosageForm ?? 'Medicine',
    manufacturer: dto.manufacturer,
    instructions: dto.personalInstructions,
    stockRemaining: Number(dto.stockRemaining) || 0,
    stockUnit: dto.stockUnit,
    stripUnits: pack?.stripUnits ?? null,
    unitPriceText,
    referencePackText,
    lowStockThreshold: Number(dto.lowStockThreshold) || 0,
    archived: dto.status === 'ARCHIVED',
  };
}
