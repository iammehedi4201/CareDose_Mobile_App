import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import { PrimaryTabKey } from '../theme/tokens';
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
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom', 'left', 'right']}>
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
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: layout.screenPadding,
            paddingTop: layout.screenPadding,
            paddingBottom: 28,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className="w-full"
            style={
              layout.maxContentWidth
                ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
                : undefined
            }
          >
            {children}
          </View>
        </ScrollView>
      ) : (
        <View
          className="flex-1 w-full"
          style={[
            { padding: layout.screenPadding },
            layout.maxContentWidth
              ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
              : undefined,
          ]}
        >
          {children}
        </View>
      )}

      <BottomNavigation activeTabOverride={activeTabOverride} />
    </SafeAreaView>
  );
}
