import { describe, expect, it } from 'vitest';
import {
  formatThumbnailFormLabel,
  normalizeMedicineFormCategory,
} from '../MedicineFormThumbnail';

describe('MedicineFormThumbnail dosage form detection & labeling', () => {
  it('classifies dosage forms into clear visual thumbnail categories', () => {
    expect(normalizeMedicineFormCategory('Tablet')).toBe('tablet');
    expect(normalizeMedicineFormCategory('Tablet (Extended Release)')).toBe('tablet');
    expect(normalizeMedicineFormCategory('Capsule')).toBe('capsule');
    expect(normalizeMedicineFormCategory('Syrup')).toBe('syrup');
    expect(normalizeMedicineFormCategory('Powder for Suspension')).toBe('syrup');
    expect(normalizeMedicineFormCategory('Pediatric Drops')).toBe('drops');
    expect(normalizeMedicineFormCategory('Suppository')).toBe('suppository');
    expect(normalizeMedicineFormCategory('IV Infusion')).toBe('injection');
    expect(normalizeMedicineFormCategory('Cream')).toBe('cream');
    expect(normalizeMedicineFormCategory('Metered Dose Inhaler')).toBe('inhaler');
    expect(normalizeMedicineFormCategory(null)).toBe('default');
  });

  it('produces readable pill-tag dosage form labels without clipping', () => {
    expect(formatThumbnailFormLabel('Tablet')).toBe('Tablet');
    expect(formatThumbnailFormLabel('Tablet (Extended Release)')).toBe('Tablet ER');
    expect(formatThumbnailFormLabel('Syrup')).toBe('Syrup');
    expect(formatThumbnailFormLabel('Suppository')).toBe('Suppository');
    expect(formatThumbnailFormLabel('Pediatric Drops')).toBe('Paediatric Drops');
    expect(formatThumbnailFormLabel(null)).toBe('Medicine');
  });
});
