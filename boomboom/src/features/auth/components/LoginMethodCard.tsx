import { StyleSheet, Text, View } from 'react-native';

import { GradientBorder, Icon, type IconName } from '@/shared/components';
import { colors, fontSize, scale, verticalScale } from '@/theme';

type Props = {
  icon: IconName;
  title: string;
  subtitle: string;
  trailingIcon?: IconName;
};

export function LoginMethodCard({
  icon,
  title,
  subtitle,
  trailingIcon,
}: Props) {
  return (
    <GradientBorder radius={18} contentStyle={styles.card}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={20} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {trailingIcon ? (
        <View style={[styles.iconCircle, styles.trailingCircle]}>
          <Icon name={trailingIcon} size={18} />
        </View>
      ) : null}
    </GradientBorder>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(18),
    gap: scale(14),
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iconCircle,
  },
  trailingCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
  },
});
