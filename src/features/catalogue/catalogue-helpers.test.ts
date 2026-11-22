import { describe, expect, it } from 'vitest';
import type { CatalogueBrandSummaryDto, CataloguePackDto } from '../../api/catalogue';
import {
  formatCurrencyAmount,
  formatMissingCatalogueValue,
  formatPackSummary,
  formatPackWarningReason,
  formatUnitOrPackPrice,
  resolveBrandBadge,
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
});
