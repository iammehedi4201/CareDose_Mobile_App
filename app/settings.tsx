import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import settingsHeaderImage from '../assets/settings-header-illustration.jpg';
import { clearCatalogueClientCache, getCatalogueSqliteStats } from '../src/api/catalogue';
import { readSavedAuthSession } from '../src/api/config';
import {
  AccountBackupDocumentDto,
  deleteUserAccount,
  exportAccountBackup,
  restoreAccountBackup,
} from '../src/api/users';
import {
  BottomSheet,
  ConfirmDialog,
  DestructiveButton,
  FormCol,
  FormField,
  FormRow,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SelectField,
  SuccessToast,
  ToggleField,
  useScreenWaveHeader,
} from '../src/components';
import {
  applyBackupDocumentToLocalStorage,
  buildLocalCareDoseBackupDocument,
  parseAndValidateCareDoseBackupJson,
  wipeAllLocalCareDoseData,
} from '../src/features/backup/backup-helpers';
import { usePurchases } from '../src/features/expenses/PurchasesContext';
import {
  DEFAULT_USER_PREFERENCES,
  formatGlucoseUnitLabel,
  normalizeGlucoseUnit,
  REMINDER_LEAD_TIME_OPTIONS,
} from '../src/features/health/health-helpers';
import { useHealthLogs } from '../src/features/health/HealthLogsContext';
import { useMedications } from '../src/features/medications/MedicationsContext';
import { useUserPreferences } from '../src/features/profile/UserPreferencesContext';
import { getTodayLocalYmd } from '../src/features/schedule/dose-rules';
import {
  checkDeviceNotificationSupport,
  NotificationCapabilityState,
  openDeviceNotificationSettings,
  requestDeviceNotificationPermission,
  sendTestDoseNotification,
} from '../src/features/schedule/notifications';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

