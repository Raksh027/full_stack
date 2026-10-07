import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import { images } from '@/assets';
import { BusyOverlay, Icon, ScreenContainer, type IconName } from '@/shared/components';
import { parseApiError } from '@/services/api/apiError';
import { getDeviceLocation, LocationError } from '@/services/location/deviceLocation';
import { reverseGeocodePlace } from '@/services/maps/googlePlaces';
import { showErrorAlert, showSuccessAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';

import { useGetMyProfileQuery } from '@/features/profile/api/profileApi';
import {
  getLastKnownCoords,
  useLastKnownCoords,
} from '../hooks/useHomeLocation';
import { TonightLocationField } from '../components/TonightLocationField';

import {
  useCreateTonightMutation,
  useDeleteTonightMutation,
  useGetMyTonightQuery,
  useUpdateTonightMutation,
} from '../api/tonightApi';
import {
  FREE_TONIGHT_FILTERS,
  tonightActivityMeta,
  type FreeTonightActivity,
} from '../data/mockFreeTonight';

const PURPLE = '#B56CFF';
const PURPLE_SOFT = '#A855F7';
const PURPLE_DEEP = '#7C3AED';
const FIELD_BG = '#14101F';
const BORDER = 'rgba(181,108,255,0.45)';

const TIME_OPTIONS = [
  '6:00 PM',
  '7:00 PM',
  '8:00 PM',
  '9:00 PM',
  '10:00 PM',
  '11:00 PM',
  '12:00 AM',
] as const;

type PickerKind = 'activity' | 'time' | null;

function IconTile({ name }: { name: IconName }) {
  return (
    <View style={styles.iconTile}>
      <Icon name={name} size={18} color={PURPLE} />
    </View>
  );
}

function OptionSheet({
  visible,
  title,
  options,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: { key: string; label: string; emoji?: string }[];
  selected: string | null;
  onClose: () => void;
  onSelect: (key: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map(option => {
              const on = selected === option.key;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                  style={[styles.optionRow, on && styles.optionRowOn]}
                >
                  {option.emoji ? (
                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  ) : null}
                  <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>
                    {option.label}
                  </Text>
                  {on ? (
                    <Icon name="checkmark" size={18} color={PURPLE} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CreateFreeTonightScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { data: mine, isLoading: loadingMine, refetch: refetchMine } =
    useGetMyTonightQuery();
  const { data: me } = useGetMyProfileQuery();
  const [createTonight, { isLoading: creating }] = useCreateTonightMutation();
  const [updateTonight, { isLoading: updating }] = useUpdateTonightMutation();
  const [deleteTonight, { isLoading: deleting }] = useDeleteTonightMutation();

  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState<FreeTonightActivity | null>(null);
  const [location, setLocation] = useState('');
  const [time, setTime] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [locating, setLocating] = useState(false);
  const lastCoords = useLastKnownCoords();
  const placeBias = lastCoords ?? getLastKnownCoords() ?? undefined;
  const busy = creating || updating || deleting;

  useEffect(() => {
    if (!mine || !editing) {
      return;
    }
    setActivity(mine.activity);
    setLocation(mine.venue || '');
    setTime(mine.meetTime || null);
  }, [editing, mine]);

  const activityOptions = useMemo(
    () =>
      FREE_TONIGHT_FILTERS.filter(item => item.key !== 'all').map(item => ({
        key: item.key,
        label: t(item.labelKey),
        emoji: item.emoji,
      })),
    [t],
  );

  const timeOptions = useMemo(
    () => TIME_OPTIONS.map(value => ({ key: value, label: value })),
    [],
  );

  const activityLabel = activity
    ? t(
        FREE_TONIGHT_FILTERS.find(item => item.key === activity)?.labelKey ??
          'freeTonight.filterAll',
      )
    : null;

  const useCurrentLocation = async () => {
    if (locating) {
      return;
    }
    setLocating(true);
    try {
      const coords = await getDeviceLocation();
      const place = await reverseGeocodePlace(coords.latitude, coords.longitude);
      const parts = [place.locality, place.city, place.region].filter(
        (value, index, list) => Boolean(value) && list.indexOf(value) === index,
      );
      setLocation(
        parts.join(', ').slice(0, 160) || t('createTonight.currentLocation'),
      );
    } catch (error) {
      if (error instanceof LocationError) {
        Alert.alert(
          t('nearby.locationErrorTitle'),
          t('nearby.locationErrorHint'),
        );
      } else {
        showErrorAlert(error);
      }
    } finally {
      setLocating(false);
    }
  };

  const create = async () => {
    if (!activity || busy) {
      return;
    }
    const body = {
      activity,
      venue: location,
      time: time ?? undefined,
      tagline: location,
    };
    try {
      if (mine) {
        await updateTonight(body).unwrap();
        setEditing(false);
        showSuccessAlert(t('createTonight.updateSuccess'));
        return;
      }
      await createTonight(body).unwrap();
      showSuccessAlert(t('createTonight.createSuccess'));
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed.code === 'TONIGHT_EXISTS' || parsed.status === 409) {
        await refetchMine();
        return;
      }
      showErrorAlert(error);
    }
  };

  const confirmDelete = () => {
    if (busy) {
      return;
    }
    Alert.alert(
      t('createTonight.deleteTitle'),
      t('createTonight.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('createTonight.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteTonight().unwrap();
                setEditing(false);
                setActivity(null);
                setLocation('');
                setTime(null);
                showSuccessAlert(t('createTonight.deleteSuccess'));
              } catch (error) {
                showErrorAlert(error);
              }
            })();
          },
        },
      ],
    );
  };

  if (loadingMine && !mine) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Icon name="chevron-back" size={20} color={palette.white} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>
              {t('createTonight.titlePrefix')}{' '}
              <Text style={styles.titleAccent}>{t('createTonight.titleAccent')}</Text>
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color={PURPLE} />
        </View>
      </ScreenContainer>
    );
  }

  if (mine && !editing) {
    const meta = tonightActivityMeta(mine.activity);
    const photo = mine.featuredPhoto || mine.photo || me?.photos?.[0]?.url;
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Icon name="chevron-back" size={20} color={palette.white} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>
              {t('createTonight.existsTitle')}
            </Text>
            <Text style={styles.subtitle}>{t('createTonight.existsHint')}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.profileHero}>
            <Image
              source={photo ? { uri: photo } : images.profilePlaceholder}
              style={styles.profileHeroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(12,6,22,0.92)']}
              style={styles.profileHeroFade}
              pointerEvents="none"
            />
            <View style={styles.profileHeroCopy}>
              <Text style={styles.profileName}>
                {mine.name}, {mine.age}
              </Text>
              <View style={styles.profilePills}>
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>{t('freeTonight.freeNow')}</Text>
                </View>
                <View style={styles.activityPill}>
                  <Text style={styles.activityPillText}>
                    {meta.emoji} {t(meta.labelKey)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {mine.venue ? (
            <View style={styles.field}>
              <IconTile name="location" />
              <View style={styles.fieldCopy}>
                <Text style={styles.fieldLabel}>
                  {t('createTonight.locationLabel')}
                </Text>
                <Text style={styles.fieldValue}>{mine.venue}</Text>
              </View>
            </View>
          ) : null}

          {mine.meetTime ? (
            <View style={styles.field}>
              <IconTile name="time-outline" />
              <View style={styles.fieldCopy}>
                <Text style={styles.fieldLabel}>{t('createTonight.timeLabel')}</Text>
                <Text style={styles.fieldValue}>{mine.meetTime}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.field}>
            <IconTile name="heart-outline" />
            <View style={styles.fieldCopy}>
              <Text style={styles.fieldLabel}>
                {t('freeTonight.lookingForTitle')}
              </Text>
              <Text style={styles.lookingValue}>{mine.lookingFor}</Text>
            </View>
          </View>

          <Text style={styles.endsNote}>
            {t('freeTonight.endsIn', { time: mine.endsIn || mine.timeLeft })}
          </Text>

          <View style={styles.mineActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEditing(true)}
              style={styles.editBtn}
            >
              <Icon name="create-outline" size={16} color={palette.white} />
              <Text style={styles.editText}>{t('createTonight.edit')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              disabled={busy}
              style={styles.deleteBtn}
            >
              <Icon name="trash-outline" size={16} color="#FF6B6B" />
              <Text style={styles.deleteText}>{t('createTonight.delete')}</Text>
            </Pressable>
          </View>
        </ScrollView>
        <BusyOverlay
          visible={deleting}
          message={t('createTonight.deleting')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() =>
            editing ? setEditing(false) : navigation.goBack()
          }
          style={styles.backBtn}
        >
          <Icon name="chevron-back" size={20} color={palette.white} />
        </Pressable>
        <View style={styles.headerCopy}>
            <Text style={styles.title}>
              {editing ? (
                t('createTonight.edit')
              ) : (
                <>
                  {t('createTonight.titlePrefix')}{' '}
                  <Text style={styles.titleAccent}>
                    {t('createTonight.titleAccent')}
                  </Text>
                </>
              )}
            </Text>
            <Text style={styles.subtitle}>
              {editing
                ? t('createTonight.existsHint')
                : t('createTonight.subtitle')}
            </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Image
            source={images.nightPartyMoon}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[
              'rgba(12,6,22,0.94)',
              'rgba(18,8,36,0.78)',
              'rgba(40,10,70,0.35)',
              'rgba(80,20,120,0.08)',
            ]}
            locations={[0, 0.4, 0.72, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.heroFade}
            pointerEvents="none"
          />
          <View style={styles.heroCopy} pointerEvents="none">
            <Icon name="moon" size={28} color={PURPLE} />
            <Text style={styles.heroTitle}>
              {t('createTonight.heroTitle')}{' '}
              <Text style={styles.heroTitleAccent}>
                {t('createTonight.heroTitleAccent')}
              </Text>
            </Text>
            <Text style={styles.heroHint}>{t('createTonight.heroHint')}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setPicker('activity')}
          style={styles.field}
        >
          <IconTile name="wine" />
          <View style={styles.fieldCopy}>
            <Text style={styles.fieldLabel}>
              {t('createTonight.planningLabel')}
            </Text>
            <Text
              style={[styles.fieldValue, !activityLabel && styles.fieldPlaceholder]}
            >
              {activityLabel ?? t('createTonight.select')}
            </Text>
          </View>
          <Icon name="chevron-down" size={18} color={PURPLE} />
        </Pressable>

        <TonightLocationField
          value={location}
          onChangeText={setLocation}
          locating={locating}
          bias={placeBias}
          onPressLocate={() => {
            void useCurrentLocation();
          }}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => setPicker('time')}
          style={styles.field}
        >
          <IconTile name="time-outline" />
          <View style={styles.fieldCopy}>
            <Text style={styles.fieldLabel}>{t('createTonight.timeLabel')}</Text>
            <Text style={[styles.fieldValue, !time && styles.fieldPlaceholder]}>
              {time ?? t('createTonight.select')}
            </Text>
          </View>
          <Icon name="chevron-down" size={18} color={PURPLE} />
        </Pressable>

        <View style={styles.infoCard}>
          <View style={styles.infoCol}>
            <View style={styles.infoIcon}>
              <Icon name="create-outline" size={16} color={PURPLE} />
            </View>
            <Text style={styles.infoTitle}>
              {t('createTonight.editTitle')}
            </Text>
            <Text style={styles.infoHint}>{t('createTonight.editHint')}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <View style={styles.infoIcon}>
              <Icon name="time-outline" size={16} color={PURPLE} />
            </View>
            <Text style={styles.infoTitle}>
              {t('createTonight.liveTitle')}
            </Text>
            <Text style={styles.infoHint}>{t('createTonight.liveHint')}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={create}
          disabled={!activity || busy}
          style={[styles.ctaWrap, (!activity || busy) && styles.ctaDisabled]}
        >
          <LinearGradient
            colors={[PURPLE, PURPLE_SOFT, PURPLE_DEEP]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cta}
          >
            {busy ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <>
                <Icon name="sparkles" size={18} color={palette.white} />
                <Text style={styles.ctaLabel}>
                  {editing
                    ? t('createTonight.update')
                    : t('createTonight.create')}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      <OptionSheet
        visible={picker === 'activity'}
        title={t('createTonight.planningLabel')}
        options={activityOptions}
        selected={activity}
        onClose={() => setPicker(null)}
        onSelect={key => setActivity(key as FreeTonightActivity)}
      />
      <OptionSheet
        visible={picker === 'time'}
        title={t('createTonight.timeLabel')}
        options={timeOptions}
        selected={time}
        onClose={() => setPicker(null)}
        onSelect={setTime}
      />
      <BusyOverlay
        visible={busy}
        message={
          deleting
            ? t('createTonight.deleting')
            : updating
              ? t('createTonight.updating')
              : t('createTonight.creating')
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
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1A1230',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  headerSpacer: {
    width: 42,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHero: {
    height: 280,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A0F2E',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  profileHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  profileHeroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  profileHeroCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 10,
  },
  profileName: {
    color: palette.white,
    fontSize: fontSize(26),
    fontWeight: '800',
  },
  profilePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  livePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PURPLE,
  },
  livePillText: {
    color: palette.white,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  activityPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  activityPillText: {
    color: palette.white,
    fontSize: fontSize(12),
    fontWeight: '700',
  },
  lookingValue: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '600',
    lineHeight: 21,
  },
  endsNote: {
    color: PURPLE,
    fontSize: fontSize(13),
    fontWeight: '700',
    textAlign: 'center',
  },
  mineActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: PURPLE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editText: {
    color: palette.white,
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  deleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: {
    color: '#FF6B6B',
    fontSize: fontSize(15),
    fontWeight: '800',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  titleAccent: {
    color: PURPLE,
  },
  subtitle: {
    marginTop: 4,
    color: '#9A93A8',
    fontSize: fontSize(12),
    fontWeight: '500',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  hero: {
    height: 156,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: BORDER,
    overflow: 'hidden',
    backgroundColor: '#1A0F2E',
    shadowColor: PURPLE,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCopy: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '72%',
    zIndex: 2,
    elevation: 2,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 8,
    justifyContent: 'center',
  },
  heroTitle: {
    color: palette.white,
    fontSize: fontSize(20),
    fontWeight: '800',
    lineHeight: 26,
  },
  heroTitleAccent: {
    color: PURPLE,
  },
  heroHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize(12),
    fontWeight: '500',
    lineHeight: 17,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(181,108,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(181,108,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCopy: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    color: '#8E879B',
    fontSize: fontSize(12),
    fontWeight: '500',
  },
  fieldValue: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  fieldPlaceholder: {
    color: colors.textPrimary,
  },
  infoCard: {
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  infoCol: {
    flex: 1,
    gap: 6,
    paddingHorizontal: 4,
  },
  infoDivider: {
    width: 1,
    backgroundColor: 'rgba(181,108,255,0.35)',
    marginHorizontal: 8,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(181,108,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  infoTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '800',
  },
  infoHint: {
    color: '#8E879B',
    fontSize: fontSize(11),
    fontWeight: '500',
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  ctaWrap: {
    borderRadius: 999,
    shadowColor: PURPLE,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  cta: {
    height: 56,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaLabel: {
    color: palette.white,
    fontSize: fontSize(17),
    fontWeight: '800',
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '58%',
    backgroundColor: '#1A1428',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray650,
    marginBottom: 14,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(17),
    fontWeight: '800',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  optionRowOn: {
    backgroundColor: 'rgba(181,108,255,0.14)',
  },
  optionEmoji: {
    fontSize: fontSize(18),
  },
  optionLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '600',
  },
  optionLabelOn: {
    color: PURPLE,
  },
});
