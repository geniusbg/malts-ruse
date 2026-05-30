'use client';

import { useState } from 'react';
import { ThemeInlineFeedback } from '@/components/ThemeInlineFeedback';
import imageCompression from 'browser-image-compression';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  bucket: 'product-images' | 'event-images' | 'menu-backgrounds';
  recommendedSize?: string;
  /** Override label above the control (default: „Снимка“). */
  label?: string;
  /** Stronger resize for thumbnails vs hero images. */
  compressionOptions?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
  };
}

export default function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  bucket,
  recommendedSize,
  label = 'Снимка',
  compressionOptions,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImageUrl || '');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      // CLIENT-SIDE COMPRESSION: Compress image before upload
      // - Resize to max 1200px (larger dimension)
      // - Compress with quality 85%
      // - Convert to WebP if browser supports it (fallback to original format)
      const options = {
        maxSizeMB: compressionOptions?.maxSizeMB ?? 2,
        maxWidthOrHeight: compressionOptions?.maxWidthOrHeight ?? 1200,
        useWebWorker: false, // Disabled to avoid CSP issues with external scripts
        fileType: 'image/webp', // Try to convert to WebP (will fallback to original if not supported)
      };

      let compressedFile: File;
      try {
        compressedFile = await imageCompression(file, options);
        const originalSize = (file.size / 1024 / 1024).toFixed(2);
        const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
        const reduction = (((file.size - compressedFile.size) / file.size) * 100).toFixed(1);
        console.log(`✅ Image compressed: ${originalSize}MB → ${compressedSize}MB (${reduction}% reduction)`);
      } catch (compressionError) {
        // If compression fails, use original file
        console.warn('⚠️ Compression failed, using original file:', compressionError);
        compressedFile = file;
      }

      // Upload compressed/original file to server
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('bucket', bucket);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const { url } = await response.json();
        console.log('✅ Uploaded file to:', url);
        setPreview(url);
        onImageUploaded(url);
      } else {
        const error = await response.json();
        setUploadError(`Грешка при качване на снимката: ${error.error || 'Неизвестна грешка'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Грешка при качване на снимката');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="theme-label">{label}</label>

      {uploadError && (
        <ThemeInlineFeedback tone="error" role="alert">
          {uploadError}
        </ThemeInlineFeedback>
      )}
      
      {preview && (
        <div className={`relative w-full rounded-lg overflow-hidden bg-[var(--theme-inset)] border border-[var(--theme-hairline)] ${
          bucket === 'menu-backgrounds' ? 'h-48' : 'h-64'
        }`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className={`w-full h-full ${
              bucket === 'menu-backgrounds' ? 'object-cover' : 'object-contain'
            }`}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        <label className="w-full flex-1 cursor-pointer sm:w-auto">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          <div
            className={`theme-btn-primary theme-btn-admin-compact rounded-lg text-center font-semibold transition-all ${
              uploading ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            {uploading ? 'Качване...' : 'Избери снимка'}
          </div>
        </label>

        {preview && (
          <button
            type="button"
            onClick={() => {
              setPreview('');
              onImageUploaded('');
            }}
            className="theme-btn-danger theme-btn-admin-compact w-full rounded-lg font-semibold transition-all sm:w-auto"
          >
            Премахни
          </button>
        )}
      </div>

      <p className="theme-help">
        {recommendedSize ? `Препоръчителни размери: ${recommendedSize}, максимум 5MB` : 'Препоръчителни размери: 800x600px, максимум 5MB'}
      </p>
    </div>
  );
}


