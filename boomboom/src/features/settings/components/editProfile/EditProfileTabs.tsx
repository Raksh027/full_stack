import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { homeAccent } from '@/features/discovery/theme';
import { colors, fontSize, palette } from '@/theme';

import { EDIT_PROFILE_TABS, type EditProfileTab } from './types';

type Props = {
  active: EditProfileTab;
  onChange: (tab: EditProfileTab) => void;
};

export function EditProfileTabs({ active, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {EDIT_PROFILE_TABS.map(tab => {
        const selected = active === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab)}
            style={[styles.tab, selected && styles.tabOn]}
          >
            <Text style={[styles.label, selected && styles.labelOn]}>
              {t(`settings.editProfileTabs.${tab}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
    alignItems: 'center',
  },
  tab: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
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
});
