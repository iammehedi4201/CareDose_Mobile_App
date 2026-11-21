import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DateField,
  EmptyState,
  FilterChips,
  ScreenContainer,
  StatusBadge,
  StatusVariant,
} from '../src/components';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

type HistoryFilter = 'all' | 'taken' | 'skipped';

interface HistoryEventItem {
  id: string;
  dateLabel: string;
  medicineName: string;
  time: string;
  status: 'taken' | 'skipped';
}

const HISTORY_EVENTS: HistoryEventItem[] = [
  { id: 'h1', dateLabel: 'Wednesday, Nov 18', medicineName: 'Corvalen 5 mg', time: '08:00 AM', status: 'taken' },
  { id: 'h2', dateLabel: 'Wednesday, Nov 18', medicineName: 'Glymexa 500 mg', time: '08:30 AM', status: 'taken' },
  { id: 'h3', dateLabel: 'Wednesday, Nov 18', medicineName: 'Vitamin D3 1000 IU', time: '01:30 PM', status: 'taken' },
  { id: 'h4', dateLabel: 'Tuesday, Nov 17', medicineName: 'Serenil 10 mg', time: '10:00 PM', status: 'taken' },
  { id: 'h5', dateLabel: 'Tuesday, Nov 17', medicineName: 'Lumigan Drops 0.01%', time: '08:00 PM', status: 'skipped' },
];

export default function DoseHistoryScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const [fromDate, setFromDate] = useState('2026-11-15');
  const [toDate, setToDate] = useState('2026-11-21');
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const filtered = HISTORY_EVENTS.filter((ev) => {
    if (filter !== 'all' && ev.status !== filter) return false;
    return true;
  });

  return (
    <ScreenContainer
      title="Dose History"
      onBack={() => router.push('/profile')}
    >

      <View style={layout.stackTwoCol ? styles.dateRangeStacked : styles.dateRangeRow}>
        <View style={layout.stackTwoCol ? styles.dateColFull : styles.dateCol}>
          <DateField label="From" value={fromDate} onChangeDate={setFromDate} />
        </View>
        <View style={layout.stackTwoCol ? styles.dateColFull : styles.dateCol}>
          <DateField label="To" value={toDate} onChangeDate={setToDate} />
        </View>
      </View>

      <FilterChips
        options={[
          { key: 'all', label: 'All', count: HISTORY_EVENTS.length },
          {
            key: 'taken',
            label: 'Taken',
            count: HISTORY_EVENTS.filter((e) => e.status === 'taken').length,
          },
          {
            key: 'skipped',
            label: 'Skipped',
            count: HISTORY_EVENTS.filter((e) => e.status === 'skipped').length,
          },
        ]}
        selectedKey={filter}
        onSelect={setFilter}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No dose history for this filter"
          description="Select another status filter or widen the date range."
          actionLabel="Show all"
          onAction={() => setFilter('all')}
        />
      ) : (
        filtered.map((item) => (
          <View key={item.id} style={styles.rowCard}>
            <View style={styles.rowTextCol}>
              <Text style={styles.medName}>{item.medicineName}</Text>
              <Text style={styles.metaText}>
                {item.dateLabel} · {item.time}
              </Text>
            </View>
            <StatusBadge variant={item.status as StatusVariant} />
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dateRangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateRangeStacked: {
    flexDirection: 'column',
  },
  dateCol: {
    flex: 1,
    minWidth: 0,
  },
  dateColFull: {
    width: '100%',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    marginTop: 10,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
  },
  medName: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  metaText: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
});
