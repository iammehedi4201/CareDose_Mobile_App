import { describe, expect, it } from 'vitest';
import type { CataloguePackDto } from '../../api/catalogue';
import {
  calculateStockAndPrice,
  classifyDosageFormStrategy,
  computeDefaultLowStockThreshold,
  extractPackInfo,
  formatStockWithUnit,
  getAvailableStockModes,
  getDefaultStockMode,
  getPriceUnitBasis,
} from './stock-calculator';

function makePack(overrides: Partial<CataloguePackDto> = {}): CataloguePackDto {
  return {
    id: 'pk-1',
    packQuantity: null,
    packUnits: null,
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
    ...overrides,
  };
}

describe('Add Medicine — Dosage-Form Stock & Price Calculation Engine', () => {
  it('calculates Tablet stock by strips when strip size is explicitly in DB ("50 x 10")', () => {
    const pack = makePack({
      packQuantity: '50 x 10',
      packUnits: 500,
      unitPrice: '1.20',
      packPrice: '600.00',
    });
    const info = extractPackInfo('Tablet', pack, [pack]);

    expect(info.strategy).toBe('tablet_capsule');
    expect(info.stripUnits).toBe(10);
    expect(getDefaultStockMode(info)).toBe('strips');

    const res = calculateStockAndPrice({
      packInfo: info,
      mode: 'strips',
      primaryQty: '3',
      secondaryQty: String(info.stripUnits),
    });

    expect(res.stockRemaining).toBe(30);
    expect(res.stockUnit).toBe('tablets');
    expect(res.calculatedTotalPrice).toBe(36);
    expect(res.missingPackagingNotice).toBeNull();
    expect(res.calculationSummary).toContain('30 tablets');
    expect(res.priceScopeDescription).toContain('Total value for 30 tablets');
  });

  it('does NOT assume strip size when tablet pack only lists box count ("510\'s pack" / "30\'s pack")', () => {
    const pack = makePack({
      packQuantity: "510's pack",
      packUnits: 510,
      unitPrice: '1.20',
      packPrice: '612.00',
    });
    const info = extractPackInfo('Tablet', pack, [pack]);

    expect(info.stripUnits).toBeNull();
    expect(getDefaultStockMode(info)).toBe('direct');

    // Direct entry works cleanly without guessing strip size
    const directRes = calculateStockAndPrice({
      packInfo: info,
      mode: 'direct',
      primaryQty: '25',
    });
    expect(directRes.stockRemaining).toBe(25);
    expect(directRes.stockUnit).toBe('tablets');
    expect(directRes.calculatedTotalPrice).toBe(30);
    // Direct tablet/capsule mode works without nagging warnings when catalogue lacks strip size
    expect(directRes.missingPackagingNotice).toBeNull();

    // If user switches to "By strips" without entering strip size manually, prompt inline and keep stock incomplete
    const missingStripSizeRes = calculateStockAndPrice({
      packInfo: info,
      mode: 'strips',
      primaryQty: '3',
      secondaryQty: '',
    });
    expect(missingStripSizeRes.stockRemaining).toBeNull();
    expect(missingStripSizeRes.isValid).toBe(false);
    expect(missingStripSizeRes.missingPackagingNotice).toContain('Strip size is not listed');
  });

  it('uses explicit stripUnits from catalogue pack when pack_quantity only shows total count', () => {
    const pack = makePack({
      packQuantity: "144's pack",
      packUnits: 144,
      stripUnits: 12,
      unitPrice: '2.00',
      packPrice: '288.00',
    });
    const info = extractPackInfo('Tablet (Extended Release)', pack, [pack]);

    expect(info.stripUnits).toBe(12);
    expect(info.stripsInPack).toBe(12);
    expect(getDefaultStockMode(info)).toBe('strips');

    const res = calculateStockAndPrice({
      packInfo: info,
      mode: 'strips',
      primaryQty: '3',
      secondaryQty: String(info.stripUnits),
    });
    expect(res.stockRemaining).toBe(36);
    expect(res.stockUnit).toBe('tablets');
    expect(res.calculatedTotalPrice).toBe(72);
    expect(res.missingPackagingNotice).toBeNull();
  });

  it('ignores strength numbers in combined strings like "0.625mg x 100\'s pack" when extracting strip units', () => {
    const pack = makePack({
      packQuantity: "0.625mg x 100's pack",
      packUnits: 100,
      packPrice: '202.60',
    });
    const info = extractPackInfo('Tablet', pack, [pack]);
    expect(info.stripUnits).toBeNull();
    expect(info.packTotalUnits).toBe(100);
    expect(info.discreteUnitPrice).toBeCloseTo(2.026, 2);
  });

  it('calculates Syrup stock and proportional value in both bottles and ml modes', () => {
    const pack = makePack({
      packQuantity: '100 ml bottle',
      packUnits: null,
      unitPrice: null,
      packPrice: '50.00',
    });
    const info = extractPackInfo('Syrup', pack, [pack]);

    expect(info.strategy).toBe('liquid');
    expect(info.bottleVolumeMl).toBe(100);
    expect(getDefaultStockMode(info)).toBe('bottles');

    const byBottles = calculateStockAndPrice({
      packInfo: info,
      mode: 'bottles',
      primaryQty: '2',
      secondaryQty: String(info.bottleVolumeMl),
    });
    expect(byBottles.stockRemaining).toBe(200);
    expect(byBottles.stockUnit).toBe('ml');
    expect(byBottles.calculatedTotalPrice).toBe(100);
    expect(byBottles.calculationSummary).toContain('200 ml');

    const byMl = calculateStockAndPrice({
      packInfo: info,
      mode: 'ml',
      primaryQty: '50',
    });
    expect(byMl.stockRemaining).toBe(50);
    expect(byMl.stockUnit).toBe('ml');
    expect(byMl.calculatedTotalPrice).toBe(25);
  });

  it('handles Suppository in pieces and detects container units for Injections accurately', () => {
    const suppPack = makePack({
      packQuantity: "20's pack",
      packUnits: 20,
      unitPrice: '4.00',
      packPrice: '80.00',
    });
    const suppInfo = extractPackInfo('Suppository', suppPack, [suppPack]);
    expect(suppInfo.strategy).toBe('suppository');
    expect(getDefaultStockMode(suppInfo)).toBe('direct');
    const suppRes = calculateStockAndPrice({
      packInfo: suppInfo,
      mode: 'direct',
      primaryQty: '6',
    });
    expect(suppRes.stockRemaining).toBe(6);
    expect(suppRes.stockUnit).toBe('pieces');
    expect(suppRes.calculatedTotalPrice).toBe(24);

    // Vial injection
    const vialPack = makePack({ packQuantity: '40 mg vial', packPrice: '90.00' });
    const vialInfo = extractPackInfo('IV Injection', vialPack, [vialPack]);
    expect(vialInfo.containerUnit).toBe('vials');
    const vialRes = calculateStockAndPrice({ packInfo: vialInfo, mode: 'containers', primaryQty: '3' });
    expect(vialRes.stockRemaining).toBe(3);
    expect(vialRes.stockUnit).toBe('vials');
    expect(vialRes.calculatedTotalPrice).toBe(270);

    // Ampoule multi-pack referencing sibling pack
    const multiAmpPack = makePack({ id: 'p1', packQuantity: "5's pack", packUnits: 5, packPrice: '175.00' });
    const singleAmpPack = makePack({ id: 'p2', packQuantity: '5 ml ampoule', packPrice: '35.00' });
    const ampInfo = extractPackInfo('Injection', multiAmpPack, [multiAmpPack, singleAmpPack]);
    expect(ampInfo.containerUnit).toBe('ampoules');
    expect(ampInfo.containerPrice).toBe(35);

    // Pre-filled syringe
    const pfsPack = makePack({ packQuantity: '4000 IU pre-filled syringe', packPrice: '1935.00' });
    const pfsInfo = extractPackInfo('IV/SC Injection', pfsPack, [pfsPack]);
    expect(pfsInfo.containerUnit).toBe('syringes');
    expect(formatStockWithUnit(2, pfsInfo.containerUnit!)).toBe('2 pre-filled syringes');
  });

  it('handles Eye Drops in bottles with bottle volume consideration and sensible default thresholds', () => {
    const dropPack = makePack({
      packQuantity: '10 ml drop',
      packPrice: '80.00',
    });
    const info = extractPackInfo('Ophthalmic Solution', dropPack, [dropPack]);
    expect(info.strategy).toBe('drops');
    expect(info.bottleVolumeMl).toBe(10);
    expect(getDefaultStockMode(info)).toBe('bottles');

    const res = calculateStockAndPrice({
      packInfo: info,
      mode: 'bottles',
      primaryQty: '2',
      secondaryQty: '10',
    });
    expect(res.stockRemaining).toBe(2);
    expect(res.stockUnit).toBe('bottle');
    expect(res.calculatedTotalPrice).toBe(160);
    expect(res.calculationSummary).toContain('20 ml total');

    // Sensible low-stock thresholds
    expect(computeDefaultLowStockThreshold('drops', 'bottle', 1)).toBe(0);
    expect(computeDefaultLowStockThreshold('drops', 'bottle', 2)).toBe(1);
    expect(computeDefaultLowStockThreshold('liquid', 'ml', 100, 100)).toBe(20);
    expect(computeDefaultLowStockThreshold('drops', 'ml', 15, 15)).toBe(5);
    expect(computeDefaultLowStockThreshold('tablet_capsule', 'tablets', 30)).toBe(5);
    expect(computeDefaultLowStockThreshold('suppository', 'pieces', 10)).toBe(5);
  });

  it('handles Inhalers and Sachets without assumptions', () => {
    const mdiPack = makePack({
      packQuantity: '120 metered doses',
      packPrice: '595.00',
    });
    const mdiInfo = extractPackInfo('Metered-Dose Inhaler (MDI)', mdiPack, [mdiPack]);
    expect(mdiInfo.meteredDoses).toBe(120);
    expect(getAvailableStockModes(mdiInfo).map((m) => m.mode)).toEqual(['containers', 'puffs']);

    const mdiRes = calculateStockAndPrice({
      packInfo: mdiInfo,
      mode: 'containers',
      primaryQty: '1',
    });
    expect(mdiRes.stockRemaining).toBe(120);
    expect(mdiRes.stockUnit).toBe('puffs');
    expect(mdiRes.calculatedTotalPrice).toBe(595);

    expect(classifyDosageFormStrategy('Oral Suspension', '10 ml sachet')).toBe('sachet');

    // Price basis denominators align per mode
    expect(
      getPriceUnitBasis({
        mode: 'bottles',
        primaryQty: '2',
        stockRemaining: 200,
        containerUnit: 'bottle',
        stockUnit: 'ml',
      }),
    ).toEqual({ multiplier: 2, unitLabel: 'bottle' });

    expect(
      getPriceUnitBasis({
        mode: 'strips',
        primaryQty: '3',
        stockRemaining: 30,
        containerUnit: 'tablets',
        stockUnit: 'tablets',
      }),
    ).toEqual({ multiplier: 30, unitLabel: 'tablet' });

    expect(
      getPriceUnitBasis({
        mode: 'containers',
        primaryQty: '4',
        stockRemaining: 4,
        containerUnit: 'ampoules',
        stockUnit: 'ampoules',
      }),
    ).toEqual({ multiplier: 4, unitLabel: 'ampoule' });
  });
});
