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
    expect(res.calculationSummary).toBe('3 strips = 30 tablets');
    expect(res.priceScopeDescription).toContain('Total value for 30 tablets');
    expect(info.hasReliableDefaultPackaging).toBe(true);
  });

  it('rejects inconsistent stripUnits while preserving verified pack-level conversion without guessing strips', () => {
    const inconsistentPack = makePack({
      packQuantity: "28's pack",
      packUnits: 28,
      stripUnits: 10,
      packPrice: '280.00',
    });
    const badInfo = extractPackInfo('Tablet', inconsistentPack, [inconsistentPack]);
    expect(badInfo.stripUnits).toBeNull();
    expect(badInfo.packTotalUnits).toBe(28);
    expect(badInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(badInfo)).toBe('packs');
    expect(getAvailableStockModes(badInfo).map((m) => m.mode)).toEqual(['packs', 'direct', 'strips']);

    const jarPack = makePack({
      packQuantity: '100 ml bottle',
      packUnits: 100,
      stripUnits: 10,
    });
    const jarInfo = extractPackInfo('Tablet', jarPack, [jarPack]);
    expect(jarInfo.stripUnits).toBeNull();
    expect(jarInfo.hasReliableDefaultPackaging).toBe(false);
  });

  it('requires strictly positive quantities for saving opening stock', () => {
    const pack = makePack({ packQuantity: '5 x 10', packUnits: 50, stripUnits: 10 });
    const info = extractPackInfo('Tablet', pack, [pack]);
    const zeroRes = calculateStockAndPrice({
      packInfo: info,
      mode: 'strips',
      primaryQty: '0',
      secondaryQty: '10',
    });
    expect(zeroRes.isValid).toBe(false);
    expect(zeroRes.stockRemaining).toBeNull();
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

  it('defaults to whole Packs / Bottles for bottle-packaged tablets like Neuro-B ("30\'s pack" / "30\'s bottle") without false unavailable warning', () => {
    const neuroBPack = makePack({
      packQuantity: "30's pack",
      packUnits: 30,
      stripUnits: null,
      unitPrice: '8.00',
      packPrice: '240.00',
    });
    const neuroInfo = extractPackInfo('Tablet', neuroBPack, [neuroBPack]);
    expect(neuroInfo.hasReliableDefaultPackaging).toBe(true);
    expect(neuroInfo.prefersWholePackDefault).toBe(true);
    expect(getDefaultStockMode(neuroInfo)).toBe('packs');
    expect(getAvailableStockModes(neuroInfo).map((m) => m.mode)).toEqual([
      'packs',
      'direct',
      'strips',
    ]);

    const packRes = calculateStockAndPrice({
      packInfo: neuroInfo,
      mode: 'packs',
      primaryQty: '1',
    });
    expect(packRes.stockRemaining).toBe(30);
    expect(packRes.stockUnit).toBe('tablets');
    expect(packRes.calculatedTotalPrice).toBe(240);
    expect(packRes.calculationSummary).toBe('1 pack = 30 tablets');
    expect(packRes.missingPackagingNotice).toBeNull();

    const bottleTabletPack = makePack({
      packQuantity: "60's bottle",
      packUnits: 60,
      stripUnits: null,
      packPrice: '480.00',
    });
    const bottleInfo = extractPackInfo('Tablet', bottleTabletPack, [bottleTabletPack]);
    expect(bottleInfo.hasReliableDefaultPackaging).toBe(true);
    expect(bottleInfo.wholePackNoun).toBe('bottle');
    expect(getDefaultStockMode(bottleInfo)).toBe('packs');
    expect(getAvailableStockModes(bottleInfo)[0]?.label).toBe('Bottles (60)');

    const bottleRes = calculateStockAndPrice({
      packInfo: bottleInfo,
      mode: 'packs',
      primaryQty: '2',
    });
    expect(bottleRes.stockRemaining).toBe(120);
    expect(bottleRes.calculationSummary).toBe('2 bottles = 120 tablets');
    expect(bottleRes.calculatedTotalPrice).toBe(960);
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

  // --- Phase 3 Regression Suite ---
  it('supports Reelife 40-tablet pack (pack conversion valid, strip disabled) and 56-tablet pack (pack & strip valid)', () => {
    const reelife40 = makePack({
      id: 'pk-reelife-40',
      packQuantity: "40's pack",
      packUnits: 40,
      stripUnits: 14,
      unitPrice: '8.00',
      packPrice: '320.00',
      verification: 'VERIFIED',
    });
    const reelife56 = makePack({
      id: 'pk-reelife-56',
      packQuantity: "56's pack",
      packUnits: 56,
      stripUnits: 14,
      unitPrice: '8.00',
      packPrice: '448.00',
      verification: 'VERIFIED',
    });

    // 1. Reelife 40-tablet pack: pack conversion works; strip conversion unavailable
    const info40 = extractPackInfo('Tablet', reelife40, [reelife40, reelife56]);
    expect(info40.stripUnits).toBeNull();
    expect(info40.packTotalUnits).toBe(40);
    expect(info40.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(info40)).toBe('packs');
    expect(getAvailableStockModes(info40).map((m) => m.mode)).toEqual(['packs', 'direct', 'strips']);

    const manualStrip40 = calculateStockAndPrice({
      packInfo: info40,
      mode: 'strips',
      primaryQty: '2',
      secondaryQty: '',
    });
    expect(manualStrip40.isValid).toBe(false);
    expect(manualStrip40.missingPackagingNotice).toContain('Strip size is not listed');

    // 3. Two 40-tablet packs produce 80 tablets
    const two40 = calculateStockAndPrice({
      packInfo: info40,
      mode: 'packs',
      primaryQty: '2',
    });
    expect(two40.isValid).toBe(true);
    expect(two40.stockRemaining).toBe(80);
    expect(two40.stockUnit).toBe('tablets');
    expect(two40.calculatedTotalPrice).toBe(640);
    expect(two40.calculationSummary).toBe('2 packs = 80 tablets');

    // 2. Reelife 56-tablet pack: both strip and pack conversions work
    const info56 = extractPackInfo('Tablet', reelife56, [reelife40, reelife56]);
    expect(info56.stripUnits).toBe(14);
    expect(info56.stripsInPack).toBe(4);
    expect(info56.packTotalUnits).toBe(56);
    expect(info56.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(info56)).toBe('strips');
    expect(getAvailableStockModes(info56).map((m) => m.mode)).toEqual(['strips', 'packs', 'direct']);

    const byStrips56 = calculateStockAndPrice({
      packInfo: info56,
      mode: 'strips',
      primaryQty: '4',
      secondaryQty: '14',
    });
    expect(byStrips56.stockRemaining).toBe(56);
    expect(byStrips56.calculatedTotalPrice).toBe(448);

    // 4. Two 56-tablet packs produce 112 tablets
    const two56 = calculateStockAndPrice({
      packInfo: info56,
      mode: 'packs',
      primaryQty: '2',
    });
    expect(two56.isValid).toBe(true);
    expect(two56.stockRemaining).toBe(112);
    expect(two56.stockUnit).toBe('tablets');
    expect(two56.calculatedTotalPrice).toBe(896);
    expect(two56.calculationSummary).toBe('2 packs = 112 tablets');
  });

  it('accepts valid single-unit tablet package (packUnits === 1)', () => {
    const singlePack = makePack({
      packQuantity: "1's pack",
      packUnits: 1,
      unitPrice: '25.00',
      packPrice: '25.00',
      verification: 'VERIFIED',
    });
    const info = extractPackInfo('Tablet', singlePack, [singlePack]);
    expect(info.packTotalUnits).toBe(1);
    expect(info.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(info)).toBe('packs');
    expect(getAvailableStockModes(info)[0]).toEqual({ mode: 'packs', label: 'Packs (1)' });

    const res = calculateStockAndPrice({
      packInfo: info,
      mode: 'packs',
      primaryQty: '2',
    });
    expect(res.isValid).toBe(true);
    expect(res.stockRemaining).toBe(2);
    expect(res.stockUnit).toBe('tablets');
    expect(res.calculatedTotalPrice).toBe(50);
  });

  it('classifies inhaler metered doses as inhaler puffs rather than tablets while preserving discrete DPI capsules', () => {
    const seretidePack = makePack({
      packQuantity: '60 doses unit',
      packPrice: '850.00',
    });
    const seretideInfo = extractPackInfo('Inhalation Capsule', seretidePack, [seretidePack]);
    expect(seretideInfo.strategy).toBe('inhaler');
    expect(seretideInfo.meteredDoses).toBe(60);
    expect(seretideInfo.baseUnit).toBe('puffs');
    expect(seretideInfo.hasReliableDefaultPackaging).toBe(true);

    const mdpiPack = makePack({
      packQuantity: '60 doses maxhaler',
      packPrice: '600.00',
    });
    const mdpiInfo = extractPackInfo('MDPI', mdpiPack, [mdpiPack]);
    expect(mdpiInfo.strategy).toBe('inhaler');
    expect(mdpiInfo.meteredDoses).toBe(60);
    expect(mdpiInfo.baseUnit).toBe('puffs');

    const dpiCapsulePack = makePack({
      packQuantity: "30's pack",
      packUnits: 30,
      stripUnits: 10,
      packPrice: '300.00',
    });
    const dpiCapsuleInfo = extractPackInfo('DPI (Inhalation Capsule)', dpiCapsulePack, [dpiCapsulePack]);
    expect(dpiCapsuleInfo.strategy).toBe('tablet_capsule');
    expect(dpiCapsuleInfo.baseUnit).toBe('capsules');
    expect(dpiCapsuleInfo.stripUnits).toBe(10);
  });

  it('tracks insulin pen container counts (KwikPen, FlexPen, SoloSTAR) without mistaking containers for doses', () => {
    const kwikPack = makePack({ packQuantity: '3 ml KwikPen', packPrice: '1200.00' });
    const flexPack = makePack({ packQuantity: '3 ml flexpen', packPrice: '1100.00' });
    const soloPack = makePack({ packQuantity: '3 ml SoloSTAR', packPrice: '1350.00' });
    const penBox = makePack({ id: 'pk-box', packQuantity: "5's pack", packUnits: 5, packPrice: '6000.00' });

    for (const [label, pack] of [
      ['KwikPen', kwikPack],
      ['FlexPen', flexPack],
      ['SoloSTAR', soloPack],
    ] as const) {
      const info = extractPackInfo('Insulin Device', pack, [pack]);
      expect(info.strategy, label).toBe('injection');
      expect(info.containerUnit, label).toBe('pens');
      expect(info.meteredDoses, label).toBeNull();
      expect(info.hasReliableDefaultPackaging, label).toBe(true);

      const res = calculateStockAndPrice({
        packInfo: info,
        mode: 'containers',
        primaryQty: '2',
      });
      expect(res.stockRemaining).toBe(2);
      expect(res.stockUnit).toBe('pens');
    }

    const boxInfo = extractPackInfo('SC Injection', penBox, [penBox, kwikPack]);
    expect(boxInfo.containerUnit).toBe('pens');
    expect(boxInfo.containerPrice).toBe(1200);
    expect(boxInfo.hasReliableDefaultPackaging).toBe(true);
    const boxRes = calculateStockAndPrice({ packInfo: boxInfo, mode: 'containers', primaryQty: '3' });
    expect(boxRes.stockRemaining).toBe(3);
    expect(boxRes.stockUnit).toBe('pens');
    expect(boxRes.calculatedTotalPrice).toBe(3600);
  });

  it('requires verified quantities for topical/ocular sprays and respules without guessing', () => {
    // Verified ml topical spray -> liquid
    const mlSpray = makePack({ packQuantity: '50 ml spray', packPrice: '150.00' });
    const mlSprayInfo = extractPackInfo('Topical Spray', mlSpray, [mlSpray]);
    expect(mlSprayInfo.strategy).toBe('liquid');
    expect(mlSprayInfo.bottleVolumeMl).toBe(50);
    expect(mlSprayInfo.hasReliableDefaultPackaging).toBe(true);
    const mlSprayCalc = calculateStockAndPrice({
      packInfo: mlSprayInfo,
      mode: 'bottles',
      primaryQty: '2',
      secondaryQty: '50',
    });
    expect(mlSprayCalc.stockRemaining).toBe(100);
    expect(mlSprayCalc.stockUnit).toBe('ml');

    // Verified metered spray -> inhaler puffs
    const meteredSpray = makePack({ packQuantity: '200 metered spray', packPrice: '250.00' });
    const meteredSprayInfo = extractPackInfo('Topical Spray', meteredSpray, [meteredSpray]);
    expect(meteredSprayInfo.strategy).toBe('inhaler');
    expect(meteredSprayInfo.meteredDoses).toBe(200);
    expect(meteredSprayInfo.hasReliableDefaultPackaging).toBe(true);

    // Spray without verified volume or dose count -> never infers ml/doses
    const unverifiedSpray = makePack({ packQuantity: '1 bottle', packPrice: '150.00' });
    const unverifiedSprayInfo = extractPackInfo('Ocular Spray', unverifiedSpray, [unverifiedSpray]);
    expect(unverifiedSprayInfo.bottleVolumeMl).toBeNull();
    expect(unverifiedSprayInfo.meteredDoses).toBeNull();
    expect(unverifiedSprayInfo.hasReliableDefaultPackaging).toBe(false);

    // Respirator Solution with verified ml bottle -> liquid ml
    const respBottle = makePack({ packQuantity: '20 ml bottle', packPrice: '180.00' });
    const respBottleInfo = extractPackInfo('Respirator Solution', respBottle, [respBottle]);
    expect(respBottleInfo.strategy).toBe('liquid');
    expect(respBottleInfo.bottleVolumeMl).toBe(20);
    expect(respBottleInfo.hasReliableDefaultPackaging).toBe(true);

    // Nebuliser Suspension with respule count -> container tracking in respules (does NOT convert count into ml/doses)
    const nebRespules = makePack({ packQuantity: "5's pack", packUnits: 5, packPrice: '250.00' });
    const nebRespInfo = extractPackInfo('Nebuliser Suspension', nebRespules, [nebRespules]);
    expect(nebRespInfo.strategy).toBe('injection');
    expect(nebRespInfo.containerUnit).toBe('respules');
    expect(nebRespInfo.bottleVolumeMl).toBeNull();
    expect(nebRespInfo.meteredDoses).toBeNull();
    expect(nebRespInfo.hasReliableDefaultPackaging).toBe(true);
    const nebRes = calculateStockAndPrice({ packInfo: nebRespInfo, mode: 'containers', primaryQty: '3' });
    expect(nebRes.stockRemaining).toBe(3);
    expect(nebRes.stockUnit).toBe('respules');
    expect(nebRes.calculatedTotalPrice).toBe(150);

    // Respirator solution with neither packUnits nor ml volume -> requires manual input
    const unknownResp = makePack({ packQuantity: 'Pack', packUnits: null });
    const unknownRespInfo = extractPackInfo('Respirator Solution', unknownResp, [unknownResp]);
    expect(unknownRespInfo.hasReliableDefaultPackaging).toBe(false);
  });

  it('keeps existing valid tablet, capsule, syrup, and eye-drop conversions accurate', () => {
    const tab = makePack({ packQuantity: '10 x 10', packUnits: 100, stripUnits: 10, packPrice: '120.00' });
    const tabRes = calculateStockAndPrice({
      packInfo: extractPackInfo('Tablet', tab, [tab]),
      mode: 'strips',
      primaryQty: '4',
      secondaryQty: '10',
    });
    expect(tabRes.stockRemaining).toBe(40);
    expect(tabRes.stockUnit).toBe('tablets');
    expect(tabRes.calculatedTotalPrice).toBe(48);

    const cap = makePack({ packQuantity: '3 x 10', packUnits: 30, stripUnits: 10, packPrice: '300.00' });
    const capRes = calculateStockAndPrice({
      packInfo: extractPackInfo('Capsule', cap, [cap]),
      mode: 'strips',
      primaryQty: '2',
      secondaryQty: '10',
    });
    expect(capRes.stockRemaining).toBe(20);
    expect(capRes.stockUnit).toBe('capsules');
    expect(capRes.calculatedTotalPrice).toBe(200);

    const syrup = makePack({ packQuantity: '100 ml bottle', packPrice: '55.00' });
    const syrupRes = calculateStockAndPrice({
      packInfo: extractPackInfo('Syrup', syrup, [syrup]),
      mode: 'bottles',
      primaryQty: '2',
      secondaryQty: '100',
    });
    expect(syrupRes.stockRemaining).toBe(200);
    expect(syrupRes.stockUnit).toBe('ml');
    expect(syrupRes.calculatedTotalPrice).toBe(110);

    const drop = makePack({ packQuantity: '10 ml drop', packPrice: '90.00' });
    const dropRes = calculateStockAndPrice({
      packInfo: extractPackInfo('Eye Drops', drop, [drop]),
      mode: 'bottles',
      primaryQty: '2',
      secondaryQty: '10',
    });
    expect(dropRes.stockRemaining).toBe(2);
    expect(dropRes.stockUnit).toBe('bottle');
    expect(dropRes.calculatedTotalPrice).toBe(180);
  });
});
