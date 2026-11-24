import { describe, expect, it } from 'vitest';
import type { PurchaseItemDto } from '../../api/purchases';
import type { PersonalMedicationRecord } from '../medications/medication-helpers';
import type { LocalScheduleRecord } from '../schedule/dose-rules';
import {
  buildLocalExpensesSummary,
  buildLocalPurchaseFromInitialMedication,
  computeProjectedStockBalance,
  computePurchaseTotalUnits,
  computePurchaseUnitPrice,
  formatBdtAmount,
  getPurchaseRefillSuggestion,
  validatePurchaseDraft,
} from './expense-helpers';

describe('Phase 7 — Expense, purchase & stock calculation rules', () => {
  it('validates record purchase inputs strictly', () => {
    const invalid = validatePurchaseDraft({
      medicationId: '',
      purchaseDate: '24-11-2026',
      packCount: '0',
      unitsPerPack: '-5',
      amountPaid: '',
    });
    expect(invalid.valid).toBeNull();
    expect(Object.keys(invalid.errors)).toEqual(
      expect.arrayContaining([
        'medicationId',
        'purchaseDate',
        'packCount',
        'unitsPerPack',
        'amountPaid',
      ]),
    );

    const valid = validatePurchaseDraft({
      medicationId: 'm1',
      purchaseDate: '2026-11-24',
      packCount: '3',
      unitsPerPack: '10',
      amountPaid: '555',
      vendor: ' Lazz Pharma ',
    });
    expect(valid.errors).toEqual({});
    expect(valid.valid).toMatchObject({
      medicationId: 'm1',
      purchaseDate: '2026-11-24',
      packCount: 3,
      unitsPerPack: 10,
      totalUnitsAdded: 30,
      amountPaid: 555,
      vendor: 'Lazz Pharma',
    });
  });

  it('computes purchase totals, unit prices, and projected stock balance safely', () => {
    expect(computePurchaseTotalUnits(3, 10)).toBe(30);
    expect(computePurchaseUnitPrice(555, 30)).toBe(18.5);
    expect(computePurchaseUnitPrice(100, 0)).toBeNull();

    expect(computeProjectedStockBalance(24, 'ADD', '10')).toEqual({
      nextBalance: 34,
      quantityValue: 10,
      error: null,
    });
    expect(computeProjectedStockBalance(24, 'SET', '0')).toEqual({
      nextBalance: 0,
      quantityValue: 0,
      error: null,
    });
    expect(computeProjectedStockBalance(5, 'DEDUCT', '7').error).toContain('exceeds');
    expect(formatBdtAmount(720)).toBe('৳720');
    expect(formatBdtAmount('555.50')).toBe('৳555.50');
  });

  it('separates actual monthly spending from estimated cost and flags unknown prices', () => {
    const medications: PersonalMedicationRecord[] = [
      {
        id: 'm1',
        name: 'Corvalen 5 mg',
        strength: '5 mg',
        dosageForm: 'Tablet',
        instructions: 'After breakfast',
        stockRemaining: 24,
        stockUnit: 'tablets',
        unitPriceText: '৳18.50/unit',
        lowStockThreshold: 5,
        archived: false,
      },
      {
        id: 'm2',
        name: 'Napa Extra',
        strength: '500 mg',
        dosageForm: 'Tablet',
        instructions: 'If fever',
        stockRemaining: 10,
        stockUnit: 'tablets',
        unitPriceText: 'Not listed',
        lowStockThreshold: 5,
        archived: false,
      },
    ];

    const schedules: LocalScheduleRecord[] = [
      {
        id: 's1',
        patientMedicationId: 'm1',
        doseAmount: 1,
        doseUnit: 'tablet',
        frequency: 'DAILY',
        scheduledTimes: ['09:00'],
        startDateYmd: '2026-11-01',
        endDateYmd: null,
        instructions: null,
        remindersEnabled: true,
        status: 'ACTIVE',
      },
      {
        id: 's2',
        patientMedicationId: 'm2',
        doseAmount: 1,
        doseUnit: 'tablet',
        frequency: 'DAILY',
        scheduledTimes: ['09:00'],
        startDateYmd: '2026-11-01',
        endDateYmd: null,
        instructions: null,
        remindersEnabled: true,
        status: 'ACTIVE',
      },
    ];

    const purchases: PurchaseItemDto[] = [
      {
        id: 'p1',
        patientId: 'local-patient',
        patientMedicationId: 'm1',
        purchaseDate: '2026-11-10T12:00:00.000Z',
        purchaseDateYmd: '2026-11-10',
        packCount: 1,
        unitsPerPack: '30.00',
        totalUnitsAdded: '30.00',
        amountPaid: '555.00',
        unitPrice: '18.50',
        currency: 'BDT',
        vendor: 'Lazz Pharma',
        note: null,
        createdAt: '2026-11-10T12:00:00.000Z',
        medication: {
          id: 'm1',
          name: 'Corvalen 5 mg',
          strength: '5 mg',
          dosageForm: 'Tablet',
          stockUnit: 'tablets',
        },
      },
    ];

    const summary = buildLocalExpensesSummary({
      purchases,
      medications,
      schedules,
      selectedMonth: '2026-11',
      monthlyBudget: 2500,
      monthsCount: 4,
      todayYmd: '2026-11-24',
    });

    expect(summary.actualSpent).toBe('555.00');
    expect(summary.budgetRemaining).toBe('1945.00');
    expect(summary.estimatedMonthlyCost.hasEstimate).toBe(true);
    expect(summary.estimatedMonthlyCost.totalEstimatedCost).toBe('555.00');
    expect(summary.estimatedMonthlyCost.includedCount).toBe(1);
    expect(summary.estimatedMonthlyCost.excludedCount).toBe(1);
    expect(summary.estimatedMonthlyCost.excludedItems[0].medicationId).toBe('m2');
  });

  it('builds local initial purchase from Add Medicine and extracts smart refill suggestions', () => {
    const newMed: PersonalMedicationRecord = {
      id: 'm-local-1',
      name: 'Napa',
      strength: '500 mg',
      dosageForm: 'Tablet',
      instructions: '',
      stockRemaining: 30,
      stockUnit: 'tablets',
      unitPriceText: '৳1.20/tablet',
      lowStockThreshold: 5,
      archived: false,
    };

    const initialPurchase = buildLocalPurchaseFromInitialMedication({
      medication: newMed,
      enteredQuantity: 3,
      todayYmd: '2026-11-24',
      purchaseDetails: {
        amountPaid: 36,
        purchaseDate: '2026-11-24',
        packCount: 3,
        unitsPerPack: 10,
        vendor: ' Lazz Pharma ',
      },
    });

    expect(initialPurchase.patientMedicationId).toBe('m-local-1');
    expect(initialPurchase.packCount).toBe(3);
    expect(initialPurchase.unitsPerPack).toBe('10.00');
    expect(initialPurchase.totalUnitsAdded).toBe('30.00');
    expect(initialPurchase.amountPaid).toBe('36.00');
    expect(initialPurchase.unitPrice).toBe('1.20');
    expect(initialPurchase.vendor).toBe('Lazz Pharma');

    const newerPurchase: PurchaseItemDto = {
      ...initialPurchase,
      id: 'pur-2',
      purchaseDate: '2026-11-26T12:00:00.000Z',
      purchaseDateYmd: '2026-11-26',
      packCount: 2,
      unitsPerPack: '10.00',
      totalUnitsAdded: '20.00',
      amountPaid: '24.00',
      vendor: 'Tamanna Pharmacy',
      createdAt: '2026-11-26T12:00:00.000Z',
    };

    const otherMedPurchase: PurchaseItemDto = {
      ...initialPurchase,
      id: 'pur-other',
      patientMedicationId: 'm-other',
      vendor: 'Model Pharmacy',
      purchaseDateYmd: '2026-11-25',
    };

    const suggestion = getPurchaseRefillSuggestion(
      [initialPurchase, otherMedPurchase, newerPurchase],
      'm-local-1',
    );
    expect(suggestion).toEqual({
      lastVendor: 'Tamanna Pharmacy',
      recentVendors: ['Tamanna Pharmacy', 'Lazz Pharma', 'Model Pharmacy'],
      lastUnitsPerPack: 10,
      lastPackCount: 2,
      lastAmountPaid: 24,
      lastPurchaseDateYmd: '2026-11-26',
    });

    const summary = buildLocalExpensesSummary({
      purchases: [initialPurchase, newerPurchase],
      medications: [newMed],
      schedules: [],
      selectedMonth: '2026-11',
      monthlyBudget: 2500,
      monthsCount: 3,
      todayYmd: '2026-11-26',
    });
    expect(summary.actualSpent).toBe('60.00');
    expect(summary.recentPurchases).toHaveLength(2);
  });
});
