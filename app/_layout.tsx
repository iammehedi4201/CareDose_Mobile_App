import '../global.css';
import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MedicationsProvider } from '../src/features/medications/MedicationsContext';
import { SchedulesProvider } from '../src/features/schedule/SchedulesContext';

export default function RootLayout(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <MedicationsProvider>
        <SchedulesProvider>
          <Slot />
        </SchedulesProvider>
      </MedicationsProvider>
    </SafeAreaProvider>
  );
}
