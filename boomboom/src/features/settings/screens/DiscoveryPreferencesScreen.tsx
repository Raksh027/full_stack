import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterPickerSheet } from '@/features/discovery/components/FilterPickerSheet';
import { countryCodeForName } from '@/features/discovery/data/geoHierarchy';
import {
  JOURNEY_COUNTRIES,
  flagUrl,
} from '@/features/discovery/data/journeyLocations';
import {
  INTEREST_OPTIONS,
  LANGUAGE_OPTIONS,
  LIFESTYLE_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
  WORK_OPTIONS,
  lifestyleLabelKey,
} from '@/features/profile/constants/profileOptions';
import type {
  BodyType,
  Drinking,
  Gender,
  HeightRange,
  Personality,
  RelationshipGoal,
  WorkCategory,
  WorkoutFrequency,
} from '@/features/profile/types';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, type IconName } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';
import {
  autocompleteCountries,
} from '@/services/maps/googlePlaces';

import {
  useGetDiscoveryPreferencesQuery,
  useUpdateDiscoveryPreferencesMutation,
} from '../api/settingsApi';
import {
  FilterRangeSlider,
  FilterValueSlider,
} from '../components/FilterSliders';
import type { DiscoveryPreferences } from '../types';

type Props = RootStackScreenProps<'DiscoveryPreferences'>;

const ACCENT = '#7C5CFF';
const CARD = '#12101A';
const BORDER = '#2A2438';
const MAX_DISTANCE = 100;

const MEET_OPTIONS: { key: 'man' | 'woman' | 'other'; icon: IconName }[] = [
  { key: 'man', icon: 'man-outline' },
  { key: 'woman', icon: 'woman-outline' },
  { key: 'other', icon: 'people-outline' },
];

const NATIONALITY_ANY = '__any__';

function countryFlag(name: string | null | undefined) {
  const code = countryCodeForName(name);
  return code ? flagUrl(code) : undefined;
}

function meetSelection(
  interestedIn: Gender[],
): 'man' | 'woman' | 'other' | null {
  if (interestedIn.length === 1 && interestedIn[0] === 'man') {
    return 'man';
  }
  if (interestedIn.length === 1 && interestedIn[0] === 'woman') {
    return 'woman';
  }
  if (
    interestedIn.includes('transgender') ||
    interestedIn.includes('nonbinary') ||
    interestedIn.length > 1
  ) {
    return 'other';
  }
  return null;
}

function interestedFromMeet(key: 'man' | 'woman' | 'other'): Gender[] {
  if (key === 'man') {
    return ['man'];
  }
  if (key === 'woman') {
    return ['woman'];
  }
  return ['man', 'woman', 'transgender', 'nonbinary'];
}

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter(item => item !== value)
    : [...list, value];
}

type OptionChipProps = {
  label: string;
  icon?: IconName;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
};

