import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiRequestError, readSavedAuthSession } from '../../api/config';
import {
  ExpensesSummaryResponseDto,
  getPatientExpensesSummary,
} from '../../api/expenses';
import {
  listPatientPurchases,
  PurchaseItemDto,
  recordMedicationPurchase,
} from '../../api/purchases';
import { updateCurrentUserSettings } from '../../api/users';
import { useMedications } from '../medications/MedicationsContext';
import { useSchedules } from '../schedule/SchedulesContext';
import {
  buildLocalExpensesSummary,
  computePurchaseUnitPrice,
  getCurrentMonthYm,
  PURCHASES_STORAGE_KEY,
  ValidatedPurchaseInput,
} from './expense-helpers';

const BUDGET_STORAGE_KEY = 'caredose:monthly-budget:v1';
const UUID_PREFIX_RE = /^[0-9a-f]{8}-/i;

export interface RecordPurchaseOutcome {
  purchase: PurchaseItemDto;
  newStockRemaining: number;
  syncedRemote: boolean;
}

interface PurchasesContextValue {
  purchases: PurchaseItemDto[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  expensesSummary: ExpensesSummaryResponseDto;
  monthlyBudget: number | null;
  loading: boolean;
  error: string | null;
  refreshPurchasesAndExpenses: (month?: string) => Promise<void>;
  recordPurchase: (input: ValidatedPurchaseInput) => Promise<RecordPurchaseOutcome>;
  updateMonthlyBudget: (budget: number | null) => Promise<void>;
  getPurchasesForMedication: (medicationId: string) => PurchaseItemDto[];
  resetDemoPurchases: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

export function PurchasesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { medications, getMedicationById, adjustMedicationStock } = useMedications();
  const { schedules } = useSchedules();

  const [localPurchases, setLocalPurchases] = useState<PurchaseItemDto[]>([]);
  const [remotePurchases, setRemotePurchases] = useState<PurchaseItemDto[] | null>(null);
  const [remoteExpenses, setRemoteExpenses] = useState<ExpensesSummaryResponseDto | null>(null);
  const [localMonthlyBudget, setLocalMonthlyBudget] = useState<number | null>(2500);
  const [selectedMonth, setSelectedMonthState] = useState<string>(() => getCurrentMonthYm());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistLocalPurchases = useCallback(async (next: PurchaseItemDto[]) => {
    try {
      await AsyncStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  }, []);

  const persistLocalBudget = useCallback(async (budget: number | null) => {
    try {
      await AsyncStorage.setItem(
        BUDGET_STORAGE_KEY,
        JSON.stringify(budget === null ? null : Number(budget.toFixed(2))),
      );
    } catch {
      // Ignore storage error
    }
  }, []);

  const refreshPurchasesAndExpenses = useCallback(
    async (monthOverride?: string) => {
      const targetMonth = monthOverride ?? selectedMonth;
      setLoading(true);
      setError(null);
      try {
        const [rawLocal, rawBudget, session] = await Promise.all([
          AsyncStorage.getItem(PURCHASES_STORAGE_KEY),
          AsyncStorage.getItem(BUDGET_STORAGE_KEY),
          readSavedAuthSession(),
        ]);

        if (rawLocal) {
          const parsed = JSON.parse(rawLocal) as PurchaseItemDto[];
          if (Array.isArray(parsed)) {
            setLocalPurchases(parsed);
          }
        }

        if (rawBudget !== null) {
          const parsedBudget = JSON.parse(rawBudget) as number | null;
          if (parsedBudget === null || (typeof parsedBudget === 'number' && Number.isFinite(parsedBudget))) {
            setLocalMonthlyBudget(parsedBudget);
          }
        }

        if (session) {
          try {
            const [purchaseListRes, expensesRes] = await Promise.all([
              listPatientPurchases(session.activePatientId, session.token, { limit: 100 }),
              getPatientExpensesSummary(session.activePatientId, session.token, {
                month: targetMonth,
                monthsCount: 6,
              }),
            ]);
            setRemotePurchases(purchaseListRes.items);
            setRemoteExpenses(expensesRes);
            if (expensesRes.monthlyBudget !== null) {
              setLocalMonthlyBudget(Number(expensesRes.monthlyBudget));
            }
          } catch (err) {
            setRemotePurchases(null);
            setRemoteExpenses(null);
            if (err instanceof ApiRequestError && !err.isNetworkError) {
              setError(err.message);
            }
          }
        } else {
          setRemotePurchases(null);
          setRemoteExpenses(null);
        }
      } catch {
        setError('Unable to load purchase and expense records.');
      } finally {
        setLoading(false);
      }
    },
    [selectedMonth],
  );

  useEffect(() => {
    void refreshPurchasesAndExpenses(selectedMonth);
  }, [refreshPurchasesAndExpenses, selectedMonth, medications.length]);

  const setSelectedMonth = useCallback((month: string) => {
    setSelectedMonthState(month);
  }, []);

  const purchases = useMemo(
    () => remotePurchases ?? localPurchases,
    [remotePurchases, localPurchases],
  );

  const expensesSummary = useMemo<ExpensesSummaryResponseDto>(() => {
    if (remoteExpenses && remoteExpenses.selectedMonth === selectedMonth) {
      return remoteExpenses;
    }
    return buildLocalExpensesSummary({
      purchases,
      medications,
      schedules,
      selectedMonth,
      monthlyBudget: localMonthlyBudget,
      monthsCount: 6,
    });
  }, [
    remoteExpenses,
    selectedMonth,
    purchases,
    medications,
    schedules,
    localMonthlyBudget,
  ]);

  const recordPurchase = useCallback(
    async (input: ValidatedPurchaseInput): Promise<RecordPurchaseOutcome> => {
      const med = getMedicationById(input.medicationId);
      const session = await readSavedAuthSession();

      if (session && UUID_PREFIX_RE.test(input.medicationId)) {
        try {
          const result = await recordMedicationPurchase(
            input.medicationId,
            session.token,
            {
              purchaseDate: input.purchaseDate,
              packCount: input.packCount,
              unitsPerPack: input.unitsPerPack,
              amountPaid: input.amountPaid,
              vendor: input.vendor,
              note: input.note,
            },
          );
          const nextStock = Number(result.newStockRemaining);
          await adjustMedicationStock(input.medicationId, 'set', nextStock, {
            syncRemote: false,
          });
          setRemotePurchases((prev) => {
            const base = prev ?? [];
            return [result.purchase, ...base.filter((p) => p.id !== result.purchase.id)];
          });
          await refreshPurchasesAndExpenses(selectedMonth);
          return {
            purchase: result.purchase,
            newStockRemaining: nextStock,
            syncedRemote: true,
          };
        } catch (err) {
          if (err instanceof ApiRequestError && !err.isNetworkError) {
            throw err;
          }
        }
      }

      const nowIso = new Date().toISOString();
      const unitPriceVal = computePurchaseUnitPrice(
        input.amountPaid,
        input.totalUnitsAdded,
      );
      const localItem: PurchaseItemDto = {
        id: `pur-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        patientId: 'local-patient',
        patientMedicationId: input.medicationId,
        purchaseDate: `${input.purchaseDate}T12:00:00.000Z`,
        purchaseDateYmd: input.purchaseDate,
        packCount: input.packCount,
        unitsPerPack: input.unitsPerPack.toFixed(2),
        totalUnitsAdded: input.totalUnitsAdded.toFixed(2),
        amountPaid: input.amountPaid.toFixed(2),
        unitPrice: unitPriceVal !== null ? unitPriceVal.toFixed(2) : null,
        currency: 'BDT',
        vendor: input.vendor ?? null,
        note: input.note ?? null,
        createdAt: nowIso,
        medication: med
          ? {
              id: med.id,
              name: med.name,
              strength: med.strength ?? null,
              dosageForm: med.dosageForm,
              stockUnit: med.stockUnit,
            }
          : null,
      };

      const nextStock = Number(
        ((med?.stockRemaining ?? 0) + input.totalUnitsAdded).toFixed(2),
      );
      await adjustMedicationStock(input.medicationId, 'add', input.totalUnitsAdded, {
        syncRemote: false,
      });

      setLocalPurchases((prev) => {
        const next = [localItem, ...prev];
        void persistLocalPurchases(next);
        return next;
      });
      setRemotePurchases(null);
      setRemoteExpenses(null);

      return {
        purchase: localItem,
        newStockRemaining: nextStock,
        syncedRemote: false,
      };
    },
    [
      adjustMedicationStock,
      getMedicationById,
      persistLocalPurchases,
      refreshPurchasesAndExpenses,
      selectedMonth,
    ],
  );

  const updateMonthlyBudget = useCallback(
    async (budget: number | null) => {
      const normalized = budget === null ? null : Math.max(0, Number(budget.toFixed(2)));
      const session = await readSavedAuthSession();
      if (session) {
        try {
          await updateCurrentUserSettings(session.token, {
            monthlyBudget: normalized,
          });
        } catch (err) {
          if (err instanceof ApiRequestError && !err.isNetworkError) {
            throw err;
          }
        }
      }
      setLocalMonthlyBudget(normalized);
      await persistLocalBudget(normalized);
      await refreshPurchasesAndExpenses(selectedMonth);
    },
    [persistLocalBudget, refreshPurchasesAndExpenses, selectedMonth],
  );

  const getPurchasesForMedication = useCallback(
    (medicationId: string) =>
      purchases.filter((p) => p.patientMedicationId === medicationId),
    [purchases],
  );

  const resetDemoPurchases = useCallback(async () => {
    setLocalPurchases([]);
    setLocalMonthlyBudget(2500);
    setRemotePurchases(null);
    setRemoteExpenses(null);
    await Promise.all([
      persistLocalPurchases([]),
      persistLocalBudget(2500),
    ]);
  }, [persistLocalBudget, persistLocalPurchases]);

  return (
    <PurchasesContext.Provider
      value={{
        purchases,
        selectedMonth,
        setSelectedMonth,
        expensesSummary,
        monthlyBudget:
          remoteExpenses?.monthlyBudget !== undefined
            ? remoteExpenses.monthlyBudget !== null
              ? Number(remoteExpenses.monthlyBudget)
              : null
            : localMonthlyBudget,
        loading,
        error,
        refreshPurchasesAndExpenses,
        recordPurchase,
        updateMonthlyBudget,
        getPurchasesForMedication,
        resetDemoPurchases,
      }}
    >
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases(): PurchasesContextValue {
  const ctx = useContext(PurchasesContext);
  if (!ctx) {
    throw new Error('usePurchases must be used inside a PurchasesProvider.');
  }
  return ctx;
}