const INITIAL_NOTIF_CAP: NotificationCapabilityState = {
  supported: false,
  granted: false,
  canAskAgain: false,
  permissionStatus: 'unsupported',
  soundPermitted: false,
  statusText: 'Checking device notification status...',
};

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const {
    medications,
    refreshMedications,
    resetDemoMedications,
  } = useMedications();
  const {
    schedules,
    doseEvents,
    refreshSchedules,
    resetDemoSchedules,
  } = useSchedules();
  const {
    readings,
    refreshHealthLogs,
    resetDemoHealthReadings,
  } = useHealthLogs();
  const {
    purchases,
    monthlyBudget: savedBudget,
    updateMonthlyBudget,
    refreshPurchasesAndExpenses,
    resetDemoPurchases,
  } = usePurchases();
  const {
    preferences,
    saving,
    refreshPreferences,
    updatePreferences,
    resetDemoPreferences,
    clearAuthSessionAndReset,
  } = useUserPreferences();

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    preferences.remindersEnabled,
  );
  const [soundEnabled, setSoundEnabled] = useState(preferences.soundEnabled);
  const [leadTime, setLeadTime] = useState(String(preferences.reminderLeadMins));
  const [hideMedicineNames, setHideMedicineNames] = useState(
    preferences.hideMedicineInNotifications,
  );
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>(
    formatGlucoseUnitLabel(preferences.glucoseUnit),
  );
  const [monthlyBudget, setMonthlyBudget] = useState(
    preferences.monthlyBudget !== null
      ? String(preferences.monthlyBudget)
      : savedBudget !== null
        ? String(savedBudget)
        : '2500',
  );
  const [displayName, setDisplayName] = useState(preferences.displayName);
  const [notifCap, setNotifCap] =
    useState<NotificationCapabilityState>(INITIAL_NOTIF_CAP);
  const [testingNotif, setTestingNotif] = useState(false);

  const [sqliteStats, setSqliteStats] = useState<{
    cachedEntriesCount: number;
    cachedBrandsCount: number;
    lastUpdatedAt: string | null;
  }>({
    cachedEntriesCount: 0,
    cachedBrandsCount: 0,
    lastUpdatedAt: null,
  });

  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportJsonText, setExportJsonText] = useState('');
  const [exportDoc, setExportDoc] = useState<AccountBackupDocumentDto | null>(null);
  const [exporting, setExporting] = useState(false);

  const [restoreSheetOpen, setRestoreSheetOpen] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingRestoreDoc, setPendingRestoreDoc] =
    useState<AccountBackupDocumentDto | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const refreshSystemDiagnostics = useCallback(async () => {
    const [cap, stats] = await Promise.all([
      checkDeviceNotificationSupport(),
      getCatalogueSqliteStats(),
    ]);
    setNotifCap(cap);
    setSqliteStats(stats);
  }, []);

  useEffect(() => {
    void refreshSystemDiagnostics();
  }, [refreshSystemDiagnostics]);

  useEffect(() => {
    setNotificationsEnabled(preferences.remindersEnabled);
    setSoundEnabled(preferences.soundEnabled);
    setLeadTime(String(preferences.reminderLeadMins));
    setHideMedicineNames(preferences.hideMedicineInNotifications);
    setGlucoseUnit(formatGlucoseUnitLabel(preferences.glucoseUnit));
    const resolvedBudget =
      preferences.monthlyBudget !== null ? preferences.monthlyBudget : savedBudget;
    setMonthlyBudget(resolvedBudget !== null ? String(resolvedBudget) : '');
    setDisplayName(preferences.displayName);
  }, [preferences, savedBudget]);

  const handleRequestNotifications = async (): Promise<void> => {
    const nextCap = await requestDeviceNotificationPermission();
    setNotifCap(nextCap);
    setToast(nextCap.statusText);
  };

  const handleSendTestNotification = async (): Promise<void> => {
    if (testingNotif) return;
    setTestingNotif(true);
    try {
      const res = await sendTestDoseNotification({
        soundEnabled,
        hideMedicineDetails: hideMedicineNames,
      });
      setNotifCap(res.capability);
      setToast(res.message);
    } finally {
      setTestingNotif(false);
    }
  };

  const handleClearOfflineCache = async (): Promise<void> => {
    await clearCatalogueClientCache({ includeSqlite: true });
    const nextStats = await getCatalogueSqliteStats();
    setSqliteStats(nextStats);
    setToast('Offline catalogue cache cleared.');
  };

  const handleSaveSettings = async (): Promise<void> => {
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > 80) {
      setToast('Enter a display name between 1 and 80 characters.');
      return;
    }

    const trimmedBudget = monthlyBudget.trim();
    const parsedBudget =
      trimmedBudget.length === 0 ? null : Number(trimmedBudget);
    if (
      parsedBudget !== null &&
      (!Number.isFinite(parsedBudget) || parsedBudget < 0)
    ) {
      setToast('Enter a valid non-negative monthly budget.');
      return;
    }

    const parsedLeadMins = Number(leadTime);
    const safeLeadMins =
      Number.isInteger(parsedLeadMins) && parsedLeadMins >= 0 && parsedLeadMins <= 120
        ? parsedLeadMins
        : 10;

    try {
      await Promise.all([
        updatePreferences({
          displayName: trimmedName,
          glucoseUnit: normalizeGlucoseUnit(glucoseUnit),
          remindersEnabled: notificationsEnabled,
          soundEnabled,
          reminderLeadMins: safeLeadMins,
          hideMedicineInNotifications: hideMedicineNames,
          monthlyBudget: parsedBudget,
        }),
        updateMonthlyBudget(parsedBudget),
      ]);
      setToast('Care preferences saved.');
    } catch (err) {
      setToast(
        err instanceof Error ? err.message : 'Unable to save settings right now.',
      );
    }
  };

  const handleGenerateExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    try {
      const session = await readSavedAuthSession();
      let doc: AccountBackupDocumentDto | null = null;
      if (session) {
        try {
          doc = await exportAccountBackup(session.token);
        } catch {
          // Fall back to local backup export when backend is unavailable
        }
      }
      if (!doc) {
        doc = buildLocalCareDoseBackupDocument({
          preferences,
          medications,
          schedules,
          doseEvents,
          purchases,
          readings,
        });
      }
      setExportDoc(doc);
      setExportJsonText(JSON.stringify(doc, null, 2));
      setExportSheetOpen(true);
    } finally {
      setExporting(false);
    }
  };

  const handleShareOrDownloadBackup = async (): Promise<void> => {
    if (!exportJsonText) return;
    if (
      Platform.OS === 'web' &&
      typeof document !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined'
    ) {
      try {
        const blob = new Blob([exportJsonText], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `caredose-backup-${getTodayLocalYmd()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
        setToast('Downloaded CareDose JSON backup.');
        return;
      } catch {
        // Fall through to Share API
      }
    }

    try {
      await Share.share({
        title: `CareDose Backup (${getTodayLocalYmd()})`,
        message: exportJsonText,
      });
      setToast('Backup ready to save or share.');
    } catch {
      setToast('Copy the JSON text above to save your backup safely.');
    }
  };

  const handleValidateRestore = (): void => {
    const res = parseAndValidateCareDoseBackupJson(restoreJsonInput);
    if (!res.valid) {
      setPendingRestoreDoc(null);
      setRestoreError(res.error);
      return;
    }
    setRestoreError(null);
    setPendingRestoreDoc(res.document);
    setRestoreConfirmOpen(true);
  };

  const handleConfirmRestore = async (): Promise<void> => {
    if (!pendingRestoreDoc || restoring) return;
    setRestoring(true);
    try {
      const session = await readSavedAuthSession();
      if (session) {
        await restoreAccountBackup(session.token, pendingRestoreDoc);
      }
      await applyBackupDocumentToLocalStorage(pendingRestoreDoc);
      await Promise.all([
        refreshPreferences(),
        refreshMedications(),
        refreshSchedules(),
        refreshPurchasesAndExpenses(),
        refreshHealthLogs(),
      ]);
      setRestoreConfirmOpen(false);
      setRestoreSheetOpen(false);
      setRestoreJsonInput('');
      setPendingRestoreDoc(null);
      setToast(
        `Restored ${pendingRestoreDoc.summary.medicationsCount} medicines and ${pendingRestoreDoc.summary.healthReadingsCount} health readings.`,
      );
    } catch (err) {
      setRestoreConfirmOpen(false);
      setRestoreError(
        err instanceof Error ? err.message : 'Unable to restore backup right now.',
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleConfirmResetDemo = async (): Promise<void> => {
    setNotificationsEnabled(DEFAULT_USER_PREFERENCES.remindersEnabled);
    setSoundEnabled(DEFAULT_USER_PREFERENCES.soundEnabled);
    setLeadTime(String(DEFAULT_USER_PREFERENCES.reminderLeadMins));
    setHideMedicineNames(DEFAULT_USER_PREFERENCES.hideMedicineInNotifications);
    setGlucoseUnit(formatGlucoseUnitLabel(DEFAULT_USER_PREFERENCES.glucoseUnit));
    setMonthlyBudget(String(DEFAULT_USER_PREFERENCES.monthlyBudget ?? 2500));
    setDisplayName(DEFAULT_USER_PREFERENCES.displayName);
    await Promise.all([
      resetDemoMedications(),
      resetDemoSchedules(),
      resetDemoPurchases(),
      resetDemoHealthReadings(),
      resetDemoPreferences(),
    ]);
    setResetConfirmOpen(false);
    setToast('Fictional demo data restored to defaults.');
  };

  const handleConfirmDeleteAccount = async (): Promise<void> => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Type DELETE in capital letters to confirm permanent removal.');
      return;
    }
    if (deletingAccount) return;

    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const session = await readSavedAuthSession();
      if (session) {
        await deleteUserAccount(session.token, 'DELETE');
      }
      await wipeAllLocalCareDoseData();
      await clearAuthSessionAndReset();
      await Promise.all([
        refreshPreferences(),
        refreshMedications(),
        refreshSchedules(),
        refreshPurchasesAndExpenses(),
        refreshHealthLogs(),
      ]);
      setDeleteSheetOpen(false);
      setDeleteConfirmText('');
      setToast('Account and personal tracking data permanently deleted.');
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Unable to delete account right now. Please try again.',
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    eyebrow: 'PREFERENCES',
    title: 'Settings',
    imageSource: settingsHeaderImage,
    onBack: () => router.push('/profile'),
  });

  return (
    <ScreenContainer
      title="Settings"
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      <SuccessToast message={toast} />

      {/* Reminders & Device Permissions floating over header wave */}
      <View
        style={{ marginTop: -overlapPx }}
        className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm"
      >
        <View className="flex-row items-center justify-between gap-2 mb-2">
          <Text className="text-[15px] font-semibold text-main">Reminders</Text>
          <View
            className={`rounded-full border px-2.5 py-0.5 ${
              notifCap.granted
                ? 'border-[#C5E8D8] bg-mint'
                : notifCap.permissionStatus === 'denied'
                  ? 'border-[#F3C1BE] bg-[#FDECEC]'
                  : 'border-border bg-background'
            }`}
          >
            <Text
              className={`text-[10px] font-bold ${
                notifCap.granted
                  ? 'text-primary'
                  : notifCap.permissionStatus === 'denied'
                    ? 'text-error'
                    : 'text-[#5A706B]'
              }`}
            >
              {notifCap.granted
                ? 'Permission granted'
                : notifCap.permissionStatus === 'denied'
                  ? 'Permission denied'
                  : notifCap.supported
                    ? 'Permission needed'
                    : 'Web / unsupported'}
            </Text>
          </View>
        </View>

        <View className="mb-2.5 rounded-field border border-border bg-background p-3">
          <Text className="text-xs leading-[17px] text-[#5A706B]">
            {notifCap.statusText} Reminders alert you at dose time and never automatically mark a medicine Taken.
          </Text>
          {notifCap.supported && !notifCap.granted ? (
            <View className="mt-2.5 flex-row flex-wrap gap-2">
              {notifCap.canAskAgain ? (
                <SecondaryButton
                  compact
                  label="Allow notifications"
                  onPress={() => void handleRequestNotifications()}
                />
              ) : null}
              <SecondaryButton
                compact
                label="Open Notification Settings"
                onPress={() => void openDeviceNotificationSettings()}
              />
            </View>
          ) : null}
        </View>

        <ToggleField
          label="Notifications"
          description="Master switch for scheduled medication alerts"
          value={notificationsEnabled}
          onValueChange={(next) => {
            setNotificationsEnabled(next);
            void updatePreferences({ remindersEnabled: next });
          }}
        />
        <ToggleField
          label="Reminder sound"
          description="Plays notification sound when supported by device & channel"
          value={soundEnabled}
          onValueChange={(next) => {
            setSoundEnabled(next);
            void updatePreferences({ soundEnabled: next });
          }}
        />
        <ToggleField
          label="Hide medicine names in alerts"
          description="Show generic dose reminders on lock screens for privacy"
          value={hideMedicineNames}
          onValueChange={(next) => {
            setHideMedicineNames(next);
            void updatePreferences({ hideMedicineInNotifications: next });
          }}
        />
        <SelectField
          label="Reminder lead time"
          value={leadTime}
          options={REMINDER_LEAD_TIME_OPTIONS}
          onSelect={(next) => {
            setLeadTime(next);
            const mins = Number(next);
            if (Number.isInteger(mins)) {
              void updatePreferences({ reminderLeadMins: mins });
            }
          }}
        />

        <View className="mt-2 flex-row flex-wrap gap-2">
          <View className="flex-1 min-w-[140px]">
            <SecondaryButton
              fullWidth
              label="Send test notification"
              loading={testingNotif}
              onPress={() => void handleSendTestNotification()}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage per-schedule reminders"
            onPress={() => router.push('/schedules')}
            className="min-h-[44px] flex-row items-center justify-center rounded-button border border-border bg-background px-3.5"
          >
            <Feather name="sliders" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text className="ml-1.5 text-xs font-semibold text-primary">
              Schedule list
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Units & Profile */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <Text className="text-[15px] font-semibold text-main mb-2">Units & Profile</Text>
        <SelectField
          label="Glucose unit"
          value={glucoseUnit}
          options={[
            { label: 'mg/dL', value: 'mg/dL' },
            { label: 'mmol/L', value: 'mmol/L' },
          ]}
          onSelect={(next) => {
            const label = next === 'mmol/L' ? 'mmol/L' : 'mg/dL';
            setGlucoseUnit(label);
            void updatePreferences({ glucoseUnit: normalizeGlucoseUnit(label) });
          }}
        />
        <FormField
          label="Currency"
          value="Taka (৳ BDT)"
          onChangeText={() => undefined}
          editable={false}
        />
        <FormField
          label="Monthly medicine budget (৳ BDT)"
          value={monthlyBudget}
          onChangeText={setMonthlyBudget}
          keyboardType="numeric"
        />
        <FormField
          label="Your name"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <PrimaryButton
          fullWidth
          label="Save settings"
          loading={saving}
          onPress={() => void handleSaveSettings()}
        />
      </View>

      {/* SQLite Offline Catalogue Cache */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <Text className="text-[15px] font-semibold text-main">
          Offline Catalogue Cache
        </Text>
        <Text className="mt-1 text-xs leading-[17px] text-[#5A706B]">
          {Platform.OS === 'web'
            ? 'Web uses bounded in-memory search caching; native Android & iOS store browsed medicines in SQLite for offline lookup.'
            : `${sqliteStats.cachedBrandsCount} medicines · ${sqliteStats.cachedEntriesCount} search responses stored in SQLite for offline browsing.`}
        </Text>
        <View className="mt-3">
          <SecondaryButton
            fullWidth
            label="Clear offline cache"
            onPress={() => void handleClearOfflineCache()}
          />
        </View>
      </View>

      {/* Backup Export & Restore */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <Text className="text-[15px] font-semibold text-main">
          Data Export & Backup
        </Text>
        <Text className="mt-1 text-xs leading-[17px] text-[#5A706B]">
          Export your medicines, schedules, dose history, purchases, and health readings as a portable JSON backup or restore a previous file.
        </Text>
        <View className="mt-3">
          <FormRow>
            <FormCol>
              <SecondaryButton
                fullWidth
                label="Export backup"
                loading={exporting}
                onPress={() => void handleGenerateExport()}
              />
            </FormCol>
            <FormCol>
              <SecondaryButton
                fullWidth
                label="Restore backup"
                onPress={() => {
                  setRestoreError(null);
                  setPendingRestoreDoc(null);
                  setRestoreSheetOpen(true);
                }}
              />
            </FormCol>
          </FormRow>
        </View>
      </View>

      {/* Demo Data Reset */}
      <View className="bg-[#FDF5E6] rounded-card border border-[#F3D9A4] p-4 mb-3.5 shadow-sm">
        <Text className="text-[15px] font-bold text-warning">Demo Data</Text>
        <Text className="mt-1 text-[12px] text-main leading-[17px]">
          Restore sample defaults for medicines, schedules, health readings, purchases, and preferences.
        </Text>
        <View className="mt-3">
          <SecondaryButton
            fullWidth
            label="Reset demo data"
            onPress={() => setResetConfirmOpen(true)}
          />
        </View>
      </View>

      {/* Permanent Account & Data Deletion */}
      <View className="bg-[#FDECEC] rounded-card border border-[#F3C1BE] p-4 mb-3.5 shadow-sm">
        <Text className="text-[15px] font-bold text-error">
          Delete Account & Data
        </Text>
        <Text className="mt-1 text-[12px] text-main leading-[17px]">
          Permanently remove your tracked medicines, schedules, purchases, health readings, and scheduled reminders from CareDose.
        </Text>
        <View className="mt-3">
          <DestructiveButton
            fullWidth
            label="Delete account & data"
            onPress={() => {
              setDeleteConfirmText('');
              setDeleteError(null);
              setDeleteSheetOpen(true);
            }}
          />
        </View>
      </View>

      {/* Export JSON Modal */}
      <BottomSheet
        visible={exportSheetOpen}
        title="Export Backup JSON"
        subtitle="Portable caredose.backup.v1 snapshot"
        onClose={() => setExportSheetOpen(false)}
        onSubmit={() => void handleShareOrDownloadBackup()}
        submitLabel={Platform.OS === 'web' ? 'Download JSON' : 'Share backup'}
        cancelLabel="Close"
      >
        {exportDoc ? (
          <View className="mb-3 rounded-field border border-[#C5E8D8] bg-mint p-3">
            <Text className="text-xs font-bold text-primary-dark">
              Included in this backup
            </Text>
            <Text className="mt-1 text-xs leading-[18px] text-main">
              {exportDoc.summary.medicationsCount} medicines ·{' '}
              {exportDoc.summary.schedulesCount} schedules ·{' '}
              {exportDoc.summary.doseEventsCount} dose logs ·{' '}
              {exportDoc.summary.purchasesCount} purchases ·{' '}
              {exportDoc.summary.healthReadingsCount} glucose readings
            </Text>
          </View>
        ) : null}

        <View className="mb-3 rounded-field border border-[#F3D9A4] bg-[#FDF5E6] p-3">
          <Text className="text-[11px] leading-[16px] text-warning font-semibold">
            Keep this backup private — it contains your personal medication and health log entries.
          </Text>
        </View>

        <FormField
          label="Backup JSON preview"
          value={exportJsonText}
          onChangeText={() => undefined}
          editable={false}
          multiline
        />
      </BottomSheet>

      {/* Restore Backup Modal */}
      <BottomSheet
        visible={restoreSheetOpen}
        title="Restore From Backup"
        subtitle="Validates schema before replacing current personal records"
        onClose={() => setRestoreSheetOpen(false)}
        onSubmit={handleValidateRestore}
        submitLabel="Review & restore"
        submitLoading={restoring}
      >
        {restoreError ? (
          <View className="mb-3 rounded-field border border-[#F3C1BE] bg-[#FDECEC] p-3">
            <Text className="text-xs font-medium text-error">{restoreError}</Text>
          </View>
        ) : null}

        <FormField
          label="Paste CareDose backup JSON"
          value={restoreJsonInput}
          onChangeText={(txt) => {
            setRestoreJsonInput(txt);
            if (restoreError) setRestoreError(null);
          }}
          placeholder='{"schemaVersion":"caredose.backup.v1",...}'
          multiline
          required
        />
      </BottomSheet>

      {/* Delete Account Confirmation Sheet */}
      <BottomSheet
        visible={deleteSheetOpen}
        title="Delete Account & Data?"
        subtitle="This permanently wipes your CareDose account and personal tracking records"
        warningNote="Type DELETE in capital letters below. This cannot be undone unless you saved an external JSON backup."
        onClose={() => setDeleteSheetOpen(false)}
        onSubmit={() => void handleConfirmDeleteAccount()}
        submitLabel="Delete permanently"
        submitLoading={deletingAccount}
        submitDisabled={deleteConfirmText.trim() !== 'DELETE' || deletingAccount}
      >
        {deleteError ? (
          <View className="mb-3 rounded-field border border-[#F3C1BE] bg-[#FDECEC] p-3">
            <Text className="text-xs font-medium text-error">{deleteError}</Text>
          </View>
        ) : null}

        <FormField
          label="Confirmation text"
          value={deleteConfirmText}
          onChangeText={(txt) => {
            setDeleteConfirmText(txt);
            if (deleteError) setDeleteError(null);
          }}
          placeholder="Type DELETE"
          required
        />
      </BottomSheet>

      <ConfirmDialog
        visible={restoreConfirmOpen}
        title="Replace Current Records?"
        description={
          pendingRestoreDoc
            ? `Restore ${pendingRestoreDoc.summary.medicationsCount} medicines, ${pendingRestoreDoc.summary.schedulesCount} schedules, ${pendingRestoreDoc.summary.purchasesCount} purchases, and ${pendingRestoreDoc.summary.healthReadingsCount} glucose readings from this backup?`
            : 'Restore records from this backup?'
        }
        warningNote="Current unsaved entries on this profile will be replaced by the backup contents."
        confirmLabel="Restore backup"
        destructive
        loading={restoring}
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => setRestoreConfirmOpen(false)}
      />

      <ConfirmDialog
        visible={resetConfirmOpen}
        title="Reset Demo Data?"
        description="This will restore the default settings and clear changes made in the current demo session."
        warningNote="This action cannot be undone for the current demo session."
        confirmLabel="Reset demo data"
        destructive
        onConfirm={() => void handleConfirmResetDemo()}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </ScreenContainer>
  );
}