function OptionChip({ label, icon, emoji, selected, onPress }: OptionChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.optionChip, selected && styles.optionChipOn]}
    >
      {emoji ? (
        <Text style={styles.optionChipEmoji}>{emoji}</Text>
      ) : icon ? (
        <Icon
          name={icon}
          size={14}
          color={selected ? palette.white : colors.textSecondary}
        />
      ) : null}
      <Text
        style={[styles.optionChipLabel, selected && styles.optionChipLabelOn]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type CollapseKey =
  | 'lookingFor'
  | 'interests'
  | 'languages'
  | 'work'
  | 'bodyType'
  | 'height'
  | 'drinking'
  | 'personality'
  | 'workout';

type CollapsibleHeaderProps = {
  title: string;
  icon?: IconName;
  open: boolean;
  onToggle: () => void;
  spaced?: boolean;
};

function CollapsibleHeader({
  title,
  icon,
  open,
  onToggle,
  spaced,
}: CollapsibleHeaderProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      style={[styles.collapseHeader, spaced && styles.sectionGap]}
    >
      <View style={styles.collapseTitleRow}>
        {icon ? <Icon name={icon} size={16} color={ACCENT} /> : null}
        <Text style={styles.sectionLabelInline}>{title}</Text>
      </View>
      <Icon
        name={open ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={ACCENT}
      />
    </Pressable>
  );
}

export function DiscoveryPreferencesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useGetDiscoveryPreferencesQuery();
  const [updatePreferences] = useUpdateDiscoveryPreferencesMutation();
  const [draft, setDraft] = useState<DiscoveryPreferences | null>(null);
  const [showNationalities, setShowNationalities] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [countryHits, setCountryHits] = useState<
    { id: string; label: string; flagUrl?: string }[]
  >([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<CollapseKey, boolean>>(
    {
      lookingFor: false,
      interests: false,
      languages: false,
      work: false,
      bodyType: false,
      height: false,
      drinking: false,
      personality: false,
      workout: false,
    },
  );

  const toggleSection = (key: CollapseKey) => {
    setOpenSections(current => ({ ...current, [key]: !current[key] }));
  };

  useEffect(() => {
    if (data) {
      setDraft({
        ...data,
        nationality: data.nationality ?? null,
        relationshipGoals: data.relationshipGoals ?? [],
        bodyTypes: data.bodyTypes ?? [],
        drinking: data.drinking ?? [],
        workout: data.workout ?? [],
        personality: data.personality ?? [],
        heightRanges: data.heightRanges ?? [],
        interests: data.interests ?? [],
        languages: data.languages ?? [],
        workCategories: data.workCategories ?? [],
      });
    }
  }, [data]);

  const prefs = draft;
  const selectedMeet = useMemo(
    () => (prefs ? meetSelection(prefs.interestedIn) : null),
    [prefs],
  );

  const popularCountries = useMemo(() => {
    const ordered = [
      ...JOURNEY_COUNTRIES.filter(item => item.code === 'in'),
      ...JOURNEY_COUNTRIES.filter(item => item.code !== 'in'),
    ];
    return ordered.map(item => ({
      id: item.name,
      label: item.code === 'in' ? `${item.name}  ·  most people` : item.name,
      flagUrl: flagUrl(item.code),
    }));
  }, []);

  const nationalityOptions = useMemo(() => {
    const anyOption = {
      id: NATIONALITY_ANY,
      label: t('filters.anyNationality'),
    };
    const searched = countryQuery.trim().length >= 2 ? countryHits : popularCountries;
    return [anyOption, ...searched];
  }, [countryHits, countryQuery, popularCountries, t]);

  useEffect(() => {
    const input = countryQuery.trim();
    if (!showNationalities || input.length < 2) {
      setCountryHits([]);
      setCountryLoading(false);
      return;
    }
    let cancelled = false;
    setCountryLoading(true);
    const timer = setTimeout(() => {
      autocompleteCountries(input)
        .then(items => {
          if (cancelled) {
            return;
          }
          setCountryHits(
            items.map(item => {
              const code = countryCodeForName(item.name);
              return {
                id: item.name,
                label: item.name,
                flagUrl: code ? flagUrl(code) : undefined,
              };
            }),
          );
        })
        .catch(() => {
          if (!cancelled) {
            const q = input.toLowerCase();
            setCountryHits(
              popularCountries.filter(item =>
                item.label.toLowerCase().includes(q),
              ),
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setCountryLoading(false);
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [countryQuery, popularCountries, showNationalities]);

  if (!prefs) {
    return (
      <View style={[styles.root, styles.center]}>
        {isLoading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : isError ? (
          <Pressable onPress={() => refetch()}>
            <Text style={styles.retry}>{t('common.retry')}</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={colors.textPrimary} />
        )}
      </View>
    );
  }

  const patch = (next: Partial<DiscoveryPreferences>) => {
    setDraft(current => (current ? { ...current, ...next } : current));
    updatePreferences(next).unwrap().catch(showErrorAlert);
  };

  const distanceLabel =
    prefs.maxDistanceKm >= MAX_DISTANCE
      ? t('filters.distanceAny')
      : t('filters.distanceKm', { km: prefs.maxDistanceKm });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[
          'rgba(124,92,255,0.22)',
          'transparent',
          'rgba(124,92,255,0.12)',
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name="funnel" size={18} color={ACCENT} />
          <Text style={styles.title}>{t('filters.title')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.vibePill}
        >
          <Icon name="heart" size={12} color={palette.white} />
          <Text style={styles.vibeLabel}>{t('filters.findVibe')}</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('filters.lookingToMeet')}</Text>
          <View style={styles.meetRow}>
            {MEET_OPTIONS.map(option => {
              const selected = selectedMeet === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() =>
                    patch({ interestedIn: interestedFromMeet(option.key) })
                  }
                  style={[styles.meetChip, selected && styles.meetChipOn]}
                >
                  <Icon
                    name={option.icon}
                    size={16}
                    color={selected ? palette.white : colors.textSecondary}
                  />
                  <Text
                    style={[styles.meetLabel, selected && styles.meetLabelOn]}
                  >
                    {option.key === 'man'
                      ? t('filters.meet.man')
                      : option.key === 'woman'
                        ? t('filters.meet.woman')
                        : t('filters.meet.other')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <View style={styles.sliderTitleRow}>
                <Icon name="person-outline" size={15} color={ACCENT} />
                <Text style={styles.sliderTitle}>{t('filters.age')}</Text>
              </View>
              <Text style={styles.sliderValue}>
                {t('filters.ageRange', {
                  min: prefs.minAge,
                  max: prefs.maxAge,
                })}
              </Text>
            </View>
            <FilterRangeSlider
              min={18}
              max={70}
              low={prefs.minAge}
              high={prefs.maxAge}
              onChange={(minAge, maxAge) => patch({ minAge, maxAge })}
            />
          </View>

          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <View style={styles.sliderTitleRow}>
                <Icon name="location-outline" size={15} color={ACCENT} />
                <Text style={styles.sliderTitle}>{t('filters.distance')}</Text>
              </View>
              <Text style={styles.sliderValue}>{distanceLabel}</Text>
            </View>
            <FilterValueSlider
              min={1}
              max={MAX_DISTANCE}
              value={prefs.maxDistanceKm}
              onChange={maxDistanceKm => patch({ maxDistanceKm })}
            />
          </View>

          <Text style={[styles.sectionLabel, styles.sectionGap]}>
            {t('filters.nationality')}
          </Text>
          <Pressable
            onPress={() => setShowNationalities(true)}
            style={styles.locationBox}
          >
            {countryFlag(prefs.nationality) ? (
              <Image
                source={{ uri: countryFlag(prefs.nationality) }}
                style={styles.nationalityFlag}
                resizeMode="cover"
              />
            ) : (
              <Icon name="flag-outline" size={18} color={colors.textMuted} />
            )}
            <Text style={styles.locationText} numberOfLines={1}>
              {prefs.nationality || t('filters.nationalityHint')}
            </Text>
            <Icon name="chevron-down" size={18} color={ACCENT} />
          </Pressable>
          <FilterPickerSheet
            visible={showNationalities}
            title={t('filters.nationality')}
            searchPlaceholder={t('filters.searchCountry')}
            options={nationalityOptions}
            selected={prefs.nationality ?? NATIONALITY_ANY}
            remoteSearch
            loading={countryLoading}
            onClose={() => {
              setShowNationalities(false);
              setCountryQuery('');
            }}
            onSearchChange={setCountryQuery}
            onSelect={id => {
              patch({
                nationality: id === NATIONALITY_ANY ? null : id,
              });
              setShowNationalities(false);
              setCountryQuery('');
            }}
          />

          <CollapsibleHeader
            title={t('filters.relationship')}
            icon="heart-outline"
            open={openSections.lookingFor}
            onToggle={() => toggleSection('lookingFor')}
            spaced
          />
          {openSections.lookingFor ? (
            <View style={styles.chipWrap}>
              {RELATIONSHIP_GOAL_OPTIONS.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(
                    `profileOptions.relationshipGoal.${option.value}.title`,
                  )}
                  icon={option.icon}
                  selected={prefs.relationshipGoals.includes(option.value)}
                  onPress={() =>
                    patch({
                      relationshipGoals: toggleValue(
                        prefs.relationshipGoals,
                        option.value as RelationshipGoal,
                      ),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.interests.title')}
            icon="sparkles-outline"
            open={openSections.interests}
            onToggle={() => toggleSection('interests')}
            spaced
          />
          {openSections.interests ? (
            <View style={styles.chipWrap}>
              {INTEREST_OPTIONS.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(
                    `profileOptions.interests.options.${option.value}` as 'profileOptions.interests.options.music',
                  )}
                  icon={option.icon}
                  selected={prefs.interests.includes(option.value)}
                  onPress={() =>
                    patch({
                      interests: toggleValue(prefs.interests, option.value),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.languages.title')}
            icon="language-outline"
            open={openSections.languages}
            onToggle={() => toggleSection('languages')}
            spaced
          />
          {openSections.languages ? (
            <View style={styles.chipWrap}>
              {LANGUAGE_OPTIONS.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(`profileOptions.languages.options.${option.value}`)}
                  emoji={option.emoji}
                  selected={prefs.languages.includes(option.value)}
                  onPress={() =>
                    patch({
                      languages: toggleValue(prefs.languages, option.value),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.work.title')}
            icon="briefcase-outline"
            open={openSections.work}
            onToggle={() => toggleSection('work')}
            spaced
          />
          {openSections.work ? (
            <View style={styles.chipWrap}>
              {WORK_OPTIONS.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(`profileOptions.work.options.${option.value}`)}
                  icon={option.icon}
                  selected={prefs.workCategories.includes(option.value)}
                  onPress={() =>
                    patch({
                      workCategories: toggleValue(
                        prefs.workCategories,
                        option.value as WorkCategory,
                      ),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.lifestyle.bodyType.title')}
            icon="body-outline"
            open={openSections.bodyType}
            onToggle={() => toggleSection('bodyType')}
            spaced
          />
          {openSections.bodyType ? (
            <View style={styles.chipWrap}>
              {LIFESTYLE_OPTIONS.bodyType.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(lifestyleLabelKey('bodyType', option.value))}
                  icon={option.icon}
                  selected={prefs.bodyTypes.includes(option.value)}
                  onPress={() =>
                    patch({
                      bodyTypes: toggleValue(
                        prefs.bodyTypes,
                        option.value as BodyType,
                      ),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.lifestyle.heightRange.title')}
            icon="resize-outline"
            open={openSections.height}
            onToggle={() => toggleSection('height')}
            spaced
          />
          {openSections.height ? (
            <View style={styles.chipWrap}>
              {LIFESTYLE_OPTIONS.heightRange.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(lifestyleLabelKey('heightRange', option.value))}
                  selected={prefs.heightRanges.includes(option.value)}
                  onPress={() =>
                    patch({
                      heightRanges: toggleValue(
                        prefs.heightRanges,
                        option.value as HeightRange,
                      ),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.lifestyle.drinking.title')}
            icon="wine-outline"
            open={openSections.drinking}
            onToggle={() => toggleSection('drinking')}
            spaced
          />
          {openSections.drinking ? (
            <View style={styles.chipWrap}>
              {LIFESTYLE_OPTIONS.drinking.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(lifestyleLabelKey('drinking', option.value))}
                  icon={option.icon}
                  selected={prefs.drinking.includes(option.value)}
                  onPress={() =>
                    patch({
                      drinking: toggleValue(
                        prefs.drinking,
                        option.value as Drinking,
                      ),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.lifestyle.personality.title')}
            icon="happy-outline"
            open={openSections.personality}
            onToggle={() => toggleSection('personality')}
            spaced
          />
          {openSections.personality ? (
            <View style={styles.chipWrap}>
              {LIFESTYLE_OPTIONS.personality.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(lifestyleLabelKey('personality', option.value))}
                  icon={option.icon}
                  selected={prefs.personality.includes(option.value)}
                  onPress={() =>
                    patch({
                      personality: toggleValue(
                        prefs.personality,
                        option.value as Personality,
                      ),
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          <CollapsibleHeader
            title={t('profileOptions.lifestyle.workout.title')}
            icon="barbell-outline"
            open={openSections.workout}
            onToggle={() => toggleSection('workout')}
            spaced
          />
          {openSections.workout ? (
            <View style={styles.chipWrap}>
              {LIFESTYLE_OPTIONS.workout.map(option => (
                <OptionChip
                  key={option.value}
                  label={t(lifestyleLabelKey('workout', option.value))}
                  icon={option.icon}
                  selected={prefs.workout.includes(option.value)}
                  onPress={() =>
                    patch({
                      workout: toggleValue(
                        prefs.workout,
                        option.value as WorkoutFrequency,
                      ),
                    })
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0912',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '800',
  },
  vibePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  vibeLabel: {
    color: palette.white,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 2,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionLabelInline: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 4,
  },
  collapseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  sectionGap: {
    marginTop: 10,
  },
  subSection: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '700',
    marginBottom: 8,
  },
  meetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  meetChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#161320',
  },
  meetChipOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  meetLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  meetLabelOn: {
    color: palette.white,
  },
  sliderBlock: {
    marginBottom: 10,
    gap: 4,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sliderTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '700',
  },
  sliderValue: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#161320',
    paddingHorizontal: 12,
  },
  locationText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  nationalityFlag: {
    width: 28,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#2A2438',
  },
  nationalityList: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#161320',
    overflow: 'hidden',
    maxHeight: 220,
  },
  nationalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  nationalityRowOn: {
    backgroundColor: 'rgba(124,92,255,0.16)',
  },
  nationalityText: {
    color: colors.textPrimary,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  nationalityTextOn: {
    color: ACCENT,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    width: '31.5%',
    flexGrow: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 8,
  },
  goalChipOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  goalLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  goalLabelOn: {
    color: palette.white,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: '#161320',
  },
  optionChipOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  optionChipEmoji: {
    fontSize: fontSize(13),
    lineHeight: fontSize(16),
  },
  optionChipLabel: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  optionChipLabelOn: {
    color: palette.white,
  },
});
