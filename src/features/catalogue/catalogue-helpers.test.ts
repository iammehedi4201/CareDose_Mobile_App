import { describe, expect, it } from 'vitest';
import type { CatalogueBrandSummaryDto, CataloguePackDto } from '../../api/catalogue';
import {
  formatCurrencyAmount,
  formatMissingCatalogueValue,
  formatPackSummary,
  formatPackWarningReason,
  formatStripUnitsValue,
  formatUnitOrPackPrice,
  getStripUnitsLabel,
  isSolidDosageForm,
  resolveBrandBadge,
  resolvePackQuantityUnit,
} from './catalogue-helpers';

describe('Phase 4 — Mobile Catalogue Formatting & Safety Helpers', () => {
  it('renders missing fields explicitly as "Not available" without guessing', () => {
    expect(formatMissingCatalogueValue(null)).toBe('Not available');
    expect(formatMissingCatalogueValue('   ')).toBe('Not available');
    expect(formatMissingCatalogueValue(' 100 mg ')).toBe('100 mg');
    expect(formatCurrencyAmount(null)).toBe('Not available');
    expect(formatCurrencyAmount('200.50')).toBe('৳ 200.50');
  });

  it('formats pack summaries and unit/pack price strings accurately', () => {
    const tabletPack: CataloguePackDto = {
      id: 'p1',
      packQuantity: '5 x 10',
      packUnits: 50,
      unitPrice: '4.01',
      packPrice: '200.50',
      currency: 'BDT',
      unitPriceLabel: 'Unit Price',
      priceSource: 'brand_page',
      sourceUrl: null,
      collectedAt: null,
      verification: 'UNVERIFIED',
      warnings: [],
      hasPriceWarning: false,
    };

    expect(formatPackSummary(tabletPack)).toBe('5 x 10 (50 units)');
    expect(formatUnitOrPackPrice(tabletPack)).toBe('৳ 4.01 / unit');

    const syrupPack: CataloguePackDto = {
      ...tabletPack,
      id: 'p2',
      packQuantity: '100 ml bottle',
      packUnits: null,
      unitPrice: null,
      packPrice: '40.12',
    };

    expect(formatPackSummary(syrupPack)).toBe('100 ml bottle');
    expect(formatUnitOrPackPrice(syrupPack)).toBe('৳ 40.12 / pack');
    expect(formatUnitOrPackPrice({ ...syrupPack, packPrice: null })).toBe('Price unavailable');
  });

  it('preserves unverified and price-warning status badges and warning labels', () => {
    const base: Pick<CatalogueBrandSummaryDto, 'verification' | 'hasPriceWarning'> = {
      verification: 'UNVERIFIED',
      hasPriceWarning: false,
    };
    expect(resolveBrandBadge(base)).toEqual({
      variant: 'unverified',
      label: 'Unverified',
      showBadge: false,
    });

    expect(resolveBrandBadge({ verification: 'UNVERIFIED', hasPriceWarning: true })).toEqual({
      variant: 'low_stock',
      label: 'Price warning',
      showBadge: true,
    });

    expect(formatPackWarningReason('pack_price_inconsistent_with_unit_price')).toMatch(
      /unit price/i,
    );
    expect(formatPackWarningReason('combination_product')).toMatch(/combination/i);
  });

  it('detects solid dosage forms and formats tablets/capsules/pieces per strip labels and values', () => {
    expect(isSolidDosageForm('Tablet')).toBe(true);
    expect(isSolidDosageForm('Tablet (Extended Release)')).toBe(true);
    expect(isSolidDosageForm('Capsule (Enteric Coated)')).toBe(true);
    expect(isSolidDosageForm('Suppository')).toBe(true);
    expect(isSolidDosageForm('Syrup')).toBe(false);
    expect(isSolidDosageForm('IV Infusion')).toBe(false);
    expect(isSolidDosageForm(null)).toBe(false);

    expect(getStripUnitsLabel('Tablet')).toBe('Tablets per strip');
    expect(getStripUnitsLabel('Capsule')).toBe('Capsules per strip');
    expect(getStripUnitsLabel('Suppository')).toBe('Pieces per strip');

    expect(formatStripUnitsValue(10, 'Tablet')).toBe('10 tablets');
    expect(formatStripUnitsValue(10, 'Tablet', 510)).toBe('10 tablets (51 strips in pack)');
    expect(formatStripUnitsValue(14, 'Capsule', 140)).toBe('14 capsules (10 strips in pack)');
    expect(formatStripUnitsValue(5, 'Suppository', 30)).toBe('5 pieces (6 strips in pack)');
    expect(formatStripUnitsValue(null, 'Tablet')).toBe('Not available');
  });

  it('resolves appropriate quantity units for every dosage form (strips, packs, syrups, suppositories, drops, injections)', () => {
    const basePack: CataloguePackDto = {
      id: 'p-base',
      packQuantity: null,
      packUnits: null,
      stripUnits: null,
      unitPrice: null,
      packPrice: null,
      currency: 'BDT',
      unitPriceLabel: null,
      priceSource: 'brand_page',
      sourceUrl: null,
      collectedAt: null,
      verification: 'UNVERIFIED',
      warnings: [],
      hasPriceWarning: false,
    };

    expect(
      resolvePackQuantityUnit(
        { ...basePack, packQuantity: "510's pack", packUnits: 510, stripUnits: 10 },
        'Tablet',
      ),
    ).toEqual({ label: 'Tablets per strip', value: '10 tablets (51 strips in pack)' });

    expect(
      resolvePackQuantityUnit(
        { ...basePack, packQuantity: "100's pack", packUnits: 100, stripUnits: null },
        'Tablet',
      ),
    ).toEqual({ label: 'Pack quantity', value: '100 tablets per pack' });

    expect(
      resolvePackQuantityUnit({ ...basePack, unitPrice: '10.00' }, 'Capsule'),
    ).toEqual({ label: 'Quantity unit', value: 'Per capsule (sold by unit)' });

    expect(
      resolvePackQuantityUnit({ ...basePack, packQuantity: '100 ml bottle' }, 'Syrup'),
    ).toEqual({ label: 'Bottle volume', value: '100 ml per bottle' });

    expect(
      resolvePackQuantityUnit(
        { ...basePack, packQuantity: "20's pack", packUnits: 20, stripUnits: 5 },
        'Suppository',
      ),
    ).toEqual({ label: 'Pieces per strip', value: '5 pieces (4 strips in pack)' });

    expect(
      resolvePackQuantityUnit(
        { ...basePack, packQuantity: "10's pack", packUnits: 10, stripUnits: null },
        'Suppository',
      ),
    ).toEqual({ label: 'Quantity unit', value: '10 pieces per pack' });

    expect(
      resolvePackQuantityUnit({ ...basePack, packQuantity: '15 ml bottle' }, 'Eye Drops'),
    ).toEqual({ label: 'Drop bottle volume', value: '15 ml per bottle' });

    expect(
      resolvePackQuantityUnit({ ...basePack, packQuantity: '15 gm tube' }, 'Cream'),
    ).toEqual({ label: 'Tube weight', value: '15 gm per tube' });

    expect(
      resolvePackQuantityUnit({ ...basePack, packQuantity: '120 metered sprays' }, 'Nasal Spray'),
    ).toEqual({ label: 'Inhaler doses', value: '120 puffs / metered doses' });

    expect(
      resolvePackQuantityUnit({ ...basePack, packQuantity: '85 gm bottle' }, 'Powder for Solution'),
    ).toEqual({ label: 'Bottle weight', value: '85 gm per bottle' });

    expect(
      resolvePackQuantityUnit(
        { ...basePack, packQuantity: "5's pack", packUnits: 5 },
        'Nebuliser Solution',
      ),
    ).toEqual({ label: 'Pack quantity', value: '5 respules / ampoules per pack' });
  });
});
