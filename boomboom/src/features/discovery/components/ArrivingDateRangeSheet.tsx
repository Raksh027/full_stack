import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';
import { parseISODate, toISODate } from '@/shared/utils/date';

const ACCENT = '#A855F7';
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

type Props = {
  visible: boolean;
  fromDate: Date | null;
  toDate: Date | null;
  onClose: () => void;
  onApply: (from: Date, to: Date) => void;
  onClear: () => void;
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

function inRange(day: Date, from: Date | null, to: Date | null) {
  if (!from || !to) {
    return false;
  }
  const time = startOfDay(day).getTime();
  return time > from.getTime() && time < to.getTime();
}

function formatDisplay(date: Date | null) {
  if (!date) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function maskDateInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseTypedDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const iso = parseISODate(trimmed);
  if (iso) {
    return startOfDay(iso);
  }
  const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return startOfDay(date);
}

export function ArrivingDateRangeSheet({
  visible,
  fromDate,
  toDate,
  onClose,
  onApply,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const [from, setFrom] = useState<Date | null>(fromDate);
  const [to, setTo] = useState<Date | null>(toDate);
  const [fromText, setFromText] = useState(formatDisplay(fromDate));
  const [toText, setToText] = useState(formatDisplay(toDate));
  const [picking, setPicking] = useState<'from' | 'to'>('from');
  const [cursor, setCursor] = useState(() => {
    const seed = fromDate ?? toDate ?? new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  useEffect(() => {
    if (!visible) {
      return;
    }
    const nextFrom = fromDate ? startOfDay(fromDate) : null;
    const nextTo = toDate ? startOfDay(toDate) : null;
    setFrom(nextFrom);
    setTo(nextTo);
    setFromText(formatDisplay(nextFrom));
    setToText(formatDisplay(nextTo));
    setPicking(nextFrom && !nextTo ? 'to' : 'from');
    const seed = nextFrom ?? nextTo ?? new Date();
    setCursor(new Date(seed.getFullYear(), seed.getMonth(), 1));
  }, [visible, fromDate, toDate]);

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

  const applyTyped = (
    field: 'from' | 'to',
    masked: string,
    parsed: Date | null,
  ) => {
    if (field === 'from') {
      setFromText(masked);
      setFrom(parsed);
      if (parsed) {
        setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        if (to && parsed > to) {
          setTo(null);
          setToText('');
        }
        setPicking('to');
      }
      return;
    }
    setToText(masked);
    setTo(parsed);
    if (parsed) {
      setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      if (from && parsed < from) {
        setFrom(parsed);
        setFromText(masked);
        setTo(null);
        setToText('');
        setPicking('to');
        return;
      }
      setPicking('from');
    }
  };

  const onChangeFrom = (text: string) => {
    const masked = maskDateInput(text);
    applyTyped('from', masked, parseTypedDate(masked));
  };

  const onChangeTo = (text: string) => {
    const masked = maskDateInput(text);
    applyTyped('to', masked, parseTypedDate(masked));
  };

  const selectDay = (date: Date) => {
    const day = startOfDay(date);
    if (picking === 'from' || !from || day < from) {
      setFrom(day);
      setFromText(formatDisplay(day));
      if (to && day > to) {
        setTo(null);
        setToText('');
      }
      setPicking('to');
      return;
    }
    setTo(day);
    setToText(formatDisplay(day));
    setPicking('from');
  };

  const fromInvalid = fromText.length === 10 && !from;
  const toInvalid = toText.length === 10 && !to;
  const rangeInvalid = Boolean(from && to && from > to);
  const canApply = Boolean(from && to && !rangeInvalid);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t('travel.selectArrivingDates')}</Text>
            <Text style={styles.hint}>{t('travel.selectArrivingDatesHint')}</Text>

            <View style={styles.fields}>
              <View
                style={[
                  styles.field,
                  picking === 'from' && styles.fieldOn,
                  fromInvalid && styles.fieldError,
                ]}
              >
                <Text style={styles.fieldLabel}>{t('travel.from')}</Text>
                <View style={styles.inputRow}>
                  <Icon
                    name="calendar-outline"
                    size={16}
                    color={picking === 'from' ? ACCENT : colors.textMuted}
                  />
                  <TextInput
                    value={fromText}
                    onChangeText={onChangeFrom}
                    onFocus={() => setPicking('from')}
                    placeholder={t('travel.datePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>
              </View>
              <View
                style={[
                  styles.field,
                  picking === 'to' && styles.fieldOn,
                  toInvalid && styles.fieldError,
                ]}
              >
                <Text style={styles.fieldLabel}>{t('travel.to')}</Text>
                <View style={styles.inputRow}>
                  <Icon
                    name="calendar-outline"
                    size={16}
                    color={picking === 'to' ? ACCENT : colors.textMuted}
                  />
                  <TextInput
                    value={toText}
                    onChangeText={onChangeTo}
                    onFocus={() => setPicking('to')}
                    placeholder={t('travel.datePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
            {fromInvalid || toInvalid ? (
              <Text style={styles.error}>{t('travel.dateInvalid')}</Text>
            ) : rangeInvalid ? (
              <Text style={styles.error}>{t('travel.dateRangeInvalid')}</Text>
            ) : (
              <Text style={styles.formatHint}>{t('travel.dateInputHint')}</Text>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.calendarScroll}
            >
              <View style={styles.monthRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setCursor(
                      current =>
                        new Date(
                          current.getFullYear(),
                          current.getMonth() - 1,
                          1,
                        ),
                    )
                  }
                  style={styles.navBtn}
                >
                  <Icon
                    name="chevron-back"
                    size={18}
                    color={colors.textPrimary}
                  />
                </Pressable>
                <Text style={styles.monthLabel}>{monthLabel}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setCursor(
                      current =>
                        new Date(
                          current.getFullYear(),
                          current.getMonth() + 1,
                          1,
                        ),
                    )
                  }
                  style={styles.navBtn}
                >
                  <Icon
                    name="chevron-forward"
                    size={18}
                    color={colors.textPrimary}
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
                  const isFrom = from ? sameDay(cell.date, from) : false;
                  const isTo = to ? sameDay(cell.date, to) : false;
                  const selected = isFrom || isTo;
                  const ranged = inRange(cell.date, from, to);
                  return (
                    <Pressable
                      key={cell.key}
                      accessibilityRole="button"
                      onPress={() => selectDay(cell.date!)}
                      style={[
                        styles.dayCell,
                        ranged && styles.dayInRange,
                        selected && styles.daySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.dayTextSelected,
                        ]}
                      >
                        {cell.date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFrom(null);
                  setTo(null);
                  setFromText('');
                  setToText('');
                  setPicking('from');
                  onClear();
                }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearText}>{t('travel.clearDates')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!canApply}
                onPress={() => {
                  if (from && to) {
                    onApply(from, to);
                  }
                }}
                style={[styles.applyBtn, !canApply && styles.applyBtnOff]}
              >
                <Text style={styles.applyText}>{t('travel.applyDates')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function arrivingRangeLabel(
  fromIso?: string | null,
  toIso?: string | null,
) {
  if (!fromIso || !toIso) {
    return null;
  }
  const from = parseISODate(fromIso);
  const to = parseISODate(toIso);
  if (!from || !to) {
    return `${fromIso} – ${toIso}`;
  }
  const fmt = (date: Date) => formatDisplay(date);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function isoFromDate(date: Date) {
  return toISODate(startOfDay(date));
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
  hint: {
    marginTop: 4,
    marginBottom: 14,
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
  fields: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.gray650,
    backgroundColor: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldOn: {
    borderColor: ACCENT,
  },
  fieldError: {
    borderColor: '#F87171',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: fontSize(11),
    fontWeight: '700',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
    paddingVertical: 0,
    minHeight: 22,
  },
  formatHint: {
    marginTop: 8,
    marginBottom: 8,
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  error: {
    marginTop: 8,
    marginBottom: 8,
    color: '#F87171',
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  calendarScroll: {
    maxHeight: 320,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  monthLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
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
  },
  dayCell: {
    width: '14.2857%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayInRange: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderRadius: 0,
  },
  daySelected: {
    backgroundColor: ACCENT,
    borderRadius: 999,
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 4,
  },
  clearBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.gray650,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  applyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnOff: {
    opacity: 0.4,
  },
  applyText: {
    color: palette.white,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
});
