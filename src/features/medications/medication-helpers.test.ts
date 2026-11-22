import { describe, expect, it } from 'vitest';
import {
  filterPersonalMedications,
  formatStockQuantity,
  inferStockUnit,
  INITIAL_PERSONAL_MEDS,
  isPersonalMedicationLowStock,
  parseNonNegativeNumberInput,
  resolveMedicationStatusVariant,
} from './medication-helpers';

describe('Phase 5 — Personal Medication Helpers & Filtering Rules', () => {
  it('computes low-stock status accurately and ignores archived medicines', () => {
    const lowMed = INITIAL_PERSONAL_MEDS.find((m) => m.id === 'm2')!;
    const okMed = INITIAL_PERSONAL_MEDS.find((m) => m.id === 'm1')!;
    const archivedMed = INITIAL_PERSONAL_MEDS.find((m) => m.id === 'm6')!;

    expect(isPersonalMedicationLowStock(lowMed)).toBe(true);
    expect(resolveMedicationStatusVariant(lowMed)).toBe('low_stock');

    expect(isPersonalMedicationLowStock(okMed)).toBe(false);
    expect(resolveMedicationStatusVariant(okMed)).toBe('in_stock');

    expect(isPersonalMedicationLowStock(archivedMed)).toBe(false);
    expect(resolveMedicationStatusVariant(archivedMed)).toBe('archived');
  });

  it('filters medications by status tab (All, Active, Low Stock, Archived) and text query', () => {
    const allMeds = INITIAL_PERSONAL_MEDS;
    expect(filterPersonalMedications(allMeds, { filter: 'all' })).toHaveLength(6);
    expect(filterPersonalMedications(allMeds, { filter: 'active' })).toHaveLength(5);
    expect(filterPersonalMedications(allMeds, { filter: 'archived' })).toHaveLength(1);

    const low = filterPersonalMedications(allMeds, { filter: 'low_stock' });
    expect(low.map((m) => m.id)).toEqual(['m2', 'm5']);

    const search = filterPersonalMedications(allMeds, { query: 'metformin', filter: 'active' });
    expect(search).toHaveLength(1);
    expect(search[0].name).toBe('Glymexa 500 mg');
  });

  it('formats stock numbers, infers default units, and rejects invalid numeric input', () => {
    expect(formatStockQuantity('24.00')).toBe('24');
    expect(formatStockQuantity('2.50')).toBe('2.5');
    expect(formatStockQuantity(0)).toBe('0');

    expect(inferStockUnit('Tablet')).toBe('tablets');
    expect(inferStockUnit('Capsule')).toBe('capsules');
    expect(inferStockUnit('Eye Drops')).toBe('bottle');
    expect(inferStockUnit('Oral Suspension')).toBe('ml');

    expect(parseNonNegativeNumberInput('15')).toBe(15);
    expect(parseNonNegativeNumberInput('0')).toBe(0);
    expect(parseNonNegativeNumberInput('-3')).toBeNull();
    expect(parseNonNegativeNumberInput('abc')).toBeNull();
    expect(parseNonNegativeNumberInput('')).toBeNull();
  });
});
