import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { homeAccent } from '@/features/discovery/theme';
import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

export const LIKES_TABS = [
  'sent',
  'received',
  'viewed',
  'matches',
] as const;

export type LikesTab = (typeof LIKES_TABS)[number];

const TAB_META: Record<
  LikesTab,
  {
    icon: IconName;
    labelKey:
      | 'likes.myLikes'
      | 'likes.whoLiked'
      | 'likes.viewed'
      | 'likes.matches';
  }
> = {
  sent: { icon: 'heart', labelKey: 'likes.myLikes' },
  received: { icon: 'person', labelKey: 'likes.whoLiked' },
  viewed: { icon: 'eye-outline', labelKey: 'likes.viewed' },
  matches: { icon: 'people-outline', labelKey: 'likes.matches' },
};

type Props = {
  active: LikesTab;
  counts: Record<LikesTab, number>;
  onChange: (tab: LikesTab) => void;
};

export function LikesTabs({ active, counts, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {LIKES_TABS.map(tab => {
        const meta = TAB_META[tab];
        const selected = tab === active;
        const count = counts[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab)}
            style={[styles.tab, selected && styles.tabOn]}
          >
            <Icon
              name={meta.icon}
              size={15}
              color={selected ? palette.black : colors.textSecondary}
            />
            <Text style={[styles.label, selected && styles.labelOn]}>
              {t(meta.labelKey)}
            </Text>
            {count > 0 ? (
              <View style={[styles.badge, selected && styles.badgeOn]}>
                <Text style={[styles.badgeText, selected && styles.badgeTextOn]}>
                  {count > 9 ? '9+' : count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
  },
  scroller: {
    flexGrow: 0,
  },
  row: {
    gap: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
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
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: {
    backgroundColor: palette.black,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: fontSize(10),
    fontWeight: '800',
  },
  badgeTextOn: {
    color: homeAccent.yellow,
  },
});
