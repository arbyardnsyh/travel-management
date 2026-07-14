// =============================================================================
// Generic image upload/delete endpoint (Batch 3A — Fondasi UI).
// Used by every `ImageUploader.astro` instance across all admin modules, per
// ARCHITECTURE.md §8/§10: `POST /api/admin/upload` and `DELETE /api/admin/upload`.
// =============================================================================

import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/auth';
import { uploadImage, deleteImage } from '@/utils/storage';
import { jsonOk, jsonError } from '@/utils/response';
import { IMAGE_FOLDERS, type ImageFolder } from '@/lib/constants';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses untuk mengunggah gambar.', 403);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const folder = String(formData.get('folder') ?? '');

  if (!(file instanceof File)) {
    return jsonError('File tidak ditemukan.', 400);
  }
  if (!IMAGE_FOLDERS.includes(folder as ImageFolder)) {
    return jsonError('Folder upload tidak valid.', 400);
  }

  const { path, error } = await uploadImage(locals.supabase, folder as ImageFolder, file);
  if (error || !path) {
    return jsonError(error ?? 'Gagal mengunggah gambar.', 400);
  }

  const { data } = locals.supabase.storage.from('media').getPublicUrl(path);
  return jsonOk({ path, url: data.publicUrl }, 201);
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!requireRole(locals.user, ['admin', 'editor'])) {
    return jsonError('Anda tidak memiliki akses untuk menghapus gambar.', 403);
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) {
    return jsonError('Path gambar wajib disertakan.', 400);
  }

  await deleteImage(locals.supabase, path);
  return jsonOk({ deleted: true });
};
