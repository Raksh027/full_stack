import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { homeAccent } from '../theme';

export type ActiveVerifiedTab = 'active' | 'verified';

type Props = {
  active: ActiveVerifiedTab;
  onChange: (tab: ActiveVerifiedTab) => void;
};

export function ActiveVerifiedTabs({ active, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'active' }}
        onPress={() => onChange('active')}
        style={[styles.tab, active === 'active' && styles.tabOn]}
      >
        <View
          style={[styles.greenDot, active === 'active' && styles.greenDotOn]}
        />
        <Text style={[styles.label, active === 'active' && styles.labelOn]}>
          {t('home.active')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'verified' }}
        onPress={() => onChange('verified')}
        style={[styles.tab, active === 'verified' && styles.tabOn]}
      >
        <Icon
          name="checkmark-circle"
          size={15}
          color={active === 'verified' ? palette.black : '#3B82F6'}
        />
        <Text style={[styles.label, active === 'verified' && styles.labelOn]}>
          {t('home.verified')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  tabOn: {
    backgroundColor: homeAccent.yellow,
    borderColor: homeAccent.yellow,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  labelOn: {
    color: palette.black,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  greenDotOn: {
    backgroundColor: palette.black,
  },
});
