import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { homeAccent } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  icon: IconName;
  showArrow?: boolean;
  onPress?: () => void;
};

export function SectionPill({
  title,
  subtitle,
  icon,
  showArrow,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={styles.pill}
    >
      <View style={styles.iconRing}>
        <Icon name={icon} size={16} color={homeAccent.cyan} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {showArrow ? (
        <View style={styles.arrowRing}>
          <Icon name="arrow-forward" size={16} color={homeAccent.cyan} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: homeAccent.pill,
    borderWidth: 1,
    borderColor: palette.gray850,
    gap: 10,
  },
  iconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: homeAccent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 1,
    color: colors.textSecondary,
    fontSize: fontSize(12),
  },
  arrowRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: homeAccent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
