const MOCK_UPLOAD_PREFIX = 'mock://upload/';

// Local file URIs keyed by photo id, standing in for object storage.
const uploadedFiles = new Map<string, string>();

export function mockUploadUrl(photoId: string) {
  return `${MOCK_UPLOAD_PREFIX}${photoId}`;
}

export function isMockUploadUrl(url: string) {
  return url.startsWith(MOCK_UPLOAD_PREFIX);
}

export function storeMockUpload(uploadUrl: string, fileUri: string) {
  uploadedFiles.set(uploadUrl.slice(MOCK_UPLOAD_PREFIX.length), fileUri);
}

export function takeMockUpload(photoId: string): string | undefined {
  const uri = uploadedFiles.get(photoId);
  uploadedFiles.delete(photoId);
  return uri;
}
