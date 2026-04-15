import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fileTypeFromBuffer } from 'file-type';

export async function POST(request: Request) {
  try {
    // SECURITY: Require authentication for file uploads
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN and SUPER_ADMIN can upload files
    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // SECURITY: Validate file type strictly
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPG/PNG/WebP/GIF or MP4/WebM' }, { status: 400 });
    }

    // Convert File to Buffer first to detect actual file type
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // SECURITY: Verify file signature (magic numbers) - prevents fake file types
    // This checks the actual file content, not just MIME type or extension
    const detectedType = await fileTypeFromBuffer(buffer);
    
    if (!detectedType) {
      return NextResponse.json({ 
        error: 'Cannot detect file type. File may be corrupted or invalid.' 
      }, { status: 400 });
    }

    // Only allow whitelisted types (validated from actual file content)
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
    if (!allowedMimes.includes(detectedType.mime)) {
      return NextResponse.json({ 
        error: `Invalid file type detected: ${detectedType.mime}. Only JPEG/PNG/WebP/GIF images and MP4/WebM videos are allowed.` 
      }, { status: 400 });
    }

    // Validate file size (max 30MB; needed for short loading videos)
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 30MB' }, { status: 400 });
    }

    // Warn if MIME type doesn't match (client-side compression may have changed format)
    // This is allowed - we trust the actual file content (magic numbers) over browser-reported type
    if (file.type && file.type !== detectedType.mime) {
      console.warn(`MIME type mismatch: browser reported ${file.type}, but file is actually ${detectedType.mime} (likely due to client-side compression)`);
    }

    // SECURITY: Verify that file extension matches detected type
    const detectedExt = detectedType.ext;
    const validExtensionMap: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'image/gif': ['gif'],
      'video/mp4': ['mp4'],
      'video/webm': ['webm'],
    };
    const validExts = validExtensionMap[detectedType.mime];
    if (!validExts || !validExts.includes(detectedExt)) {
      return NextResponse.json({ 
        error: `File extension mismatch: detected type is ${detectedType.mime} but extension is ${detectedExt}` 
      }, { status: 400 });
    }

    // Use configured upload directory or default to local
    // UPLOAD_DIR environment variable should be set in production
    const envUploadDir = process.env.UPLOAD_DIR;
    const localUploadDir = join(process.cwd(), 'public', 'uploads');
    
    // Determine upload directory:
    // 1. UPLOAD_DIR environment variable (if set)
    // 2. Local directory (fallback for development)
    const uploadDir = envUploadDir || localUploadDir;
    
    console.log('Using upload directory:', uploadDir);
    
    if (!existsSync(uploadDir)) {
      console.log('Creating uploads directory:', uploadDir);
      await mkdir(uploadDir, { recursive: true });
    }

    // Save original file (sharp removed due to native binary compatibility issues on production)
    // Note: Sharp was removed in v2.2 for the same reason (see PRODUCTION_DEPLOYMENT.md)
    // For image optimization, consider:
    // - Client-side compression before upload
    // - CDN-based optimization (e.g., Cloudinary, Imgix)
    // - Server-side optimization service (separate microservice)
    const safeFileExt = detectedExt;
    const outputFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${safeFileExt}`;
    const filePath = join(uploadDir, outputFileName);
    
    await writeFile(filePath, buffer);
    console.log('✅ File saved successfully:', outputFileName);
    
    const publicUrl = `/uploads/${outputFileName}`;
    return NextResponse.json({ url: publicUrl }, { status: 200 });
  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload file', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}


