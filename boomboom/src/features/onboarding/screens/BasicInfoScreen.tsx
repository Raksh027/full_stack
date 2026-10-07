import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { PROFILE_RULES } from '@/config/constants';
import {
  useDeletePhotoMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} from '@/features/profile/api/profileApi';
import { usePhotoUpload } from '@/features/profile/hooks/usePhotoUpload';
import {
  basicInfoSchema,
  type BasicInfoForm,
} from '@/features/profile/schemas';
import {
  GradientOutline,
  Icon,
  ScreenContainer,
  TextField,
  type IconName,
} from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { calculateAge, parseISODate, toISODate } from '@/shared/utils/date';
import { handleFormSubmitError } from '@/shared/utils/forms';
import { colors, fontSize, palette } from '@/theme';

import { DateOfBirthPicker } from '../components/DateOfBirthPicker';
import { GenderPicker } from '../components/GenderPicker';
import { GradientSelectField } from '../components/GradientSelectField';
import { MediaToggle, type MediaMode } from '../components/MediaToggle';
import { OnboardingNextButton } from '../components/OnboardingNextButton';
import { PermanentFieldWarning } from '../components/PermanentFieldWarning';
import { PhotoThumbnails } from '../components/PhotoThumbnails';
import { useOnboardingNavigation } from '../hooks/useOnboardingNavigation';

const AVATAR_SIZE = 112;

