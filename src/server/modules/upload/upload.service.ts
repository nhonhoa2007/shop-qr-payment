import crypto from 'node:crypto';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export interface FileValidationInput {
  size: number;
  type: string;
}

export function validateImageFile(file: FileValidationInput): { valid: boolean; error?: string } {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    return { valid: false, error: 'Vui lòng chọn file ảnh để tải lên' };
  }

  if (file.size > MAX_UPLOAD_FILE_SIZE) {
    return { valid: false, error: 'Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.' };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'Định dạng file không được hỗ trợ. Vui lòng tải lên ảnh JPG, PNG, WEBP hoặc GIF.',
    };
  }

  return { valid: true };
}

export function verifyImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;

  const hex = buffer.toString('hex', 0, 12).toLowerCase();

  // JPEG starts with ffd8ff
  if (hex.startsWith('ffd8ff')) return true;

  // PNG starts with 89504e470d0a1a0a
  if (hex.startsWith('89504e47')) return true;

  // GIF starts with 47494638 ('GIF8')
  if (hex.startsWith('47494638')) return true;

  // WEBP starts with 52494646 ('RIFF') and has 'WEBP' at offset 8 (57454250)
  if (hex.startsWith('52494646') && hex.includes('57454250')) return true;

  return false;
}

export function parseCloudinaryUrl(urlStr: string): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} | null {
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== 'cloudinary:' || !parsed.username || !parsed.password || !parsed.hostname) {
      return null;
    }
    return {
      cloudName: parsed.hostname,
      apiKey: decodeURIComponent(parsed.username),
      apiSecret: decodeURIComponent(parsed.password),
    };
  } catch {
    return null;
  }
}

export function getCloudinaryConfig(env: Record<string, string | undefined> = process.env): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} | null {
  let cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  let apiKey = env.CLOUDINARY_API_KEY?.trim();
  let apiSecret = env.CLOUDINARY_API_SECRET?.trim();

  if ((!cloudName || !apiKey || !apiSecret) && env.CLOUDINARY_URL?.trim()) {
    const fromUrl = parseCloudinaryUrl(env.CLOUDINARY_URL.trim());
    if (fromUrl) {
      cloudName = cloudName || fromUrl.cloudName;
      apiKey = apiKey || fromUrl.apiKey;
      apiSecret = apiSecret || fromUrl.apiSecret;
    }
  }

  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret };
  }

  return null;
}

export function generateCloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const sortedParamString = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
  return crypto.createHash('sha1').update(sortedParamString + apiSecret).digest('hex');
}

export function generateSafeUploadFilename(originalName: string, mimeType?: string): string {
  const extensionFromMime = mimeType ? MIME_EXTENSION_MAP[mimeType] : undefined;
  const dotIndex = originalName.lastIndexOf('.');
  const rawExt = dotIndex !== -1 ? originalName.slice(dotIndex).toLowerCase() : '';
  const ext = extensionFromMime || rawExt || '.png';

  const rawBase = (dotIndex !== -1 ? originalName.slice(0, dotIndex) : originalName)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 30);

  const uniqueId = crypto.randomBytes(6).toString('hex');
  const timestamp = Date.now();

  return `${rawBase ? `${rawBase}-` : ''}${timestamp}-${uniqueId}${ext}`;
}
