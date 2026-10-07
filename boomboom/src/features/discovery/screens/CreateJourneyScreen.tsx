import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';

import type { RootStackScreenProps } from '@/navigation/types';
import { BusyOverlay, Icon, ScreenContainer, type IconName } from '@/shared/components';
import { showErrorAlert, showSuccessAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';

import {
  useCreateJourneyMutation,
  useGetMyJourneyQuery,
  useUpdateJourneyMutation,
} from '../api/travelApi';
import {
  formatTravelDate,
  parseTravelDate,
  travelDatePayload,
} from '../utils/travelDates';

import { CityPickerSheet } from '../components/CityPickerSheet';
import { CountryPickerSheet } from '../components/CountryPickerSheet';
import { DatePickerSheet } from '../components/DatePickerSheet';
import { StatePickerSheet } from '../components/StatePickerSheet';
import {
  countryCodeForName,
  fetchJourneyCountries,
} from '../data/geoHierarchy';
import { flagUrl } from '../data/journeyLocations';

const ACCENT = '#A855F7';
const FIELD_BG = '#1A1F2E';
const CHIP_IDLE = '#2A2A2A';

type JourneyType =
  | 'vacation'
  | 'business'
  | 'nightlife'
  | 'companion'
  | 'tourGuide'
  | 'massageSpa';
type TravelStyle = 'solo' | 'group' | 'backpacker' | 'couple';
type Companion = 'any' | 'male' | 'female';
type HideFrom = 'male' | 'female' | 'both';

function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={14}
          color={selected ? palette.white : colors.textSecondary}
        />
      ) : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SelectField({
  label,
  icon,
  value,
  placeholder,
  onPress,
  flag,
}: {
  label: string;
  icon: IconName;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  flag?: string | null;
}) {
  return (
    <View style={styles.fieldCol}>
      <View style={styles.fieldLabelRow}>
        <Icon name={icon} size={13} color={ACCENT} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.select}>
        {flag ? (
          <Image source={{ uri: flag }} style={styles.fieldFlag} resizeMode="cover" />
        ) : null}
        <Text
          style={[styles.selectText, !value && styles.selectPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function DateField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldCol}>
      <View style={styles.fieldLabelRow}>
        <Icon name="calendar-outline" size={13} color={ACCENT} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.select}>
        <Text
          style={[styles.selectText, !value && styles.selectPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Icon name="calendar-outline" size={16} color={ACCENT} />
      </Pressable>
    </View>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function CreateJourneyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RootStackScreenProps<'CreateJourney'>['route']>();
  const journeyId = route.params?.journeyId;
  const { data: existing } = useGetMyJourneyQuery(journeyId as string, {
    skip: !journeyId,
    refetchOnMountOrArgChange: true,
  });
  const [createJourney, createState] = useCreateJourneyMutation();
  const [updateJourney, updateState] = useUpdateJourneyMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const [hydrated, setHydrated] = useState(!journeyId);

  const [journeyType, setJourneyType] = useState<JourneyType>('vacation');
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('solo');
  const [companion, setCompanion] = useState<Companion>('any');
  const [hideFromCountry, setHideFromCountry] = useState(false);
  const [hideFrom, setHideFrom] = useState<HideFrom | null>(null);
  const [hideSheetOpen, setHideSheetOpen] = useState(false);
  const [countryPicker, setCountryPicker] = useState<'from' | 'to' | null>(
    null,
  );
  const [statePicker, setStatePicker] = useState<'from' | 'to' | null>(null);
  const [cityPicker, setCityPicker] = useState<'from' | 'to' | null>(null);
  const [fromCountry, setFromCountry] = useState<string | null>(null);
  const [fromCountryCode, setFromCountryCode] = useState<string | null>(null);
  const [fromState, setFromState] = useState<string | null>(null);
  const [fromCity, setFromCity] = useState<string | null>(null);
  const [toCountry, setToCountry] = useState<string | null>(null);
  const [toCountryCode, setToCountryCode] = useState<string | null>(null);
  const [toState, setToState] = useState<string | null>(null);
  const [toCity, setToCity] = useState<string | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [datePicker, setDatePicker] = useState<'departure' | 'return' | null>(
    null,
  );
  const [description, setDescription] = useState('');

  useEffect(() => {
    void fetchJourneyCountries();
  }, []);

  useEffect(() => {
    if (!existing || hydrated) {
      return;
    }
    setJourneyType((existing.tripType as JourneyType) || 'vacation');
    setTravelStyle(existing.travelStyle || 'solo');
    setCompanion(existing.companion || 'any');
    setHideFromCountry(existing.hideFromCountry);
    setHideFrom(existing.hideFrom ?? null);
    setFromCountry(existing.fromCountry || null);
    setFromCountryCode(
      existing.fromCountryCode ||
        countryCodeForName(existing.fromCountry) ||
        null,
    );
    setFromState(existing.fromState || null);
    setFromCity(existing.fromCity || null);
    setToCountry(existing.toCountry || null);
    setToCountryCode(
      existing.toCountryCode || countryCodeForName(existing.toCountry) || null,
    );
    setToState(existing.toState || null);
    setToCity(existing.toCity || null);
    setDepartureDate(parseTravelDate(existing.departure));
    setReturnDate(parseTravelDate(existing.returnDate));
    setDescription(existing.description || '');
    setHydrated(true);
  }, [existing, hydrated]);

  const today = startOfDay(new Date());
  const departureLabel = departureDate
    ? formatTravelDate(travelDatePayload(departureDate))
    : null;
  const returnLabel = returnDate
    ? formatTravelDate(travelDatePayload(returnDate))
    : null;

  const onToggleHide = (value: boolean) => {
    setHideFromCountry(value);
    if (value) {
      setHideSheetOpen(true);
    } else {
      setHideFrom(null);
    }
  };

  const publish = async () => {
    if (saving) {
      return;
    }
    if (
      !fromCountry ||
      !fromCity ||
      !toCountry ||
      !toCity ||
      !departureDate
    ) {
      Alert.alert(t('common.error'), t('travel.missingFields'));
      return;
    }
    const fromCode = fromCountryCode || countryCodeForName(fromCountry);
    const toCode = toCountryCode || countryCodeForName(toCountry);
    const body = {
      fromCity,
      fromCountry,
      fromCountryCode: fromCode,
      fromCountryFlag: fromCode ? flagUrl(fromCode) : existing?.fromCountryFlag || '',
      fromState: fromState || '',
      toCity,
      toCountry,
      toCountryCode: toCode,
      toCountryFlag: toCode ? flagUrl(toCode) : existing?.toCountryFlag || '',
      toState: toState || '',
      departure: travelDatePayload(departureDate),
      returnDate: travelDatePayload(returnDate),
      tripType: journeyType,
      travelStyle,
      companion,
      description,
      hideFromCountry,
      hideFrom,
    };
    try {
      if (journeyId) {
        await updateJourney({ journeyId, body }).unwrap();
        showSuccessAlert(t('travel.updateSuccess'), t('common.success'), () =>
          navigation.goBack(),
        );
      } else {
        await createJourney(body).unwrap();
        showSuccessAlert(t('travel.createSuccess'), t('common.success'), () =>
          navigation.goBack(),
        );
      }
    } catch (error) {
      showErrorAlert(error);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => {
            if (saving) {
              return;
            }
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <Icon name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('travel.createTitle')}</Text>
          <Text style={styles.subtitle}>{t('travel.createHint')}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>{t('travel.journeyType')}</Text>
        <View style={styles.chipRow}>
          <Chip
            label={t('travel.tripVacation')}
            selected={journeyType === 'vacation'}
            onPress={() => setJourneyType('vacation')}
          />
          <Chip
            label={t('travel.tripBusiness')}
            selected={journeyType === 'business'}
            onPress={() => setJourneyType('business')}
          />
          <Chip
            label={t('travel.nightlifeParty')}
            selected={journeyType === 'nightlife'}
            onPress={() => setJourneyType('nightlife')}
          />
          <Chip
            label={t('travel.tripCompanion')}
            selected={journeyType === 'companion'}
            onPress={() => setJourneyType('companion')}
          />
          <Chip
            label={t('travel.tripTourGuide')}
            selected={journeyType === 'tourGuide'}
            onPress={() => setJourneyType('tourGuide')}
          />
          <Chip
            label={t('travel.tripMassageSpa')}
            selected={journeyType === 'massageSpa'}
            onPress={() => setJourneyType('massageSpa')}
          />
        </View>

        <Text style={styles.section}>{t('travel.travelStyle')}</Text>
        <View style={styles.chipRow}>
          {(
            [
              ['solo', 'travel.styleSolo'],
              ['group', 'travel.styleGroup'],
              ['backpacker', 'travel.styleBackpacker'],
              ['couple', 'travel.styleCouple'],
            ] as const
          ).map(([key, labelKey]) => (
            <Chip
              key={key}
              label={t(labelKey)}
              selected={travelStyle === key}
              onPress={() => setTravelStyle(key)}
            />
          ))}
        </View>

        <Text style={styles.section}>{t('travel.companions')}</Text>
        <View style={styles.chipRow}>
          <Chip
            label={t('travel.companionAny')}
            icon="male-female"
            selected={companion === 'any'}
            onPress={() => setCompanion('any')}
          />
          <Chip
            label={t('travel.companionMale')}
            icon="male"
            selected={companion === 'male'}
            onPress={() => setCompanion('male')}
          />
          <Chip
            label={t('travel.companionFemale')}
            icon="female"
            selected={companion === 'female'}
            onPress={() => setCompanion('female')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (hideFromCountry) {
              setHideSheetOpen(true);
            }
          }}
          style={styles.hideRow}
        >
          <View style={styles.hideIcon}>
            <Icon name="eye-off" size={18} color="#F5C400" />
          </View>
          <View style={styles.hideCopy}>
            <Text style={styles.hideTitle}>{t('travel.hideFromCountry')}</Text>
            <Text style={styles.hideHint}>{t('travel.hideFromCountryHint')}</Text>
            {hideFrom ? (
              <Text style={styles.hideSelected}>
                {t('travel.hideSelected', {
                  who: t(`travel.hide.${hideFrom}`),
                })}
              </Text>
            ) : null}
          </View>
          <Switch
            value={hideFromCountry}
            onValueChange={onToggleHide}
            trackColor={{ false: palette.gray650, true: ACCENT }}
            thumbColor={palette.white}
          />
        </Pressable>

        <Text style={styles.section}>{t('travel.fromLocation')}</Text>
        <View style={styles.fieldRow}>
          <SelectField
            label={t('travel.fromCountry')}
            icon="globe-outline"
            value={fromCountry}
            flag={
              fromCountryCode
                ? flagUrl(fromCountryCode)
                : existing?.fromCountryFlag
            }
            placeholder={t('travel.selectFrom')}
            onPress={() => setCountryPicker('from')}
          />
          <SelectField
            label={t('travel.fromState')}
            icon="map-outline"
            value={fromState}
            placeholder={t('travel.selectFrom')}
            onPress={() => setStatePicker('from')}
          />
        </View>
        <View style={[styles.fieldRow, styles.fieldRowSpaced]}>
          <SelectField
            label={t('travel.fromCity')}
            icon="business-outline"
            value={fromCity}
            placeholder={t('travel.selectFrom')}
            onPress={() => setCityPicker('from')}
          />
        </View>

        <Text style={styles.section}>{t('travel.destination')}</Text>
        <View style={styles.fieldRow}>
          <SelectField
            label={t('travel.destinationCountry')}
            icon="globe-outline"
            value={toCountry}
            flag={
              toCountryCode ? flagUrl(toCountryCode) : existing?.toCountryFlag
            }
            placeholder={t('travel.selectDestination')}
            onPress={() => setCountryPicker('to')}
          />
          <SelectField
            label={t('travel.destinationState')}
            icon="map-outline"
            value={toState}
            placeholder={t('travel.selectDestination')}
            onPress={() => setStatePicker('to')}
          />
        </View>
        <View style={[styles.fieldRow, styles.fieldRowSpaced]}>
          <SelectField
            label={t('travel.destinationCity')}
            icon="business-outline"
            value={toCity}
            placeholder={t('travel.selectDestination')}
            onPress={() => setCityPicker('to')}
          />
        </View>

        <Text style={styles.section}>{t('travel.travelDates')}</Text>
        <View style={styles.fieldRow}>
          <DateField
            label={t('travel.departureDate')}
            value={departureLabel}
            placeholder={t('travel.selectDepartureDate')}
            onPress={() => setDatePicker('departure')}
          />
          <DateField
            label={t('travel.returnDate')}
            value={returnLabel}
            placeholder={t('travel.selectReturnDate')}
            onPress={() => setDatePicker('return')}
          />
        </View>

        <Text style={styles.section}>{t('travel.description')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('travel.descriptionPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.description}
        />

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => {
            void publish();
          }}
        >
          <LinearGradient
            colors={['#C026FF', '#7C3AED']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.publish, saving && styles.publishBusy]}
          >
            {saving ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.publishText}>
                {journeyId ? t('travel.saveJourney') : t('travel.publishJourney')}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>

      <Modal
        visible={hideSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHideSheetOpen(false)}
      >
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setHideSheetOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('travel.hideJourneyFrom')}</Text>
            <Text style={styles.sheetHint}>{t('travel.hideJourneyFromHint')}</Text>
            {(
              [
                ['male', 'male', 'travel.hide.male'],
                ['female', 'female', 'travel.hide.female'],
                ['both', 'male-female', 'travel.hide.both'],
              ] as const
            ).map(([key, icon, labelKey]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                onPress={() => {
                  setHideFrom(key);
                  setHideSheetOpen(false);
                }}
                style={[
                  styles.sheetOption,
                  hideFrom === key && styles.sheetOptionOn,
                ]}
              >
                <Icon
                  name={icon}
                  size={18}
                  color={hideFrom === key ? ACCENT : colors.textPrimary}
                />
                <Text style={styles.sheetOptionLabel}>{t(labelKey)}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <CountryPickerSheet
        visible={countryPicker != null}
        selected={countryPicker === 'from' ? fromCountry : toCountry}
        onClose={() => setCountryPicker(null)}
        onSelect={country => {
          if (countryPicker === 'from') {
            setFromCountry(country.name);
            setFromCountryCode(country.code);
            setFromState(null);
            setFromCity(null);
          } else if (countryPicker === 'to') {
            setToCountry(country.name);
            setToCountryCode(country.code);
            setToState(null);
            setToCity(null);
          }
        }}
      />

      <StatePickerSheet
        visible={statePicker != null}
        country={statePicker === 'from' ? fromCountry : toCountry}
        selected={statePicker === 'from' ? fromState : toState}
        onClose={() => setStatePicker(null)}
        onSelect={state => {
          if (statePicker === 'from') {
            setFromState(state);
            setFromCity(null);
          } else if (statePicker === 'to') {
            setToState(state);
            setToCity(null);
          }
        }}
      />

      <CityPickerSheet
        visible={cityPicker != null}
        country={cityPicker === 'from' ? fromCountry : toCountry}
        state={cityPicker === 'from' ? fromState : toState}
        selected={cityPicker === 'from' ? fromCity : toCity}
        onClose={() => setCityPicker(null)}
        onSelect={city => {
          if (cityPicker === 'from') {
            setFromCity(city);
          } else if (cityPicker === 'to') {
            setToCity(city);
          }
        }}
      />

      <DatePickerSheet
        visible={datePicker != null}
        title={
          datePicker === 'return'
            ? t('travel.returnDate')
            : t('travel.departureDate')
        }
        value={
          datePicker === 'return'
            ? returnDate ?? departureDate ?? today
            : departureDate ?? today
        }
        minimumDate={
          datePicker === 'return' ? departureDate ?? today : today
        }
        onClose={() => setDatePicker(null)}
        onConfirm={date => {
          if (datePicker === 'departure') {
            setDepartureDate(date);
            if (returnDate && startOfDay(returnDate) < startOfDay(date)) {
              setReturnDate(date);
            }
          } else if (datePicker === 'return') {
            setReturnDate(date);
          }
          setDatePicker(null);
        }}
      />
      <BusyOverlay
        visible={saving}
        message={
          journeyId
            ? t('travel.savingJourney')
            : t('travel.creatingJourney')
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.gray850,
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(26),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '400',
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  section: {
    marginTop: 18,
    marginBottom: 10,
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: CHIP_IDLE,
  },
  chipOn: {
    backgroundColor: ACCENT,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  chipLabelOn: {
    color: palette.white,
  },
  hideRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  hideIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideCopy: {
    flex: 1,
    gap: 2,
  },
  hideTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  hideHint: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    lineHeight: 16,
  },
  hideSelected: {
    marginTop: 2,
    color: ACCENT,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldRowSpaced: {
    marginTop: 10,
  },
  fieldCol: {
    flex: 1,
    gap: 8,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: FIELD_BG,
  },
  fieldFlag: {
    width: 22,
    height: 15,
    borderRadius: 3,
    backgroundColor: palette.gray750,
  },
  selectText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  selectPlaceholder: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  description: {
    minHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: FIELD_BG,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    lineHeight: 20,
  },
  publish: {
    marginTop: 24,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBusy: {
    opacity: 0.75,
  },
  publishText: {
    color: palette.white,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  sheetScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
    marginBottom: 8,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(20),
    fontWeight: '800',
  },
  sheetHint: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    marginBottom: 6,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.gray650,
    backgroundColor: '#111111',
  },
  sheetOptionOn: {
    borderColor: ACCENT,
    backgroundColor: '#1A1028',
  },
  sheetOptionLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
});
