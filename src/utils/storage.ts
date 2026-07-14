// =============================================================================
// Supabase Storage utilities — moved out of `src/lib/helpers.ts` (Enhancement
// Batch). Re-exported from `src/lib/helpers.ts` for backward compatibility.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_BUCKET } from '@/lib/supabase';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, type ImageFolder } from '@/lib/constants';
import { uniqueSlugSuffix } from './slug';

/** Returns the public URL for a file stored in the shared media bucket. */
export function publicStorageUrl(supabase: SupabaseClient, path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads a File to Supabase Storage under the given folder
 * (destination | gallery | blog | logo | testimonial | hero) and returns the
 * storage path to persist in the database (not the full public URL).
 */
export async function uploadImage(
  supabase: SupabaseClient,
  folder: ImageFolder,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return { path: null, error: 'Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.' };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { path: null, error: 'Ukuran gambar maksimal 5MB.' };
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}-${uniqueSlugSuffix()}.${ext}`;
  const path = `${folder}/${fileName}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    return { path: null, error: error.message };
  }
  return { path, error: null };
}

/** Deletes a stored file (best-effort — ignores "not found" errors). */
export async function deleteImage(supabase: SupabaseClient, path: string | null | undefined) {
  if (!path || path.startsWith('http')) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}
