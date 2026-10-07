import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { images } from '@/assets';
import { homeAccent } from '@/features/discovery/theme';
import { RELATIONSHIP_GOAL_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { RelationshipGoal } from '@/features/profile/types';
import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize } from '@/theme';

const PILL_BLUE = '#3AA0FF';
const PILL_IDLE = '#2C2C32';

const GOAL_ICONS: Record<
  RelationshipGoal,
  { name: IconName; color: string }
> = {
  serious_love: { name: 'heart', color: '#E74C3C' },
  marriage: { name: 'diamond-outline', color: '#F2F2F2' },
  casual: { name: 'happy-outline', color: '#F4C430' },
  long_term: { name: 'sparkles', color: '#F4C430' },
  short_term: { name: 'hourglass-outline', color: '#D6C7B0' },
  travel_partner: { name: 'airplane', color: '#3B82F6' },
  new_friends: { name: 'people-outline', color: '#F4C430' },
  mutual_support: { name: 'people', color: '#3B82F6' },
  freelance: { name: 'woman-outline', color: '#F2F2F2' },
};

type Props = {
  goal: RelationshipGoal | null;
  onChange: (value: RelationshipGoal) => void;
};

export function LookingForPanel({ goal, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {RELATIONSHIP_GOAL_OPTIONS.map(option => {
          const selected = goal === option.value;
          const visual = GOAL_ICONS[option.value];
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.row,
                selected ? styles.rowOn : styles.rowOff,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.iconSlot}>
                {option.value === 'freelance' ? (
                  <Image
                    source={images.freelanceGirl}
                    style={styles.customIcon}
                    resizeMode="contain"
                    tintColor="#F2F2F2"
                  />
                ) : option.value === 'new_friends' ? (
                  <Image
                    source={images.friendshipHandshake}
                    style={styles.customIcon}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name={visual.name} size={22} color={visual.color} />
                )}
              </View>
              <Text style={styles.label}>
                {t(`profileOptions.relationshipGoal.${option.value}.title`)}
              </Text>
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    gap: 16,
    paddingBottom: 24,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: colors.background,
  },
  rowOff: {
    borderColor: PILL_IDLE,
  },
  rowOn: {
    borderColor: PILL_BLUE,
  },
  rowPressed: {
    opacity: 0.82,
  },
  iconSlot: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIcon: {
    width: 22,
    height: 22,
  },
  label: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: homeAccent.yellow,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: homeAccent.yellow,
  },
});
