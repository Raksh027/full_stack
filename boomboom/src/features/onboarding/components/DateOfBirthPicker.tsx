import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PROFILE_RULES } from '@/config/constants';
import { Icon, PrimaryButton } from '@/shared/components';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  value: Date | null;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

type ColumnItem = { key: number; label: string };

const DEFAULT_YEAR = 2000;

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function DateOfBirthPicker({
  visible,
  value,
  onConfirm,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const [day, setDay] = useState(value?.getDate() ?? 1);
  const [month, setMonth] = useState(value?.getMonth() ?? 0);
  const [year, setYear] = useState(value?.getFullYear() ?? DEFAULT_YEAR);

  const months = useMemo<ColumnItem[]>(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        key: index,
        label: new Date(DEFAULT_YEAR, index, 1).toLocaleDateString(
          i18n.language,
          {
            month: 'short',
          },
        ),
      })),
    [i18n.language],
  );

  const years = useMemo<ColumnItem[]>(() => {
    const newest = new Date().getFullYear() - PROFILE_RULES.minAge;
    const oldest = new Date().getFullYear() - PROFILE_RULES.maxAge;
    return Array.from({ length: newest - oldest + 1 }, (_, i) => ({
      key: newest - i,
      label: String(newest - i),
    }));
  }, []);

  const days = useMemo<ColumnItem[]>(
    () =>
      Array.from({ length: daysInMonth(month, year) }, (_, i) => ({
        key: i + 1,
        label: String(i + 1),
      })),
    [month, year],
  );

  const handleConfirm = () => {
    const safeDay = Math.min(day, daysInMonth(month, year));
    onConfirm(new Date(year, month, safeDay));
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
              {t('onboarding.basicInfo.pickerTitle')}
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Icon name="close" />
            </Pressable>
          </View>

          <View style={styles.columns}>
            <PickerColumn
              label={t('onboarding.basicInfo.day')}
              items={days}
              selected={day}
              onSelect={setDay}
            />
            <PickerColumn
              label={t('onboarding.basicInfo.month')}
              items={months}
              selected={month}
              onSelect={setMonth}
            />
            <PickerColumn
              label={t('onboarding.basicInfo.year')}
              items={years}
              selected={year}
              onSelect={setYear}
            />
          </View>

          <PrimaryButton
            label={t('onboarding.basicInfo.confirm')}
            onPress={handleConfirm}
            shape="rounded"
          />
        </View>
      </View>
    </Modal>
  );
}

type ColumnProps = {
  label: string;
  items: ColumnItem[];
  selected: number;
  onSelect: (key: number) => void;
};

function PickerColumn({ label, items, selected, onSelect }: ColumnProps) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView
        style={styles.columnScroll}
        showsVerticalScrollIndicator={false}
      >
        {items.map(item => {
          const isSelected = item.key === selected;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              style={[styles.item, isSelected && styles.itemSelected]}
            >
              <Text
                style={[styles.itemText, isSelected && styles.itemTextSelected]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  columns: {
    flexDirection: 'row',
    height: 240,
    gap: 8,
    marginBottom: 20,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  columnScroll: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
  },
  item: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  itemSelected: {
    marginHorizontal: 4,
    marginVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.gradientBorder[0],
    backgroundColor: '#101820',
  },
  itemText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  itemTextSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
