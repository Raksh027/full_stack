import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/shared/components';
import type { Photo } from '@/shared/types/api';
import { colors } from '@/theme';

type Props = {
  photo: Photo | undefined;
  size: number;
  isRequired: boolean;
  isUploading: boolean;
  isLocked: boolean;
  onPress: () => void;
};

export function PhotoSlot({
  photo,
  size,
  isRequired,
  isUploading,
  isLocked,
  onPress,
}: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        photo ? t('onboarding.photos.manageTitle') : t('onboarding.photos.add')
      }
      onPress={onPress}
      disabled={isLocked || isUploading}
      style={[
        styles.slot,
        { width: size, height: size },
        isLocked && styles.locked,
      ]}
    >
      {isUploading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.uploadingText}>
            {t('onboarding.photos.uploading')}
          </Text>
        </View>
      ) : photo ? (
        <>
          <Image source={{ uri: photo.url }} style={styles.photo} />
          {isRequired ? (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredBadgeText}>
                {t('onboarding.photos.required')}
              </Text>
            </View>
          ) : null}
        </>
      ) : isLocked ? (
        <View style={styles.center}>
          <Icon name="lock-closed" size={40} color={colors.textDisabled} />
          <Text style={styles.lockedText}>
            {t('onboarding.photos.waitForUpload')}
          </Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Icon name="add" size={40} color="#777" />
          <Text style={styles.addText}>
            {isRequired
              ? t('onboarding.photos.addRequired')
              : t('onboarding.photos.add')}
          </Text>
          {isRequired ? (
            <Text style={styles.requiredText}>
              {t('onboarding.photos.required')}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  locked: {
    opacity: 0.5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  requiredBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  requiredBadgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  uploadingText: {
    color: colors.textPrimary,
    marginTop: 10,
    fontSize: 12,
  },
  lockedText: {
    color: colors.textDisabled,
    marginTop: 8,
    fontSize: 12,
  },
  addText: {
    color: '#777',
    marginTop: 8,
    fontSize: 12,
  },
  requiredText: {
    color: colors.accent,
    marginTop: 4,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
