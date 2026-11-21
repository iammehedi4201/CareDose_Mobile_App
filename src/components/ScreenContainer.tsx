import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, PrimaryTabKey } from '../theme/tokens';
import { AppHeader, AppHeaderProps } from './AppHeader';
import { BottomNavigation } from './BottomNavigation';

export interface ScreenContainerProps extends AppHeaderProps {
  children: React.ReactNode;
  activeTabOverride?: PrimaryTabKey;
  scrollable?: boolean;
}

export function ScreenContainer({
  title,
  eyebrow,
  subtitle,
  onBack,
  primaryAction,
  rightBadgeText,
  activeTabOverride,
  scrollable = true,
  children,
}: ScreenContainerProps): React.JSX.Element {
  const layout = useResponsiveLayout();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <AppHeader
        title={title}
        eyebrow={eyebrow}
        subtitle={subtitle}
        onBack={onBack}
        primaryAction={primaryAction}
        rightBadgeText={rightBadgeText}
      />

      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: layout.screenPadding,
              paddingTop: layout.screenPadding,
              paddingBottom: 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.innerWrapper,
              layout.maxContentWidth
                ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
                : null,
            ]}
          >
            {children}
          </View>
        </ScrollView>
      ) : (
        <View
          style={[
            styles.staticContent,
            { padding: layout.screenPadding },
            layout.maxContentWidth
              ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
              : null,
          ]}
        >
          {children}
        </View>
      )}

      <BottomNavigation activeTabOverride={activeTabOverride} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerWrapper: {
    width: '100%',
  },
  staticContent: {
    flex: 1,
    width: '100%',
  },
});
