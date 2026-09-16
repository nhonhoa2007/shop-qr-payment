import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImageFile,
  verifyImageMagicBytes,
  parseCloudinaryUrl,
  getCloudinaryConfig,
  generateCloudinarySignature,
  generateSafeUploadFilename,
  MAX_UPLOAD_FILE_SIZE,
} from '../src/lib/upload-utils.ts';

describe('Image Upload Validation Logic', () => {
  it('should validate valid image mime types and sizes', () => {
    const validJpg = validateImageFile({ size: 1024 * 500, type: 'image/jpeg' });
    assert.equal(validJpg.valid, true);

    const validPng = validateImageFile({ size: 1024 * 1024, type: 'image/png' });
    assert.equal(validPng.valid, true);

    const validWebp = validateImageFile({ size: 1024 * 200, type: 'image/webp' });
    assert.equal(validWebp.valid, true);

    const validGif = validateImageFile({ size: 1024 * 800, type: 'image/gif' });
    assert.equal(validGif.valid, true);
  });

  it('should verify binary magic bytes correctly', () => {
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    assert.equal(verifyImageMagicBytes(pngBuffer), true);

    // JPEG magic bytes: FF D8 FF
    const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    assert.equal(verifyImageMagicBytes(jpgBuffer), true);

    // GIF magic bytes: 47 49 46 38
    const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
    assert.equal(verifyImageMagicBytes(gifBuffer), true);

    // Fake text / php script disguised as png
    const fakeBuffer = Buffer.from('<?php echo "evil"; ?>');
    assert.equal(verifyImageMagicBytes(fakeBuffer), false);

    // Short buffer
    assert.equal(verifyImageMagicBytes(Buffer.from([0x89, 0x50])), false);
  });

  it('should reject files exceeding 5MB', () => {
    const largeFile = validateImageFile({
      size: MAX_UPLOAD_FILE_SIZE + 1,
      type: 'image/jpeg',
    });
    assert.equal(largeFile.valid, false);
    assert.match(largeFile.error!, /vượt quá 5MB/);
  });

  it('should reject invalid or unsupported mime types', () => {
    const pdfFile = validateImageFile({ size: 1024, type: 'application/pdf' });
    assert.equal(pdfFile.valid, false);
    assert.match(pdfFile.error!, /không được hỗ trợ/);

    const svgFile = validateImageFile({ size: 1024, type: 'image/svg+xml' });
    assert.equal(svgFile.valid, false);
    assert.match(svgFile.error!, /không được hỗ trợ/);
  });

  it('should reject empty or zero size files', () => {
    const emptyFile = validateImageFile({ size: 0, type: 'image/jpeg' });
    assert.equal(emptyFile.valid, false);
  });
});

describe('Cloudinary Utility Logic', () => {
  it('should parse valid CLOUDINARY_URL correctly', () => {
    const parsed = parseCloudinaryUrl('cloudinary://123456789:abcdef_secret@my-cloud-name');
    assert.deepEqual(parsed, {
      cloudName: 'my-cloud-name',
      apiKey: '123456789',
      apiSecret: 'abcdef_secret',
    });
  });

  it('should return null for malformed CLOUDINARY_URL', () => {
    assert.equal(parseCloudinaryUrl('http://not-cloudinary.com'), null);
    assert.equal(parseCloudinaryUrl('invalid-url'), null);
  });

  it('should resolve Cloudinary config from explicit env variables', () => {
    const config = getCloudinaryConfig({
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
    });
    assert.deepEqual(config, {
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
    });
  });

  it('should resolve Cloudinary config from CLOUDINARY_URL when separate vars are missing', () => {
    const config = getCloudinaryConfig({
      CLOUDINARY_URL: 'cloudinary://key123:sec456@cloud789',
    });
    assert.deepEqual(config, {
      cloudName: 'cloud789',
      apiKey: 'key123',
      apiSecret: 'sec456',
    });
  });

  it('should return null when Cloudinary config is not set', () => {
    const config = getCloudinaryConfig({});
    assert.equal(config, null);
  });

  it('should generate deterministic Cloudinary signature with sorted keys', () => {
    // Parameters: folder=products, timestamp=1700000000, secret=mysecret
    // Sorted: folder=products&timestamp=1700000000 + mysecret
    const sig1 = generateCloudinarySignature(
      { timestamp: 1700000000, folder: 'products' },
      'mysecret'
    );
    const sig2 = generateCloudinarySignature(
      { folder: 'products', timestamp: 1700000000 },
      'mysecret'
    );
    assert.equal(sig1, sig2);
    assert.equal(typeof sig1, 'string');
    assert.equal(sig1.length, 40); // sha1 hex length
  });
});

describe('Safe Upload Filename Generation', () => {
  it('should generate safe unique filename with correct extension', () => {
    const name = generateSafeUploadFilename('Ảnh Sản Phẩm (1)!.jpeg', 'image/jpeg');
    assert.match(name, /^[a-z0-9_]+-\d+-[a-f0-9]+\.jpg$/);
  });

  it('should fallback to mime extension when filename lacks extension', () => {
    const name = generateSafeUploadFilename('blob', 'image/png');
    assert.ok(name.endsWith('.png'));
  });

  it('should sanitize path traversal characters from filename', () => {
    const traversalName = generateSafeUploadFilename('../../../etc/passwd.png', 'image/png');
    assert.ok(!traversalName.includes('..'));
    assert.ok(!traversalName.includes('/'));
    assert.ok(!traversalName.includes('\\'));
    assert.ok(traversalName.endsWith('.png'));
  });
});
