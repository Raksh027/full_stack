import type { AppDispatch } from '@/store';
import { uploadToPresignedUrl } from '@/services/media/uploadToPresignedUrl';
import type { Photo } from '@/shared/types/api';

import { profileApi } from '../api/profileApi';

type LocalPhoto = {
  uri: string;
  contentType: string;
  fileSize: number;
};

// Photos go straight to object storage via a presigned URL so image bytes
// never pass through the API servers.
export async function uploadProfilePhoto(
  dispatch: AppDispatch,
  photo: LocalPhoto,
): Promise<Photo> {
  const ticket = await dispatch(
    profileApi.endpoints.requestPhotoUpload.initiate({
      contentType: photo.contentType,
      fileSize: photo.fileSize,
    }),
  ).unwrap();

  await uploadToPresignedUrl({
    uploadUrl: ticket.uploadUrl,
    fileUri: photo.uri,
    contentType: photo.contentType,
    headers: ticket.headers,
  });

  return dispatch(
    profileApi.endpoints.confirmPhotoUpload.initiate(ticket.photoId),
  ).unwrap();
}
