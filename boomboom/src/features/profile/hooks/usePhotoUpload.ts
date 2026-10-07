import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

import { logger } from '@/services/logger/logger';
import type { Photo } from '@/shared/types/api';
import { showErrorAlert } from '@/shared/utils/alerts';
import { useAppDispatch } from '@/store/hooks';

import { uploadProfilePhoto } from '../services/photoUpload';

export type PhotoSource = 'camera' | 'library';

const BASE_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 0.8 as const,
  maxWidth: 1080,
  maxHeight: 1080,
};

async function pickAssets(
  source: PhotoSource,
  selectionLimit = 1,
): Promise<Asset[]> {
  const response =
    source === 'camera'
      ? await launchCamera(BASE_OPTIONS satisfies CameraOptions)
      : await launchImageLibrary({
          ...BASE_OPTIONS,
          selectionLimit,
        } satisfies ImageLibraryOptions);

  if (response.didCancel) {
    return [];
  }
  if (response.errorCode) {
    throw new Error(response.errorMessage ?? response.errorCode);
  }
  return (response.assets ?? []).filter(asset => Boolean(asset.uri));
}

export function usePhotoUpload() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [isUploading, setIsUploading] = useState(false);

  const uploadAssets = useCallback(
    async (assets: Asset[]): Promise<Photo[]> => {
      const uploaded: Photo[] = [];
      for (const asset of assets) {
        if (!asset.uri) {
          continue;
        }
        uploaded.push(
          await uploadProfilePhoto(dispatch, {
            uri: asset.uri,
            contentType: asset.type ?? 'image/jpeg',
            fileSize: asset.fileSize ?? 0,
          }),
        );
      }
      return uploaded;
    },
    [dispatch],
  );

  const pickAndUpload = useCallback(
    async (source: PhotoSource): Promise<Photo | null> => {
      try {
        const [asset] = await pickAssets(source, 1);
        if (!asset?.uri) {
          return null;
        }
        setIsUploading(true);
        const [photo] = await uploadAssets([asset]);
        return photo ?? null;
      } catch (error) {
        logger.error('Photo upload failed', error);
        showErrorAlert(error, t('onboarding.photoSource.uploadFailed'));
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [t, uploadAssets],
  );

  const pickAndUploadMany = useCallback(
    async (source: PhotoSource, remaining: number): Promise<Photo[]> => {
      const selectionLimit = Math.max(1, remaining);
      try {
        const assets = await pickAssets(
          source,
          source === 'library' ? selectionLimit : 1,
        );
        if (assets.length === 0) {
          return [];
        }
        setIsUploading(true);
        return await uploadAssets(assets.slice(0, selectionLimit));
      } catch (error) {
        logger.error('Photo upload failed', error);
        showErrorAlert(error, t('onboarding.photoSource.uploadFailed'));
        return [];
      } finally {
        setIsUploading(false);
      }
    },
    [t, uploadAssets],
  );

  const promptAndUploadMany = useCallback(
    (remaining: number) =>
      new Promise<Photo[]>(resolve => {
        Alert.alert(
          t('onboarding.photoSource.title'),
          t('onboarding.photoSource.message', { remaining }),
          [
            {
              text: t('onboarding.photoSource.camera'),
              onPress: () => resolve(pickAndUploadMany('camera', remaining)),
            },
            {
              text: t('onboarding.photoSource.library'),
              onPress: () => resolve(pickAndUploadMany('library', remaining)),
            },
            {
              text: t('common.cancel'),
              style: 'cancel',
              onPress: () => resolve([]),
            },
          ],
        );
      }),
    [pickAndUploadMany, t],
  );

  const pickVideo = useCallback(async (): Promise<string | null> => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'video',
        videoQuality: 'medium',
        formatAsMp4: true,
        selectionLimit: 1,
      });
      if (response.didCancel) {
        return null;
      }
      if (response.errorCode) {
        throw new Error(response.errorMessage ?? response.errorCode);
      }
      return response.assets?.[0]?.uri ?? null;
    } catch (error) {
      logger.error('Video pick failed', error);
      showErrorAlert(error, t('onboarding.basicInfo.videoFailed'));
      return null;
    }
  }, [t]);

  return {
    isUploading,
    pickAndUpload,
    pickAndUploadMany,
    promptAndUploadMany,
    pickVideo,
  };
}
