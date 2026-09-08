import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  validateImageFile,
  getCloudinaryConfig,
  generateCloudinarySignature,
  generateSafeUploadFilename,
} from '@/lib/upload-utils';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // 1. Check Authentication & Authorization
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse FormData
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Dữ liệu tải lên không hợp lệ' }, { status: 400 });
    }

    const file = (formData.get('file') || formData.get('image')) as File | null;
    if (!file || typeof file === 'string' || !('size' in file)) {
      return NextResponse.json({ error: 'Vui lòng chọn file ảnh để tải lên' }, { status: 400 });
    }

    // 3. Validate file size and MIME type
    const validation = validateImageFile({
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 4. Check Cloudinary Configuration
    const cloudinaryConfig = getCloudinaryConfig();

    if (cloudinaryConfig) {
      // Cloudinary upload mode
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = 'products';

      const signature = generateCloudinarySignature(
        { folder, timestamp },
        cloudinaryConfig.apiSecret
      );

      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append('file', file);
      cloudinaryFormData.append('api_key', cloudinaryConfig.apiKey);
      cloudinaryFormData.append('timestamp', timestamp.toString());
      cloudinaryFormData.append('folder', folder);
      cloudinaryFormData.append('signature', signature);

      const cloudinaryRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
        {
          method: 'POST',
          body: cloudinaryFormData,
        }
      );

      const cloudinaryData = (await cloudinaryRes.json()) as {
        secure_url?: string;
        url?: string;
        error?: { message?: string };
      };

      if (!cloudinaryRes.ok || (!cloudinaryData.secure_url && !cloudinaryData.url)) {
        console.error('Cloudinary upload error response:', cloudinaryData);
        return NextResponse.json(
          { error: cloudinaryData.error?.message || 'Tải ảnh lên Cloudinary thất bại' },
          { status: 502 }
        );
      }

      const imageUrl = cloudinaryData.secure_url || cloudinaryData.url;
      return NextResponse.json({
        url: imageUrl,
        success: true,
      });
    }

    // 5. Local Storage Fallback (/public/uploads)
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = generateSafeUploadFilename(file.name || 'image', file.type);
    const destinationPath = path.join(uploadsDir, filename);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destinationPath, Buffer.from(arrayBuffer));

    return NextResponse.json({
      url: `/uploads/${filename}`,
      success: true,
    });
  } catch (error: unknown) {
    console.error('Admin upload handler error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi trong quá trình tải ảnh lên';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
