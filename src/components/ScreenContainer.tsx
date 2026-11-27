import React from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import { PrimaryTabKey } from '../theme/tokens';
import { AppHeader, AppHeaderProps } from './AppHeader';
import { BottomNavigation } from './BottomNavigation';

export interface ScreenContainerProps extends AppHeaderProps {
  children: React.ReactNode;
  activeTabOverride?: PrimaryTabKey;
  scrollable?: boolean;
  hideHeader?: boolean;
  topBanner?: React.ReactNode;
  topOverlay?: React.ReactNode;
  floatingOverlay?: React.ReactNode;
  contentBottomPadding?: number;
}

export function ScreenContainer({
  title,
  eyebrow,
  subtitle,
  onBack,
  primaryAction,
  overflowAction,
  rightBadgeText,
  activeTabOverride,
  scrollable = true,
  hideHeader = false,
  topBanner,
  topOverlay,
  floatingOverlay,
  contentBottomPadding,
  children,
}: ScreenContainerProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const resolvedBottomPadding =
    contentBottomPadding ?? (floatingOverlay ? 96 : 28);

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={topBanner ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <StatusBar barStyle="dark-content" />
      {!hideHeader ? (
        <AppHeader
          title={title}
          eyebrow={eyebrow}
          subtitle={subtitle}
          onBack={onBack}
          primaryAction={primaryAction}
          overflowAction={overflowAction}
          rightBadgeText={rightBadgeText}
        />
      ) : null}

      <View className="flex-1 relative" style={{ flex: 1, position: 'relative' }}>
        {scrollable ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: resolvedBottomPadding,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {topBanner}
            <View
              className="w-full"
              style={[
                {
                  paddingHorizontal: layout.screenPadding,
                  paddingTop: topBanner ? 0 : layout.screenPadding,
                },
                layout.maxContentWidth
                  ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
                  : undefined,
              ]}
            >
              {children}
            </View>
          </ScrollView>
        ) : (
          <View
            className="flex-1 w-full"
            style={[
              { padding: layout.screenPadding, paddingBottom: resolvedBottomPadding },
              layout.maxContentWidth
                ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
                : undefined,
            ]}
          >
            {children}
          </View>
        )}

        {floatingOverlay}
      </View>

      {topOverlay}
      <BottomNavigation activeTabOverride={activeTabOverride} />
    </SafeAreaView>
  );
}