export function BasicInfoScreen() {
  const { t, i18n } = useTranslation();
  const { goToNextStep } = useOnboardingNavigation();
  const { data: profile } = useGetMyProfileQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [updateProfile, { isLoading: isSaving }] = useUpdateMyProfileMutation();
  const [deletePhoto] = useDeletePhotoMutation();
  const { isUploading, promptAndUploadMany, pickVideo } = usePhotoUpload();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isGenderOpen, setGenderOpen] = useState(false);
  const [lockedWarning, setLockedWarning] = useState<'dob' | 'gender' | null>(
    null,
  );
  const [mediaMode, setMediaMode] = useState<MediaMode>('photo');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError } = useForm<BasicInfoForm>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: '',
      birthDate: undefined,
      gender: undefined,
      bio: '',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name ?? '',
        birthDate:
          (profile.birthDate && parseISODate(profile.birthDate)) || undefined,
        gender: profile.gender ?? undefined,
        bio: profile.bio ?? '',
      });
    }
  }, [profile, reset]);

  const [name, birthDate, gender, bio] = useWatch({
    control,
    name: ['name', 'birthDate', 'gender', 'bio'],
  });

  const photos = [...(profile?.photos ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const mainPhoto = photos[0];
  const age = birthDate ? calculateAge(birthDate) : null;
  const nameValid = name.trim().length >= PROFILE_RULES.minNameLength;
  const birthDateValid = Boolean(
    birthDate && age !== null && age >= PROFILE_RULES.minAge,
  );
  const genderValid = Boolean(gender);
  const bioValid = bio.trim().length > 0;
  const photosValid = photos.length >= PROFILE_RULES.minPhotos;
  const canSubmit =
    photosValid &&
    nameValid &&
    birthDateValid &&
    genderValid &&
    bioValid &&
    !isUploading;

  const remainingPhotoSlots = PROFILE_RULES.maxPhotos - photos.length;

  const addPhotos = async () => {
    if (remainingPhotoSlots <= 0) {
      Alert.alert(
        t('onboarding.basicInfo.maxPhotos', { max: PROFILE_RULES.maxPhotos }),
      );
      return;
    }
    await promptAndUploadMany(remainingPhotoSlots);
  };

  const handleAddMedia = async () => {
    if (mediaMode === 'video') {
      const uri = await pickVideo();
      if (uri) {
        setVideoUri(uri);
      }
      return;
    }
    await addPhotos();
  };

  const handleModeChange = async (mode: MediaMode) => {
    setMediaMode(mode);
    if (mode === 'video') {
      const uri = await pickVideo();
      if (uri) {
        setVideoUri(uri);
      }
      return;
    }
    await addPhotos();
  };

  const handleRemovePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId).unwrap();
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const onSubmit = handleSubmit(async values => {
    if (!canSubmit) {
      return;
    }
    try {
      await updateProfile({
        name: values.name,
        birthDate: toISODate(values.birthDate),
        gender: values.gender,
        bio: values.bio.trim() || null,
      }).unwrap();
      goToNextStep();
    } catch (error) {
      handleFormSubmitError(error, setError, [
        'name',
        'birthDate',
        'gender',
        'bio',
      ]);
    }
  });

  const showAvatarVideo = mediaMode === 'video' && Boolean(videoUri);

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>
                {t('onboarding.basicInfo.title')}
              </Text>
              <Text style={styles.sparkle}>✦</Text>
              <Text style={styles.plus}>+</Text>
            </View>
            <Text style={styles.subtitle}>
              {t('onboarding.basicInfo.subtitle')}
            </Text>
            <LinearGradient
              colors={[colors.accent, palette.purple]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.underline}
            />
          </View>

          <View style={styles.mediaSection}>
            <View style={styles.avatarHit}>
              <Pressable
                accessibilityRole="button"
                onPress={handleAddMedia}
                disabled={isUploading}
                style={({ pressed }) => pressed && styles.avatarPressed}
              >
                <GradientOutline
                  radius={AVATAR_SIZE / 2}
                  style={styles.avatarRing}
                  innerStyle={styles.avatarInner}
                >
                  {isUploading ? (
                    <ActivityIndicator
                      size="large"
                      color={colors.textPrimary}
                    />
                  ) : showAvatarVideo ? (
                    <View style={styles.avatarPlaceholder}>
                      <Icon
                        name="videocam"
                        size={36}
                        color={colors.textPrimary}
                      />
                    </View>
                  ) : mainPhoto ? (
                    <Image
                      source={{ uri: mainPhoto.url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Icon name="person" size={40} color={colors.textMuted} />
                    </View>
                  )}
                </GradientOutline>
              </Pressable>
              <View style={styles.mediaToggle}>
                <MediaToggle
                  mode={mediaMode}
                  photoCount={photos.length}
                  onChange={handleModeChange}
                />
              </View>
            </View>
            <Text style={styles.mediaHint}>
              {t('onboarding.basicInfo.addMedia')}
            </Text>
            <PhotoThumbnails
              photos={photos}
              onAdd={addPhotos}
              onRemove={photo => handleRemovePhoto(photo.id)}
            />
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <View style={styles.fieldBlock}>
                  <FieldLabel icon="person-outline">
                    {t('onboarding.basicInfo.nameLabel')}
                  </FieldLabel>
                  <TextField
                    variant="gradient"
                    leftIcon="person-outline"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    placeholder={t('onboarding.basicInfo.namePlaceholder')}
                    maxLength={PROFILE_RULES.maxNameLength}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    right={
                      nameValid ? (
                        <Icon
                          name="checkmark-circle"
                          size={20}
                          color={colors.success}
                        />
                      ) : field.value.length > 0 ? (
                        <Pressable
                          onPress={() => field.onChange('')}
                          hitSlop={8}
                          style={({ pressed }) => pressed && styles.iconPressed}
                        >
                          <Icon
                            name="close"
                            size={18}
                            color={colors.textDisabled}
                          />
                        </Pressable>
                      ) : null
                    }
                  />
                </View>
              )}
            />

            <Controller
              control={control}
              name="birthDate"
              render={({ field, fieldState }) => (
                <View style={styles.fieldBlock}>
                  <FieldLabel icon="calendar-outline">
                    {t('onboarding.basicInfo.ageLabel')}
                  </FieldLabel>
                  <GradientSelectField
                    leftIcon="calendar-outline"
                    value={
                      field.value
                        ? field.value.toLocaleDateString(i18n.language, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : undefined
                    }
                    placeholder={t('onboarding.basicInfo.birthDatePlaceholder')}
                    onPress={() => setLockedWarning('dob')}
                    valid={birthDateValid}
                  />
                  {age !== null ? (
                    <Text style={styles.ageText}>
                      {t('onboarding.basicInfo.age', { age })}
                      {age < PROFILE_RULES.minAge
                        ? t('onboarding.basicInfo.mustBeAdult')
                        : ''}
                    </Text>
                  ) : null}
                  {fieldState.error ? (
                    <Text style={styles.errorText}>
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                  {isPickerOpen ? (
                    <DateOfBirthPicker
                      visible
                      value={field.value ?? null}
                      onClose={() => setPickerOpen(false)}
                      onConfirm={date => {
                        field.onChange(date);
                        setPickerOpen(false);
                      }}
                    />
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="gender"
              render={({ field, fieldState }) => (
                <View style={styles.fieldBlock}>
                  <FieldLabel icon="male-female-outline">
                    {t('onboarding.basicInfo.genderLabel')}
                  </FieldLabel>
                  <GradientSelectField
                    leftIcon="male-female-outline"
                    value={
                      field.value
                        ? t(`profileOptions.gender.${field.value}`)
                        : undefined
                    }
                    placeholder={t('onboarding.basicInfo.genderPlaceholder')}
                    onPress={() => setLockedWarning('gender')}
                    valid={genderValid}
                  />
                  {fieldState.error ? (
                    <Text style={styles.errorText}>
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                  {isGenderOpen ? (
                    <GenderPicker
                      visible
                      value={field.value ?? null}
                      onClose={() => setGenderOpen(false)}
                      onSelect={selected => {
                        field.onChange(selected);
                        setGenderOpen(false);
                      }}
                    />
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="bio"
              render={({ field, fieldState }) => (
                <View style={styles.fieldBlock}>
                  <FieldLabel icon="menu-outline">
                    {t('onboarding.basicInfo.bioLabel')}
                  </FieldLabel>
                  <TextField
                    variant="gradient"
                    leftIcon="menu-outline"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    placeholder={t('onboarding.basicInfo.bioPlaceholder')}
                    maxLength={PROFILE_RULES.maxBioLength}
                    autoCapitalize="sentences"
                    multiline
                    numberOfLines={3}
                    returnKeyType="default"
                    blurOnSubmit={false}
                    right={
                      bioValid ? (
                        <Icon
                          name="checkmark-circle"
                          size={20}
                          color={colors.success}
                        />
                      ) : null
                    }
                  />
                </View>
              )}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <OnboardingNextButton
            onPress={() => onSubmit()}
            ready={canSubmit}
            loading={isSaving}
          />
        </View>
      </KeyboardAvoidingView>

      <PermanentFieldWarning
        visible={lockedWarning !== null}
        icon="warning-outline"
        title={
          lockedWarning === 'gender'
            ? t('onboarding.basicInfo.genderWarningTitle')
            : t('onboarding.basicInfo.dobWarningTitle')
        }
        message={
          lockedWarning === 'gender'
            ? t('onboarding.basicInfo.genderWarningMessage')
            : t('onboarding.basicInfo.dobWarningMessage')
        }
        confirmLabel={t('onboarding.basicInfo.warningGotIt')}
        onConfirm={() => {
          if (lockedWarning === 'dob') {
            setPickerOpen(true);
          } else if (lockedWarning === 'gender') {
            setGenderOpen(true);
          }
          setLockedWarning(null);
        }}
      />
    </ScreenContainer>
  );
}

function FieldLabel({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={styles.fieldLabel}>
      <Icon name={icon} size={15} color={colors.textSecondary} />
      <Text style={styles.fieldLabelText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 0,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
  },
  header: {
    marginBottom: 20,
  },
  titleWrap: {
    alignSelf: 'flex-start',
    paddingRight: 22,
  },
  title: {
    fontSize: fontSize(30),
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  sparkle: {
    position: 'absolute',
    right: -16,
    top: -6,
    color: colors.textPrimary,
    fontSize: 14,
  },
  plus: {
    position: 'absolute',
    right: -18,
    bottom: 6,
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    fontSize: fontSize(16),
    color: colors.textSecondary,
  },
  underline: {
    width: 52,
    height: 3,
    borderRadius: 2,
    marginTop: 10,
  },
  mediaSection: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  avatarHit: {
    alignItems: 'center',
  },
  avatarPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarInner: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaToggle: {
    position: 'absolute',
    right: -36,
    bottom: 6,
  },
  mediaHint: {
    fontSize: fontSize(13),
    color: colors.textSecondary,
  },
  form: {
    gap: 14,
  },
  iconPressed: {
    opacity: 0.65,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  fieldLabelText: {
    flex: 1,
    fontSize: fontSize(13),
    color: colors.textSecondary,
  },
  ageText: {
    fontSize: fontSize(13),
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: fontSize(12),
    paddingHorizontal: 4,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 4 : 12,
  },
});
