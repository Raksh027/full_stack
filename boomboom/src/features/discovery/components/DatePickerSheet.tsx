import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

const ACCENT = '#A855F7';
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

type Props = {
  visible: boolean;
  title: string;
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function clampDate(date: Date, min?: Date, max?: Date) {
  let next = startOfDay(date);
  if (min && next < startOfDay(min)) {
    next = startOfDay(min);
  }
  if (max && next > startOfDay(max)) {
    next = startOfDay(max);
  }
  return next;
}

export function DatePickerSheet({
  visible,
  title,
  value,
  minimumDate,
  maximumDate,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(startOfDay(value));
  const [cursor, setCursor] = useState(
    new Date(value.getFullYear(), value.getMonth(), 1),
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    const next = clampDate(value, minimumDate, maximumDate);
    setDraft(next);
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [visible, value, minimumDate, maximumDate]);

  const monthLabel = cursor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const total = daysInMonth(year, month);
    const firstWeekday = new Date(year, month, 1).getDay();
    const items: Array<{ key: string; date: Date | null }> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      items.push({ key: `pad-${i}`, date: null });
    }
    for (let day = 1; day <= total; day += 1) {
      items.push({
        key: `${year}-${month}-${day}`,
        date: new Date(year, month, day),
      });
    }
    while (items.length % 7 !== 0) {
      items.push({ key: `trail-${items.length}`, date: null });
    }
    return items;
  }, [cursor]);

  const canGoPrev = useMemo(() => {
    if (!minimumDate) {
      return true;
    }
    const prevLast = new Date(cursor.getFullYear(), cursor.getMonth(), 0);
    return startOfDay(prevLast) >= startOfDay(minimumDate);
  }, [cursor, minimumDate]);

  const canGoNext = useMemo(() => {
    if (!maximumDate) {
      return true;
    }
    const nextFirst = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return startOfDay(nextFirst) <= startOfDay(maximumDate);
  }, [cursor, maximumDate]);

  const isDisabled = (date: Date) => {
    const day = startOfDay(date);
    if (minimumDate && day < startOfDay(minimumDate)) {
      return true;
    }
    if (maximumDate && day > startOfDay(maximumDate)) {
      return true;
    }
    return false;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={event => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onConfirm(draft)}
              hitSlop={8}
            >
              <Text style={styles.done}>{t('common.done')}</Text>
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!canGoPrev}
              onPress={() =>
                setCursor(
                  current =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
              style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
            >
              <Icon
                name="chevron-back"
                size={18}
                color={canGoPrev ? colors.textPrimary : colors.textMuted}
              />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canGoNext}
              onPress={() =>
                setCursor(
                  current =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
              style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
            >
              <Icon
                name="chevron-forward"
                size={18}
                color={canGoNext ? colors.textPrimary : colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map(day => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map(cell => {
              if (!cell.date) {
                return <View key={cell.key} style={styles.dayCell} />;
              }
              const selected = sameDay(cell.date, draft);
              const disabled = isDisabled(cell.date);
              const today = sameDay(cell.date, new Date());
              return (
                <Pressable
                  key={cell.key}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => setDraft(startOfDay(cell.date!))}
                  style={[
                    styles.dayCell,
                    selected && styles.daySelected,
                    today && !selected && styles.dayToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.dayTextSelected,
                      disabled && styles.dayTextDisabled,
                    ]}
                  >
                    {cell.date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  cancel: {
    color: colors.textSecondary,
    fontSize: fontSize(15),
    fontWeight: '600',
    minWidth: 64,
  },
  done: {
    color: ACCENT,
    fontSize: fontSize(15),
    fontWeight: '800',
    minWidth: 64,
    textAlign: 'right',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.gray850,
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  daySelected: {
    backgroundColor: ACCENT,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: ACCENT,
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  dayTextSelected: {
    color: palette.white,
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: colors.textMuted,
    opacity: 0.45,
  },
});
