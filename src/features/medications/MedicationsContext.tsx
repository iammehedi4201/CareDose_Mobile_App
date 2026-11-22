import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSavedAuthSession } from '../../api/config';
import {
  archivePatientMedication,
  createPatientMedication,
  listPatientMedications,
  restorePatientMedication,
  updatePatientMedication,
} from '../../api/medications';
import {
  inferStockUnit,
  INITIAL_PERSONAL_MEDS,
  mapApiMedicationToRecord,
  PersonalMedicationRecord,
} from './medication-helpers';

const STORAGE_KEY = 'caredose:personal-meds:v2';
const LEGACY_STORAGE_KEYS = ['caredose:personal-meds:v1'];

export interface AddPersonalMedicationInput {
  catalogueBrandId?: string | null;
  genericSourceId?: string | null;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  personalInstructions: string;
  startingStock: number;
  stockUnit?: string;
  stripUnits?: number | null;
  lowStockThreshold: number;
  unitPriceText?: string;
  totalStockPrice?: number | null;
  priceScopeLabel?: string | null;
  referencePackText?: string | null;
}

export interface UpdatePersonalMedicationInput {
  name?: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string;
  manufacturer?: string | null;
  instructions?: string;
  lowStockThreshold?: number;
  stockUnit?: string;
}

interface MedicationsContextValue {
  medications: PersonalMedicationRecord[];
  loading: boolean;
  getMedicationById: (id: string) => PersonalMedicationRecord | undefined;
  addMedication: (input: AddPersonalMedicationInput) => Promise<PersonalMedicationRecord>;
  updateMedication: (
    id: string,
    updates: UpdatePersonalMedicationInput,
  ) => Promise<PersonalMedicationRecord | null>;
  archiveMedication: (id: string) => Promise<void>;
  restoreMedication: (id: string) => Promise<void>;
  adjustMedicationStock: (
    id: string,
    mode: 'add' | 'set',
    quantity: number,
  ) => Promise<void>;
  refreshMedications: () => Promise<void>;
  resetDemoMedications: () => Promise<void>;
}

const MedicationsContext = createContext<MedicationsContextValue | null>(null);

