import React from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import { PrimaryTabKey } from '../theme/tokens';
import { AppHeader, AppHeaderProps } from './AppHeader';
import { BottomNavigation } from './BottomNavigation';
import { SuccessToast } from './FeedbackStates';

export interface ScreenContainerProps extends AppHeaderProps {
  children: React.ReactNode;
  activeTabOverride?: PrimaryTabKey;
  scrollable?: boolean;
  hideHeader?: boolean;
  topBanner?: React.ReactNode;
  topOverlay?: React.ReactNode;
  floatingOverlay?: React.ReactNode;
  toastMessage?: string | null;
  toastKey?: string | number;
  onDismissToast?: () => void;
  toastDurationMs?: number;
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
  toastMessage,
  toastKey,
  onDismissToast,
  toastDurationMs = 4000,
  contentBottomPadding,
  children,
}: ScreenContainerProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const resolvedBottomPadding =
    contentBottomPadding ?? (floatingOverlay ? 96 : 28);
  const topToastInset = Math.max(0, insets.top) + 10;

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
      {toastMessage ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: topToastInset,
            left: layout.screenPadding,
            right: layout.screenPadding,
            zIndex: 60,
            elevation: 14,
            alignItems: 'center',
          }}
        >
          <View
            className="w-full"
            style={
              layout.maxContentWidth
                ? { maxWidth: layout.maxContentWidth, width: '100%' }
                : undefined
            }
          >
            <SuccessToast
              floating
              message={toastMessage}
              toastKey={toastKey}
              onDismiss={onDismissToast}
              durationMs={toastDurationMs}
            />
          </View>
        </View>
      ) : null}
      <BottomNavigation activeTabOverride={activeTabOverride} />
    </SafeAreaView>
  );
}
