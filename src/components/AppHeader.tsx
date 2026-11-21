import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import {
  CAREDOSE_EXTENDED_COLORS,
  CAREDOSE_TYPOGRAPHY,
  MIN_TOUCH_TARGET,
} from '../theme/tokens';
import { PrimaryButton } from './Buttons';

export interface AppHeaderAction {
  label: string;
  onPress: () => void;
  iconName?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
}

export interface AppHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  primaryAction?: AppHeaderAction;
  rightBadgeText?: string;
}

export function AppHeader({
  title,
  eyebrow,
  subtitle,
  onBack,
  primaryAction,
  rightBadgeText,
}: AppHeaderProps): React.JSX.Element {
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.headerContainer,
        { paddingHorizontal: layout.screenPadding },
      ]}
    >
      <View
        style={[
          styles.innerContainer,
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
            : null,
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.titleColumn}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={onBack}
                style={styles.backButton}
              >
                <Feather name="arrow-left" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
            {eyebrow ? (
              <Text style={styles.eyebrow} numberOfLines={1}>
                {eyebrow}
              </Text>
            ) : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          {primaryAction ? (
            <View style={styles.actionSlot}>
              <PrimaryButton
                compact
                label={primaryAction.label}
                onPress={primaryAction.onPress}
                disabled={primaryAction.disabled}
                leftIcon={
                  primaryAction.iconName ? (
                    <Feather name={primaryAction.iconName} size={14} color="#FFFFFF" />
                  ) : undefined
                }
              />
            </View>
          ) : rightBadgeText ? (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>{rightBadgeText}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  innerContainer: {
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleColumn: {
    flex: 1,
    minWidth: 0,
  },
  actionSlot: {
    flexShrink: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: 'flex-start',
    paddingRight: 12,
    marginBottom: 2,
  },
  backText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    marginBottom: 2,
  },
  title: {
    fontSize: CAREDOSE_TYPOGRAPHY.screenTitle.fontSize,
    fontWeight: CAREDOSE_TYPOGRAPHY.screenTitle.fontWeight,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 2,
    fontSize: CAREDOSE_TYPOGRAPHY.supporting.fontSize,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    lineHeight: 17,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
});