export function MedicationsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [medications, setMedications] =
    useState<PersonalMedicationRecord[]>(INITIAL_PERSONAL_MEDS);
  const [loading, setLoading] = useState(true);

  const persistLocal = useCallback(async (next: PersonalMedicationRecord[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore non-fatal local storage errors
    }
  }, []);

  const refreshMedications = useCallback(async () => {
    setLoading(true);
    try {
      const session = await readSavedAuthSession();
      if (session) {
        try {
          const remote = await listPatientMedications(
            session.activePatientId,
            session.token,
            { status: 'ALL' },
          );
          const mapped = remote.map(mapApiMedicationToRecord);
          setMedications(mapped);
          await persistLocal(mapped);
          return;
        } catch {
          // Fall back cleanly to local storage when backend is offline
        }
      }

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersonalMedicationRecord[];
        if (Array.isArray(parsed)) {
          setMedications(parsed);
        }
      } else {
        await AsyncStorage.multiRemove(LEGACY_STORAGE_KEYS);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        setMedications([]);
      }
    } catch {
      // Retain default records on storage read failure
    } finally {
      setLoading(false);
    }
  }, [persistLocal]);

  useEffect(() => {
    void refreshMedications();
  }, [refreshMedications]);

  const getMedicationById = useCallback(
    (id: string) => medications.find((m) => m.id === id),
    [medications],
  );

  const addMedication = useCallback(
    async (input: AddPersonalMedicationInput): Promise<PersonalMedicationRecord> => {
      const form = input.dosageForm?.trim() || 'Tablet';
      const stockUnit = input.stockUnit?.trim() || inferStockUnit(form);
      const session = await readSavedAuthSession();

      if (session) {
        try {
          const created = await createPatientMedication(
            session.activePatientId,
            session.token,
            {
              catalogueBrandId: input.catalogueBrandId ?? undefined,
              name: input.name.trim(),
              genericName: input.genericName ?? undefined,
              strength: input.strength ?? undefined,
              dosageForm: form,
              manufacturer: input.manufacturer ?? undefined,
              personalInstructions: input.personalInstructions.trim(),
              startingStock: Math.max(0, input.startingStock),
              stockUnit,
              lowStockThreshold: Math.max(0, input.lowStockThreshold),
            },
          );
          const mapped = mapApiMedicationToRecord(created);
          const merged: PersonalMedicationRecord = {
            ...mapped,
            unitPriceText: input.unitPriceText ?? mapped.unitPriceText,
            totalStockPrice: input.totalStockPrice ?? null,
            priceScopeLabel: input.priceScopeLabel ?? null,
            referencePackText: input.referencePackText ?? mapped.referencePackText,
            stripUnits: input.stripUnits ?? mapped.stripUnits ?? null,
          };
          setMedications((prev) => {
            const next = [merged, ...prev];
            void persistLocal(next);
            return next;
          });
          return merged;
        } catch {
          // Proceed with local save when offline
        }
      }

      const localMed: PersonalMedicationRecord = {
        id: `m-${Date.now()}`,
        catalogueBrandId: input.catalogueBrandId ?? null,
        genericSourceId: input.genericSourceId ?? null,
        name: input.name.trim(),
        genericName: input.genericName ?? null,
        strength: input.strength?.trim() || null,
        dosageForm: form,
        manufacturer: input.manufacturer ?? null,
        instructions: input.personalInstructions.trim(),
        stockRemaining: Math.max(0, input.startingStock),
        stockUnit,
        stripUnits: input.stripUnits ?? null,
        unitPriceText: input.unitPriceText ?? 'Not listed',
        totalStockPrice: input.totalStockPrice ?? null,
        priceScopeLabel: input.priceScopeLabel ?? null,
        referencePackText: input.referencePackText ?? null,
        lowStockThreshold: Math.max(0, input.lowStockThreshold),
        archived: false,
      };

      setMedications((prev) => {
        const next = [localMed, ...prev];
        void persistLocal(next);
        return next;
      });
      return localMed;
    },
    [persistLocal],
  );

  const updateMedication = useCallback(
    async (
      id: string,
      updates: UpdatePersonalMedicationInput,
    ): Promise<PersonalMedicationRecord | null> => {
      const session = await readSavedAuthSession();
      if (session && /^[0-9a-f]{8}-/i.test(id)) {
        try {
          const updatedRemote = await updatePatientMedication(id, session.token, {
            name: updates.name,
            genericName: updates.genericName,
            strength: updates.strength,
            dosageForm: updates.dosageForm,
            manufacturer: updates.manufacturer,
            personalInstructions: updates.instructions,
            lowStockThreshold: updates.lowStockThreshold,
            stockUnit: updates.stockUnit,
          });
          const mapped = mapApiMedicationToRecord(updatedRemote);
          setMedications((prev) => {
            const next = prev.map((m) => (m.id === id ? mapped : m));
            void persistLocal(next);
            return next;
          });
          return mapped;
        } catch {
          // Update local record cleanly if offline
        }
      }

      let updatedItem: PersonalMedicationRecord | null = null;
      setMedications((prev) => {
        const next = prev.map((m) => {
          if (m.id !== id) return m;
          updatedItem = {
            ...m,
            name: updates.name?.trim() || m.name,
            genericName:
              updates.genericName !== undefined ? updates.genericName : m.genericName,
            strength: updates.strength !== undefined ? updates.strength : m.strength,
            dosageForm: updates.dosageForm?.trim() || m.dosageForm,
            manufacturer:
              updates.manufacturer !== undefined ? updates.manufacturer : m.manufacturer,
            instructions: updates.instructions?.trim() || m.instructions,
            lowStockThreshold:
              updates.lowStockThreshold !== undefined
                ? Math.max(0, updates.lowStockThreshold)
                : m.lowStockThreshold,
            stockUnit: updates.stockUnit?.trim() || m.stockUnit,
          };
          return updatedItem;
        });
        void persistLocal(next);
        return next;
      });
      return updatedItem;
    },
    [persistLocal],
  );

  const archiveMedication = useCallback(
    async (id: string) => {
      const session = await readSavedAuthSession();
      if (session && /^[0-9a-f]{8}-/i.test(id)) {
        try {
          await archivePatientMedication(id, session.token);
        } catch {
          // Local update still proceeds
        }
      }
      setMedications((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, archived: true } : m));
        void persistLocal(next);
        return next;
      });
    },
    [persistLocal],
  );

  const restoreMedication = useCallback(
    async (id: string) => {
      const session = await readSavedAuthSession();
      if (session && /^[0-9a-f]{8}-/i.test(id)) {
        try {
          await restorePatientMedication(id, session.token);
        } catch {
          // Local update still proceeds
        }
      }
      setMedications((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, archived: false } : m));
        void persistLocal(next);
        return next;
      });
    },
    [persistLocal],
  );

  const adjustMedicationStock = useCallback(
    async (id: string, mode: 'add' | 'set', quantity: number) => {
      setMedications((prev) => {
        const next = prev.map((m) => {
          if (m.id !== id) return m;
          const nextStock =
            mode === 'set' ? Math.max(0, quantity) : Math.max(0, m.stockRemaining + quantity);
          return { ...m, stockRemaining: Number(nextStock.toFixed(2)) };
        });
        void persistLocal(next);
        return next;
      });
    },
    [persistLocal],
  );

  const resetDemoMedications = useCallback(async () => {
    setMedications(INITIAL_PERSONAL_MEDS);
    await persistLocal(INITIAL_PERSONAL_MEDS);
  }, [persistLocal]);

  return (
    <MedicationsContext.Provider
      value={{
        medications,
        loading,
        getMedicationById,
        addMedication,
        updateMedication,
        archiveMedication,
        restoreMedication,
        adjustMedicationStock,
        refreshMedications,
        resetDemoMedications,
      }}
    >
      {children}
    </MedicationsContext.Provider>
  );
}

export function useMedications(): MedicationsContextValue {
  const ctx = useContext(MedicationsContext);
  if (!ctx) {
    throw new Error('useMedications must be used inside a MedicationsProvider.');
  }
  return ctx;
}
