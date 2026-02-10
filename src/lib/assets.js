import { supabase } from './supabase';

const BUCKET = 'assets';

/**
 * Get the public URL for a file in the assets bucket.
 * @param {string} path - The full path including folder prefix (e.g. 'public/123_file.png')
 */
export function getAssetPublicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

/**
 * List files from the specified folder.
 * @param {'public'|'unlisted'} folder
 * @returns {{ data: FileObject[], error }}
 */
export async function listAssets(folder = 'public') {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, {
      limit: 500,
      sortBy: { column: 'created_at', order: 'desc' },
    });
  if (error) return { data: null, error };
  // Tag each item with its folder so callers know the full path
  const tagged = (data || []).map((f) => ({ ...f, _folder: folder, _fullPath: `${folder}/${f.name}` }));
  return { data: tagged, error: null };
}

/**
 * List all assets across both public and unlisted folders.
 * @param {boolean} includeUnlisted - Whether to include unlisted assets (admin only)
 * @returns {{ data: FileObject[], error }}
 */
export async function listAllAssets(includeUnlisted = false) {
  const publicResult = await listAssets('public');
  if (publicResult.error) return publicResult;

  let allAssets = publicResult.data || [];

  if (includeUnlisted) {
    const unlistedResult = await listAssets('unlisted');
    if (!unlistedResult.error && unlistedResult.data) {
      allAssets = [...allAssets, ...unlistedResult.data];
    }
  }

  // Sort combined results by created_at desc
  allAssets.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return { data: allAssets, error: null };
}

/**
 * Upload a file to the assets bucket.
 * @param {File} file - The file to upload
 * @param {Object} opts
 * @param {boolean} [opts.unlisted=false] - Upload to unlisted folder
 * @returns {{ data, error, publicUrl }}
 */
export async function uploadAsset(file, { unlisted = false } = {}) {
  // Sanitise filename: replace spaces, keep extension
  const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const timestamp = Date.now();
  const folder = unlisted ? 'unlisted' : 'public';
  const path = `${folder}/${timestamp}_${safeName}`;

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
 * @param {string[]} paths - Array of full file paths to delete (including folder prefix)
 */
export async function deleteAssets(paths) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .remove(paths);
  return { data, error };
}
