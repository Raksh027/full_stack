import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { RadioOption } from '@/features/onboarding/components/RadioOption';
import { GENDER_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { Gender } from '@/features/profile/types';

type Props = {
  gender: Gender | null;
  locked: boolean;
  onChange: (value: Gender) => void;
};

export function GenderPanel({ gender, locked, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {GENDER_OPTIONS.map(option => (
          <RadioOption
            key={option.value}
            accent
            label={t(`profileOptions.gender.${option.value}`)}
            hint={
              option.value === 'nonbinary'
                ? t('onboarding.gender.nonbinaryHint')
                : undefined
            }
            selected={gender === option.value}
            onPress={() => {
              if (!locked) {
                onChange(option.value);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  options: {
    gap: 12,
  },
});
