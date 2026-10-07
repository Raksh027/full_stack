import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {
  GradientOutline,
  Icon,
  TextField,
} from '@/shared/components';
import type { Photo } from '@/shared/types/api';
import { colors, fontSize, palette } from '@/theme';

const AVATAR_SIZE = 120;

type Props = {
  name: string;
  email: string | null;
  birthDateLabel: string | undefined;
  age: number | null;
  mainPhoto: Photo | undefined;
  lockHint?: string | null;
  onNameChange: (value: string) => void;
  onOpenPhotos: () => void;
  onPressChangeEmail: () => void;
};

export function PersonalInfoPanel({
  name,
  email,
  birthDateLabel,
  age,
  mainPhoto,
  lockHint,
  onNameChange,
  onOpenPhotos,
  onPressChangeEmail,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.editProfileTabs.photos')}
        onPress={onOpenPhotos}
        style={({ pressed }) => [styles.avatarHit, pressed && styles.pressed]}
      >
        <GradientOutline
          radius={AVATAR_SIZE / 2}
          thickness={2}
          style={styles.avatarRing}
          innerStyle={styles.avatarInner}
        >
          {mainPhoto ? (
            <Image
              source={{ uri: mainPhoto.url }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="person" size={42} color={colors.textMuted} />
            </View>
          )}
        </GradientOutline>
      </Pressable>

      <View style={styles.field}>
        <Text style={styles.label}>{t('settings.editProfileFields.name')}</Text>
        <TextField
          variant="gradient"
          value={name}
          onChangeText={onNameChange}
          placeholder={t('onboarding.basicInfo.namePlaceholder')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('settings.editProfileFields.email')}</Text>
        <TextField
          variant="gradient"
          value={email ?? ''}
          editable={false}
          placeholder={t('settings.editProfileFields.emailPlaceholder')}
          right={
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onPressChangeEmail}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.change}>{t('settings.emailChange.change')}</Text>
            </Pressable>
          }
        />
        {lockHint ? <Text style={styles.lockHint}>{lockHint}</Text> : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          {t('settings.editProfileFields.dateOfBirth')}
        </Text>
        <LinearGradient
          colors={[...colors.gradientBorder]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.dobBorder}
        >
          <View style={styles.dobField}>
            <Text
              style={[styles.dobValue, !birthDateLabel && styles.dobPlaceholder]}
              numberOfLines={1}
            >
              {birthDateLabel ??
                t('onboarding.basicInfo.birthDatePlaceholder')}
            </Text>
            <Icon name="calendar-outline" size={20} color={colors.textPrimary} />
          </View>
        </LinearGradient>
        {age !== null ? (
          <Text style={styles.ageText}>
            {t('onboarding.basicInfo.age', { age })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    gap: 16,
  },
  avatarHit: {
    alignSelf: 'center',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginTop: 0,
    marginBottom: 4,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    backgroundColor: palette.gray900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: AVATAR_SIZE - 4,
    height: AVATAR_SIZE - 4,
    borderRadius: (AVATAR_SIZE - 4) / 2,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '600',
  },
  dobBorder: {
    borderRadius: 999,
    padding: 1.5,
  },
  dobField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#101010',
    gap: 10,
  },
  dobValue: {
    flex: 1,
    fontSize: fontSize(15),
    color: colors.textPrimary,
    fontWeight: '600',
  },
  dobPlaceholder: {
    color: colors.textDisabled,
    fontWeight: '500',
  },
  ageText: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    marginTop: 4,
  },
  change: {
    color: palette.pink,
    fontSize: fontSize(13),
    fontWeight: '700',
    paddingRight: 4,
  },
  lockHint: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
    marginTop: 4,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
