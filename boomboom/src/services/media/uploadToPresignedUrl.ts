import {
  isMockUploadUrl,
  storeMockUpload,
} from '@/services/api/mock/mockMedia';

type UploadParams = {
  uploadUrl: string;
  fileUri: string;
  contentType: string;
  headers?: Record<string, string>;
};

export async function uploadToPresignedUrl({
  uploadUrl,
  fileUri,
  contentType,
  headers,
}: UploadParams): Promise<void> {
  if (isMockUploadUrl(uploadUrl)) {
    storeMockUpload(uploadUrl, fileUri);
    return;
  }

  const file = await fetch(fileUri);
  const body = await file.blob();

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, ...headers },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}
