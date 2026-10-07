import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { PROFILE_RULES } from '@/config/constants';
import { selectSessionUser } from '@/features/auth/store/authSlice';
import {
  useDeletePhotoMutation,
  useGetEmailChangeStatusQuery,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} from '@/features/profile/api/profileApi';
import { usePhotoUpload } from '@/features/profile/hooks/usePhotoUpload';
import { INTEREST_OPTIONS, WORK_OPTIONS } from '@/features/profile/constants/profileOptions';
import type {
  Gender,
  Lifestyle,
  RelationshipGoal,
  SexualOrientation,
  WorkCategory,
} from '@/features/profile/types';
import type { RootStackScreenProps } from '@/navigation/types';
import { ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { calculateAge, parseISODate } from '@/shared/utils/date';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme';

import { EditProfileHeader } from '../components/editProfile/EditProfileHeader';
import { EditProfileTabs } from '../components/editProfile/EditProfileTabs';
import { ChangeEmailSheet } from '../components/editProfile/ChangeEmailSheet';
import { GenderPanel } from '../components/editProfile/GenderPanel';
import { LifestylePanel } from '../components/editProfile/LifestylePanel';
import { LookingForPanel } from '../components/editProfile/LookingForPanel';
import { OrientationPanel } from '../components/editProfile/OrientationPanel';
import { PersonalInfoPanel } from '../components/editProfile/PersonalInfoPanel';
import {
  PhotosPanel,
  confirmPhotoSlotAction,
} from '../components/editProfile/PhotosPanel';
import type { EditProfileTab } from '../components/editProfile/types';

type Props = RootStackScreenProps<'EditProfile'>;

const DEFAULT_HEIGHT_CM = 175;
const PHOTO_SLOTS = Math.min(PROFILE_RULES.maxPhotos, 6);

export function EditProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const sessionUser = useAppSelector(selectSessionUser);
  const { data: profile, isLoading } = useGetMyProfileQuery();
  const { data: emailStatus } = useGetEmailChangeStatusQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateMyProfileMutation();
  const [deletePhoto] = useDeletePhotoMutation();
  const { pickAndUpload, pickAndUploadMany } = usePhotoUpload();

  const [tab, setTab] = useState<EditProfileTab>('personal');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [sexualOrientation, setSexualOrientation] =
    useState<SexualOrientation | null>(null);
  const [relationshipGoal, setRelationshipGoal] =
    useState<RelationshipGoal | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [workCategory, setWorkCategory] = useState<WorkCategory | null>(null);
  const [bodyType, setBodyType] = useState<Lifestyle['bodyType']>(null);
  const [heightCm, setHeightCm] = useState(DEFAULT_HEIGHT_CM);
  const [drinking, setDrinking] = useState<Lifestyle['drinking']>(null);
  const [workout, setWorkout] = useState<Lifestyle['workout']>(null);
  const [personality, setPersonality] =
    useState<Lifestyle['personality']>(null);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);

  useEffect(() => {
    if (!profile || hydrated) {
      return;
    }
    const removedInterests = new Set([
      'cooking',
      'food',
      'wine',
      'reading',
      'pets',
    ]);
    setName(profile.name ?? '');
    setGender(profile.gender);
    setSexualOrientation(profile.sexualOrientation);
    setRelationshipGoal(profile.relationshipGoal);
    setInterests(
      profile.interests
        .filter(item => !removedInterests.has(item))
        .map(item => (item === 'art' ? 'party' : item))
        .filter(item => INTEREST_OPTIONS.some(opt => opt.value === item)),
    );
    setLanguages(profile.languages ?? []);
    setWorkCategory(
      profile.workCategory &&
        WORK_OPTIONS.some(option => option.value === profile.workCategory)
        ? profile.workCategory
        : null,
    );
    setBodyType(profile.lifestyle.bodyType);
    setHeightCm(profile.heightCm ?? DEFAULT_HEIGHT_CM);
    setDrinking(profile.lifestyle.drinking);
    setWorkout(profile.lifestyle.workout);
    setPersonality(profile.lifestyle.personality);
    setHydrated(true);
  }, [profile, hydrated]);

  const photos = useMemo(
    () => [...(profile?.photos ?? [])].sort((a, b) => a.position - b.position),
    [profile?.photos],
  );
  const mainPhoto = photos[0];
  const birthDate = profile?.birthDate
    ? parseISODate(profile.birthDate)
    : null;
  const age = birthDate ? calculateAge(birthDate) : null;
  const birthDateLabel = birthDate
    ? `${birthDate.getDate()}-${birthDate.getMonth() + 1}-${birthDate.getFullYear()}`
    : undefined;
  const genderLocked = Boolean(profile?.gender);

  const canSave =
    hydrated &&
    name.trim().length >= PROFILE_RULES.minNameLength &&
    !isSaving &&
    busySlot === null;

  const toggleInterest = useCallback((value: string) => {
    setInterests(current => {
      if (current.includes(value)) {
        return current.filter(item => item !== value);
      }
      if (current.length >= PROFILE_RULES.maxInterests) {
        return current;
      }
      return [...current, value];
    });
  }, []);

  const toggleLanguage = useCallback((value: string) => {
    setLanguages(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value],
    );
  }, []);

  const runInSlot = async (slot: number, task: () => Promise<unknown>) => {
    setBusySlot(slot);
    try {
      await task();
    } catch (error) {
      showErrorAlert(error);
    } finally {
      setBusySlot(null);
    }
  };

  const handlePhotoSlot = (slot: number) => {
    const photo = photos[slot];
    if (!photo) {
      runInSlot(slot, () =>
        pickAndUploadMany('library', PHOTO_SLOTS - photos.length),
      );
      return;
    }
    confirmPhotoSlotAction(
      {
        title: t('onboarding.photos.manageTitle'),
        message: t('onboarding.photos.manageMessage'),
        cancel: t('common.cancel'),
        replace: t('onboarding.photos.replace'),
        remove: t('onboarding.photos.remove'),
      },
      {
        onReplace: () =>
          runInSlot(slot, async () => {
            const uploaded = await pickAndUpload('library');
            if (uploaded) {
              await deletePhoto(photo.id).unwrap();
            }
          }),
        onRemove: () => runInSlot(slot, () => deletePhoto(photo.id).unwrap()),
      },
    );
  };

  const emailLockHint =
    emailStatus && !emailStatus.canChange
      ? t('settings.emailChange.lockedHint', {
          count: emailStatus.daysRemaining,
          date: emailStatus.nextChangeAt
            ? new Date(emailStatus.nextChangeAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '',
        })
      : null;

  const handleChangeEmail = () => {
    if (emailStatus && !emailStatus.canChange) {
      Alert.alert(
        t('settings.emailChange.lockedTitle'),
        t('settings.emailChange.lockedBody', {
          count: emailStatus.daysRemaining,
          date: emailStatus.nextChangeAt
            ? new Date(emailStatus.nextChangeAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '',
        }),
      );
      return;
    }
    setEmailSheetOpen(true);
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    try {
      await updateProfile({
        name: name.trim(),
        gender: gender ?? undefined,
        sexualOrientation: sexualOrientation ?? undefined,
        relationshipGoal: relationshipGoal ?? undefined,
        interests,
        languages,
        workCategory,
        heightCm,
        lifestyle: { bodyType, drinking, workout, personality },
      }).unwrap();
      Alert.alert(t('common.success'), t('settings.editProfileSaved'));
    } catch (error) {
      showErrorAlert(error);
    }
  };

  if (isLoading && !profile) {
    return (
      <ScreenContainer style={styles.loading}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} edges={['top', 'left', 'right']}>
      <EditProfileHeader
        title={t('settings.editProfileTitle')}
        saveLabel={t('common.save')}
        saving={isSaving}
        canSave={canSave}
        onBack={() => navigation.goBack()}
        onSave={handleSave}
      />

      <EditProfileTabs active={tab} onChange={setTab} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {tab === 'personal' ? (
          <PersonalInfoPanel
            name={name}
            email={sessionUser?.email ?? null}
            birthDateLabel={birthDateLabel}
            age={age}
            mainPhoto={mainPhoto}
            lockHint={emailLockHint}
            onNameChange={setName}
            onOpenPhotos={() => setTab('photos')}
            onPressChangeEmail={handleChangeEmail}
          />
        ) : null}

        {tab === 'lifestyle' ? (
          <LifestylePanel
            interests={interests}
            languages={languages}
            workCategory={workCategory}
            bodyType={bodyType}
            heightCm={heightCm}
            drinking={drinking}
            workout={workout}
            personality={personality}
            onToggleInterest={toggleInterest}
            onToggleLanguage={toggleLanguage}
            onWorkChange={setWorkCategory}
            onBodyTypeChange={setBodyType}
            onHeightChange={setHeightCm}
            onDrinkingChange={setDrinking}
            onWorkoutChange={setWorkout}
            onPersonalityChange={setPersonality}
          />
        ) : null}

        {tab === 'lookingFor' ? (
          <LookingForPanel
            goal={relationshipGoal}
            onChange={setRelationshipGoal}
          />
        ) : null}

        {tab === 'orientation' ? (
          <OrientationPanel
            value={sexualOrientation}
            onChange={setSexualOrientation}
          />
        ) : null}

        {tab === 'photos' ? (
          <PhotosPanel
            photos={photos}
            busySlot={busySlot}
            onSlotPress={handlePhotoSlot}
          />
        ) : null}

        {tab === 'gender' ? (
          <GenderPanel
            gender={gender}
            locked={genderLocked}
            onChange={setGender}
          />
        ) : null}
      </ScrollView>
      <ChangeEmailSheet
        visible={emailSheetOpen}
        currentEmail={sessionUser?.email ?? null}
        onClose={() => setEmailSheetOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
});
