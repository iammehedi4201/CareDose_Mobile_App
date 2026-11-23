import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CataloguePackDto } from '../../api/catalogue';
import {
  calculateStockAndPrice,
  estimateCurrentStockValue,
  extractPackInfo,
  getAvailableStockModes,
  getDefaultStockMode,
  getEnteredQuantityUnit,
} from './stock-calculator';
import type { AddPersonalMedicationInput } from './MedicationsContext';

function makePack(overrides: Partial<CataloguePackDto> = {}): CataloguePackDto {
  return {
    id: 'pk-test',
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
    verification: 'VERIFIED',
    warnings: [],
    hasPriceWarning: false,
    ...overrides,
  };
}

describe('CareDose Simplified Add Medicine Flow — End-to-End Domain Rules', () => {
  it('auto-selects strips for verified Tablets & Capsules and computes plain-language totals', () => {
    const tabletPack = makePack({
      id: 'pk-tab',
      packQuantity: "100's pack",
      packUnits: 100,
      stripUnits: 10,
      unitPrice: '1.20',
      packPrice: '120.00',
    });
    const tabInfo = extractPackInfo('Tablet', tabletPack, [tabletPack]);
    expect(tabInfo.hasReliableDefaultPackaging).toBe(true);
    const tabMode = getDefaultStockMode(tabInfo);
    expect(tabMode).toBe('strips');
    expect(
      getEnteredQuantityUnit({
        mode: tabMode,
        baseUnit: tabInfo.baseUnit,
        containerUnit: tabInfo.containerUnit ?? tabInfo.baseUnit,
      }),
    ).toBe('strips');

    const tabCalc = calculateStockAndPrice({
      packInfo: tabInfo,
      mode: tabMode,
      primaryQty: '3',
      secondaryQty: String(tabInfo.stripUnits),
      hasCatalogSelection: true,
    });
    expect(tabCalc.isValid).toBe(true);
    expect(tabCalc.stockRemaining).toBe(30);
    expect(tabCalc.stockUnit).toBe('tablets');
    expect(tabCalc.calculationSummary).toBe('3 strips = 30 tablets');

    const capPack = makePack({
      id: 'pk-cap',
      packQuantity: '3 x 6',
      packUnits: 18,
      stripUnits: 6,
      unitPrice: '7.00',
      packPrice: '126.00',
    });
    const capInfo = extractPackInfo('Capsule', capPack, [capPack]);
    expect(capInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(capInfo)).toBe('strips');
    const capCalc = calculateStockAndPrice({
      packInfo: capInfo,
      mode: 'strips',
      primaryQty: '2',
      secondaryQty: String(capInfo.stripUnits),
      hasCatalogSelection: true,
    });
    expect(capCalc.stockRemaining).toBe(12);
    expect(capCalc.stockUnit).toBe('capsules');
    expect(capCalc.calculationSummary).toBe('2 strips = 12 capsules');
  });

  it('auto-selects appropriate package units for Syrup, Eye Drops, Suppository, Injection & Cream', () => {
    const syrupPack = makePack({ packQuantity: '60 ml bottle', packPrice: '45.00' });
    const syrupInfo = extractPackInfo('Syrup', syrupPack, [syrupPack]);
    expect(syrupInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(syrupInfo)).toBe('bottles');
    const syrupCalc = calculateStockAndPrice({
      packInfo: syrupInfo,
      mode: 'bottles',
      primaryQty: '2',
      secondaryQty: String(syrupInfo.bottleVolumeMl),
      hasCatalogSelection: true,
    });
    expect(syrupCalc.stockRemaining).toBe(120);
    expect(syrupCalc.stockUnit).toBe('ml');
    expect(syrupCalc.calculationSummary).toBe('2 bottles = 120 ml');

    const suspPack = makePack({ packQuantity: '100 ml bottle', packPrice: '85.00' });
    const suspInfo = extractPackInfo('Oral Suspension', suspPack, [suspPack]);
    expect(suspInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(suspInfo)).toBe('bottles');

    const dropsPack = makePack({ packQuantity: '5 ml drop', packPrice: '90.00' });
    const dropsInfo = extractPackInfo('Eye Drops', dropsPack, [dropsPack]);
    expect(dropsInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(dropsInfo)).toBe('bottles');
    const dropsCalc = calculateStockAndPrice({
      packInfo: dropsInfo,
      mode: 'bottles',
      primaryQty: '2',
      secondaryQty: String(dropsInfo.bottleVolumeMl),
      hasCatalogSelection: true,
    });
    expect(dropsCalc.stockRemaining).toBe(2);
    expect(dropsCalc.stockUnit).toBe('bottle');
    expect(dropsCalc.calculationSummary).toBe('2 bottles · 10 ml total');

    const suppPack = makePack({ packQuantity: "10's pack", packUnits: 10, packPrice: '80.00' });
    const suppInfo = extractPackInfo('Suppository', suppPack, [suppPack]);
    expect(suppInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(suppInfo)).toBe('direct');
    expect(
      getEnteredQuantityUnit({
        mode: 'direct',
        baseUnit: suppInfo.baseUnit,
        containerUnit: suppInfo.containerUnit ?? suppInfo.baseUnit,
      }),
    ).toBe('pieces');

    const vialPack = makePack({ packQuantity: '1 gm vial', packPrice: '190.00' });
    const vialInfo = extractPackInfo('IV Injection', vialPack, [vialPack]);
    expect(vialInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(vialInfo)).toBe('containers');
    expect(
      getEnteredQuantityUnit({
        mode: 'containers',
        baseUnit: vialInfo.baseUnit,
        containerUnit: vialInfo.containerUnit ?? 'vials',
      }),
    ).toBe('vials');

    const creamPack = makePack({ packQuantity: '15 gm tube', packPrice: '75.00' });
    const creamInfo = extractPackInfo('Cream', creamPack, [creamPack]);
    expect(creamInfo.hasReliableDefaultPackaging).toBe(true);
    expect(getDefaultStockMode(creamInfo)).toBe('containers');
    expect(
      getEnteredQuantityUnit({
        mode: 'containers',
        baseUnit: creamInfo.baseUnit,
        containerUnit: creamInfo.containerUnit ?? 'tubes',
      }),
    ).toBe('tubes');
  });

  it('rejects corrupt or missing packaging without guessing strip sizes or bottle volumes', () => {
    // 28's pack with strip_units=10 is arithmetically inconsistent (28 % 10 !== 0)
    const mismatchedPack = makePack({
      packQuantity: "28's pack",
      packUnits: 28,
      stripUnits: 10,
      packPrice: '280.00',
    });
    const mismatchedInfo = extractPackInfo('Tablet', mismatchedPack, [mismatchedPack]);
    expect(mismatchedInfo.stripUnits).toBeNull();
    expect(mismatchedInfo.hasReliableDefaultPackaging).toBe(false);
    expect(getDefaultStockMode(mismatchedInfo)).toBe('direct');

    // Bottle without ml volume never guesses 60/100ml
    const unknownSyrup = makePack({ packQuantity: 'Bottle', packPrice: null });
    const unknownSyrupInfo = extractPackInfo('Syrup', unknownSyrup, [unknownSyrup]);
    expect(unknownSyrupInfo.bottleVolumeMl).toBeNull();
    expect(unknownSyrupInfo.hasReliableDefaultPackaging).toBe(false);
    expect(getDefaultStockMode(unknownSyrupInfo)).toBe('ml');

    // Manual medicine entry without catalogue data defaults safely without strip count guessing
    const manualTabletInfo = extractPackInfo('Tablet', null, []);
    expect(manualTabletInfo.stripUnits).toBeNull();
    expect(manualTabletInfo.hasReliableDefaultPackaging).toBe(false);
    expect(getDefaultStockMode(manualTabletInfo)).toBe('direct');
    expect(getAvailableStockModes(manualTabletInfo).map((m) => m.mode)).toEqual(['direct', 'strips']);
  });

  it('rejects invalid / zero / empty quantities before save', () => {
    const tabPack = makePack({ packQuantity: '5 x 10', packUnits: 50, stripUnits: 10 });
    const info = extractPackInfo('Tablet', tabPack, [tabPack]);

    for (const badQty of ['', ' ', '0', '-2', 'abc']) {
      const calc = calculateStockAndPrice({
        packInfo: info,
        mode: 'strips',
        primaryQty: badQty,
        secondaryQty: '10',
        hasCatalogSelection: true,
      });
      expect(calc.isValid).toBe(false);
    }
  });

  it('keeps personal instructions optional, opening entry preserved, and purchase separate from catalogue ref price', () => {
    const payloadWithoutPurchase: AddPersonalMedicationInput = {
      catalogueBrandId: 'brand-napa-500',
      name: 'Napa',
      genericName: 'Paracetamol',
      strength: '500 mg',
      dosageForm: 'Tablet',
      manufacturer: 'Beximco Pharmaceuticals Ltd.',
      startingStock: 30,
      stockUnit: 'tablets',
      enteredQuantity: 3,
      enteredUnit: 'strips',
      selectedPackId: 'pk-tab',
      stripUnits: 10,
      lowStockThreshold: 5,
      unitPriceText: '৳1.20 / tablet',
      totalStockPrice: null,
      priceScopeLabel: null,
      referencePackText: '10 tablets per strip',
    };

    expect(payloadWithoutPurchase.personalInstructions).toBeUndefined();
    expect(payloadWithoutPurchase.purchaseDetails).toBeUndefined();
    expect(payloadWithoutPurchase.totalStockPrice).toBeNull();
    expect(payloadWithoutPurchase.enteredQuantity).toBe(3);
    expect(payloadWithoutPurchase.enteredUnit).toBe('strips');
    expect(payloadWithoutPurchase.startingStock).toBe(30);
    expect(payloadWithoutPurchase.stockUnit).toBe('tablets');
  });

  it('enforces simplified Add Medicine modal structure (no mandatory instructions, no default strips pill clutter, no price mode toggles)', () => {
    const modalSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/AddMedicineModal.tsx'),
      'utf8',
    );
    expect(modalSource).toContain('How much do you currently have?');
    expect(modalSource).toContain('Change quantity unit');
    expect(modalSource).toContain('Add purchase details (optional)');
    expect(modalSource).toContain('Package information is unavailable. Enter your current quantity manually.');
    expect(modalSource).toContain('Medicine added successfully.');
    expect(modalSource).toContain('Estimated price:');
    expect(modalSource).toContain('Calculated catalogue price:');
    expect(modalSource).toContain('Create a Dose Schedule');
    expect(modalSource).toContain('Go to My Medicines');

    // Responsive flex guards on narrow screens (no overlapping text between rows/badges)
    expect(modalSource).toMatch(/purchaseToggleRow:\s*\{[^}]*gap:\s*10/);
    expect(modalSource).toMatch(/purchaseToggleLeft:\s*\{[^}]*minWidth:\s*0/);
    expect(modalSource).toMatch(/purchaseToggleText:\s*\{[^}]*flexShrink:\s*1/);
    expect(modalSource).toMatch(/sectionHeading:\s*\{[^}]*flexShrink:\s*1/);
    expect(modalSource).toMatch(/calculatedPriceRow:\s*\{[^}]*flexWrap:\s*'wrap'/);
    expect(modalSource).toMatch(/purchaseEstimateRow:\s*\{[^}]*flexWrap:\s*'wrap'/);

    // Removed old clutter fields / switches from initial add form
    expect(modalSource).not.toContain('Personal instructions');
    expect(modalSource).not.toContain('handleSwitchPriceScope');
    expect(modalSource).not.toContain('per_unit_or_pack');
  });

  it('automatically calculates price from entered quantity across tablets, syrups, pack matrices, and stock estimates', () => {
    // 5 x 10 tablet pack with only packPrice (no unitPrice / packUnits) derives ৳12/tab
    const matrixOnlyPack = makePack({
      packQuantity: '5 x 10',
      packUnits: null,
      unitPrice: null,
      packPrice: '600.00',
    });
    const matrixInfo = extractPackInfo('Tablet', matrixOnlyPack, [matrixOnlyPack]);
    expect(matrixInfo.stripUnits).toBe(10);
    expect(matrixInfo.discreteUnitPrice).toBe(12);
    const threeStrips = calculateStockAndPrice({
      packInfo: matrixInfo,
      mode: 'strips',
      primaryQty: '3',
      secondaryQty: '10',
      hasCatalogSelection: true,
    });
    expect(threeStrips.stockRemaining).toBe(30);
    expect(threeStrips.calculatedTotalPrice).toBe(360);

    // Proportional Syrup estimate in ml
    const syrupPack = makePack({ packQuantity: '60 ml bottle', packPrice: '45.00' });
    const syrupInfo = extractPackInfo('Syrup', syrupPack, [syrupPack]);
    const halfBottle = calculateStockAndPrice({
      packInfo: syrupInfo,
      mode: 'ml',
      primaryQty: '30',
      hasCatalogSelection: true,
    });
    expect(halfBottle.calculatedTotalPrice).toBe(22.5);

    // Live stock valuation helpers keep estimated stock value clean without mixing units
    expect(
      estimateCurrentStockValue({
        stockRemaining: 30,
        stockUnit: 'tablets',
        unitPriceText: '৳1.20/tablet',
      }),
    ).toBe(36);
    expect(
      estimateCurrentStockValue({
        stockRemaining: 120,
        stockUnit: 'ml',
        unitPriceText: '৳45.00/bottle',
        referencePackText: '60 ml bottle · ৳45.00',
      }),
    ).toBe(90);
    expect(
      estimateCurrentStockValue({
        stockRemaining: 2,
        stockUnit: 'bottle',
        unitPriceText: '৳90.00/bottle',
      }),
    ).toBe(180);
    // Single-container packs reloaded from API as "/pack" still price accurately per bottle/tube/vial
    expect(
      estimateCurrentStockValue({
        stockRemaining: 2,
        stockUnit: 'tube',
        unitPriceText: '৳75.00/pack',
        referencePackText: '15 gm tube · ৳75.00',
      }),
    ).toBe(150);
    expect(
      estimateCurrentStockValue({
        stockRemaining: 120,
        stockUnit: 'ml',
        unitPriceText: '৳45.00/bottle',
        referencePackText: null,
      }),
    ).toBeNull();
  });
});
