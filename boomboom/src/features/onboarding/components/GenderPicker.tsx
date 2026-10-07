import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { GENDER_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { Gender } from '@/features/profile/types';
import { Icon } from '@/shared/components';
import { colors } from '@/theme';

import { RadioOption } from './RadioOption';

type Props = {
  visible: boolean;
  value: Gender | null;
  onSelect: (gender: Gender) => void;
  onClose: () => void;
};

export function GenderPicker({ visible, value, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Gender | null>(value);

  useEffect(() => {
    if (visible) {
      setSelected(value);
    }
  }, [visible, value]);

  const handleSelect = (gender: Gender) => {
    setSelected(gender);
    // Let the selected border + yellow dot paint before the sheet closes.
    setTimeout(() => {
      onSelect(gender);
    }, 220);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('onboarding.basicInfo.genderPickerTitle')}
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Icon name="close" />
            </Pressable>
          </View>
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
                selected={selected === option.value}
                onPress={() => handleSelect(option.value)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  options: {
    gap: 10,
  },
});
