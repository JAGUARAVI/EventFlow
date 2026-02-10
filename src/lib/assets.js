import { supabase } from './supabase';

const BUCKET = 'assets';

/**
 * Get the public URL for a file in the assets bucket.
 */
export function getAssetPublicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

/**
 * List all files in a folder (default: root).
 * Returns { data: FileObject[], error }
 */
export async function listAssets(folder = '') {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder || '', {
      limit: 500,
      sortBy: { column: 'created_at', order: 'desc' },
    });
  return { data, error };
}

/**
 * Upload a file to the assets bucket.
 * @param {File} file - The file to upload
 * @param {string} folder - Optional folder prefix
 * @returns {{ data, error, publicUrl }}
 */
export async function uploadAsset(file, folder = '') {
  // Sanitise filename: replace spaces, keep extension
  const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const timestamp = Date.now();
  const path = folder
    ? `${folder}/${timestamp}_${safeName}`
    : `${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '31536000', // 1 year
      upsert: false,
    });

  if (error) return { data: null, error, publicUrl: null };

  const publicUrl = getAssetPublicUrl(data.path);
  return { data, error: null, publicUrl };
}

/**
 * Delete one or more files from the assets bucket.
 * @param {string[]} paths - Array of file paths to delete
 */
export async function deleteAssets(paths) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .remove(paths);
  return { data, error };
}
