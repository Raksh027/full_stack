import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

const SWITCH_ON = '#7C5CFF';
const SWITCH_OFF = '#3A3A42';

type Props = {
  icon: IconName;
  iconColor: string;
  title: string;
  hint: string;
  badge?: string;
  badgeTone?: 'free' | 'premium' | 'ok';
  last?: boolean;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
};

export function SettingsRow({
  icon,
  iconColor,
  title,
  hint,
  badge,
  badgeTone = 'free',
  last,
  onPress,
  switchValue,
  onSwitchChange,
}: Props) {
  const isToggle = typeof switchValue === 'boolean' && onSwitchChange;

  return (
    <Pressable
      accessibilityRole={isToggle ? 'switch' : 'button'}
      accessibilityState={isToggle ? { checked: switchValue } : undefined}
      onPress={
        isToggle ? () => onSwitchChange(!switchValue) : onPress
      }
      disabled={!isToggle && !onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}26` }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={[styles.body, !last && styles.bodyBorder]}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </View>
        {badge ? (
          <View
            style={[
              styles.badge,
              badgeTone === 'premium' && styles.badgePremium,
              badgeTone === 'ok' && styles.badgeOk,
              badgeTone === 'free' && styles.badgeFree,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                badgeTone === 'premium' && styles.badgeTextPremium,
                badgeTone === 'ok' && styles.badgeTextOk,
                badgeTone === 'free' && styles.badgeTextFree,
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
        {isToggle ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: SWITCH_OFF, true: SWITCH_ON }}
            thumbColor={palette.white}
            ios_backgroundColor={SWITCH_OFF}
          />
        ) : (
          <Icon name="chevron-forward" size={16} color={palette.gray500} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingLeft: 14,
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    marginLeft: 12,
    paddingRight: 14,
    gap: 8,
  },
  bodyBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize(12),
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFree: {
    backgroundColor: '#14301F',
  },
  badgePremium: {
    backgroundColor: '#2A2300',
  },
  badgeOk: {
    backgroundColor: '#102420',
  },
  badgeText: {
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  badgeTextFree: {
    color: '#4CD964',
  },
  badgeTextPremium: {
    color: '#F5C400',
  },
  badgeTextOk: {
    color: '#2EE6D6',
  },
});
