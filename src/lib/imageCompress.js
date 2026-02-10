/**
 * Browser-based image compression / optimisation using the Canvas API.
 *
 * Supports: quality, max dimensions, output format conversion, resize algorithm,
 * background fill for transparent→JPEG, aspect-ratio-aware scaling modes.
 */

// ---------- types / defaults ----------

/**
 * @typedef {Object} CompressOptions
 * @property {number}  quality        - 0.01 – 1.0 (JPEG/WebP/AVIF quality)
 * @property {number}  maxWidth       - Max output width (0 = no limit)
 * @property {number}  maxHeight      - Max output height (0 = no limit)
 * @property {'jpeg'|'png'|'webp'|'avif'|'original'} format - Output format
 * @property {'contain'|'cover'|'stretch'|'exact'} resizeMode
 *   contain  = fit within maxWidth×maxHeight keeping ratio (default)
 *   cover    = fill maxWidth×maxHeight cropping excess
 *   stretch  = ignore ratio, force exact dimensions
 *   exact    = exact pixel size (same as stretch, explicit name)
 * @property {'high'|'medium'|'low'|'pixelated'} smoothing
 *   Maps to canvas imageSmoothingQuality
 * @property {string}  bgColor        - Background colour for transparent→opaque (e.g. '#ffffff')
 * @property {boolean} stripMetadata  - Always true (canvas strips EXIF by nature)
 * @property {boolean} grayscale      - Convert to grayscale
 * @property {number}  blur           - Gaussian-ish blur radius (0 = none, 1-20)
 * @property {number}  brightness     - -100 to 100 (0 = normal)
 * @property {number}  contrast       - -100 to 100 (0 = normal)
 * @property {number}  saturation     - -100 to 100 (0 = normal)
 */

export const DEFAULT_OPTIONS = {
  quality: 0.82,
  maxWidth: 0,
  maxHeight: 0,
  format: 'original',
  resizeMode: 'none',
  smoothing: 'high',
  bgColor: '#ffffff',
  grayscale: false,
  blur: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
};

/** Named presets */
export const PRESETS = {
  original: { label: 'Original (no changes)', options: { ...DEFAULT_OPTIONS, quality: 1, resizeMode: 'none' } },
  web_high: {
    label: 'Web — High Quality',
    description: '80% quality, max 2048px, WebP',
    options: { ...DEFAULT_OPTIONS, quality: 0.80, maxWidth: 2048, maxHeight: 2048, format: 'webp' },
  },
  web_balanced: {
    label: 'Web — Balanced',
    description: '70% quality, max 1600px, WebP',
    options: { ...DEFAULT_OPTIONS, quality: 0.70, maxWidth: 1600, maxHeight: 1600, format: 'webp' },
  },
  web_small: {
    label: 'Web — Small File',
    description: '55% quality, max 1200px, WebP',
    options: { ...DEFAULT_OPTIONS, quality: 0.55, maxWidth: 1200, maxHeight: 1200, format: 'webp' },
  },
  thumbnail: {
    label: 'Thumbnail',
    description: '60% quality, 400×400, JPEG',
    options: { ...DEFAULT_OPTIONS, quality: 0.60, maxWidth: 400, maxHeight: 400, format: 'jpeg' },
  },
  social: {
    label: 'Social Media (1200×630)',
    description: '80% quality, cover crop, JPEG',
    options: { ...DEFAULT_OPTIONS, quality: 0.80, maxWidth: 1200, maxHeight: 630, format: 'jpeg', resizeMode: 'cover' },
  },
  hd: {
    label: 'HD (1920×1080)',
    description: '85% quality, contain, WebP',
    options: { ...DEFAULT_OPTIONS, quality: 0.85, maxWidth: 1920, maxHeight: 1080, format: 'webp' },
  },
  print: {
    label: 'Print Quality',
    description: '95% quality, max 4096px, PNG',
    options: { ...DEFAULT_OPTIONS, quality: 0.95, maxWidth: 4096, maxHeight: 4096, format: 'png' },
  },
  avatar: {
    label: 'Avatar / Icon',
    description: '75% quality, 256×256, cover crop, WebP',
    options: { ...DEFAULT_OPTIONS, quality: 0.75, maxWidth: 256, maxHeight: 256, format: 'webp', resizeMode: 'cover' },
  },
  aggressive: {
    label: 'Maximum Compression',
    description: '35% quality, max 1024px, WebP',
    options: { ...DEFAULT_OPTIONS, quality: 0.35, maxWidth: 1024, maxHeight: 1024, format: 'webp' },
  },
};

// ---------- helpers ----------

const MIME_MAP = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

function getMimeType(format, originalType) {
  if (format === 'original') return originalType || 'image/png';
  return MIME_MAP[format] || 'image/png';
}

export function getExtForFormat(format, originalName) {
  if (format === 'original') {
    const ext = (originalName || '').split('.').pop().toLowerCase();
    return ext || 'png';
  }
  return format === 'jpeg' ? 'jpg' : format;
}

/**
 * Load a File / Blob into an HTMLImageElement.
 */
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image'));
    if (source instanceof Blob || source instanceof File) {
      img.src = URL.createObjectURL(source);
    } else if (typeof source === 'string') {
      img.crossOrigin = 'anonymous';
      img.src = source;
    } else {
      reject(new Error('Invalid image source'));
    }
  });
}

/**
 * Compute output width / height respecting resizeMode.
 */
function computeDimensions(srcW, srcH, maxW, maxH, mode) {
  // 'none' = always keep original dimensions
  if (mode === 'none' || (!maxW && !maxH)) return { w: srcW, h: srcH, sx: 0, sy: 0, sw: srcW, sh: srcH };

  const targetW = maxW || Infinity;
  const targetH = maxH || Infinity;

  if (mode === 'stretch' || mode === 'exact') {
    return {
      w: maxW || srcW,
      h: maxH || srcH,
      sx: 0, sy: 0, sw: srcW, sh: srcH,
    };
  }

  if (mode === 'cover') {
    // Scale up/down so the image covers the target, then crop centre
    const w = maxW || srcW;
    const h = maxH || srcH;
    const scale = Math.max(w / srcW, h / srcH);
    const scaledW = srcW * scale;
    const scaledH = srcH * scale;
    // Source crop rectangle
    const cropW = w / scale;
    const cropH = h / scale;
    const sx = (srcW - cropW) / 2;
    const sy = (srcH - cropH) / 2;
    return { w, h, sx, sy, sw: cropW, sh: cropH };
  }

  // contain (default)
  const ratio = Math.min(targetW / srcW, targetH / srcH, 1); // never upscale
  return {
    w: Math.round(srcW * ratio),
    h: Math.round(srcH * ratio),
    sx: 0, sy: 0, sw: srcW, sh: srcH,
  };
}

/**
 * Build a CSS filter string from options.
 */
function buildFilter(opts) {
  const parts = [];
  if (opts.grayscale) parts.push('grayscale(1)');
  if (opts.blur > 0) parts.push(`blur(${opts.blur}px)`);
  if (opts.brightness !== 0) parts.push(`brightness(${1 + opts.brightness / 100})`);
  if (opts.contrast !== 0) parts.push(`contrast(${1 + opts.contrast / 100})`);
  if (opts.saturation !== 0) parts.push(`saturate(${1 + opts.saturation / 100})`);
  return parts.join(' ');
}

// ---------- crop / extend helpers ----------

/**
 * Sample the dominant colour from the edge pixels of an image.
 * Used for "auto" pad colour detection.
 */
function sampleEdgeColor(img, edgeWidth = 4) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Gather pixels from all four edges
  const pixels = [];
  const regions = [
    { x: 0, y: 0, w, h: edgeWidth },                    // top
    { x: 0, y: h - edgeWidth, w, h: edgeWidth },         // bottom
    { x: 0, y: edgeWidth, w: edgeWidth, h: h - 2 * edgeWidth }, // left
    { x: w - edgeWidth, y: edgeWidth, w: edgeWidth, h: h - 2 * edgeWidth }, // right
  ];

  for (const r of regions) {
    if (r.w <= 0 || r.h <= 0) continue;
    const data = ctx.getImageData(r.x, r.y, r.w, r.h).data;
    // Sample every 4th pixel for speed
    for (let i = 0; i < data.length; i += 16) {
      pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
    }
  }

  if (pixels.length === 0) return '#ffffff';

  // Average
  let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
  for (const [r, g, b, a] of pixels) {
    rSum += r; gSum += g; bSum += b; aSum += a;
  }
  const n = pixels.length;
  const avgR = Math.round(rSum / n);
  const avgG = Math.round(gSum / n);
  const avgB = Math.round(bSum / n);
  const avgA = Math.round(aSum / n);

  if (avgA < 128) return 'transparent';
  return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
}

export { sampleEdgeColor };

/**
 * Crop an image to the given region.
 *
 * @param {File|Blob|string} source
 * @param {{ x: number, y: number, w: number, h: number }} crop  – in source-image pixel coordinates
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
 */
export async function cropImage(source, crop) {
  const img = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = crop.w;
  canvas.height = crop.h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  if (source instanceof Blob || source instanceof File) URL.revokeObjectURL(img.src);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return { blob, dataUrl: canvas.toDataURL('image/png'), width: crop.w, height: crop.h };
}

/**
 * Extend (pad) an image.
 *
 * @param {File|Blob|string} source
 * @param {{ top: number, right: number, bottom: number, left: number }} padding – px to add on each side
 * @param {'transparent'|'auto'|string} color – pad fill colour. 'auto' = detect from edges
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number, detectedColor?: string }>}
 */
export async function extendImage(source, padding, color = 'transparent') {
  const img = await loadImage(source);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const newW = srcW + padding.left + padding.right;
  const newH = srcH + padding.top + padding.bottom;

  let fillColor = color;
  if (color === 'auto') {
    fillColor = sampleEdgeColor(img);
  }

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');

  // Fill background
  if (fillColor && fillColor !== 'transparent') {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, newW, newH);
  }
  // else transparent by default (canvas is already transparent)

  ctx.drawImage(img, padding.left, padding.top);

  if (source instanceof Blob || source instanceof File) URL.revokeObjectURL(img.src);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return { blob, dataUrl: canvas.toDataURL('image/png'), width: newW, height: newH, detectedColor: color === 'auto' ? fillColor : undefined };
}

// ---------- main API ----------

/**
 * Compress / optimise an image.
 *
 * @param {File|Blob|string} source   - File, Blob, or URL
 * @param {Partial<CompressOptions>}  opts
 * @returns {Promise<{ blob: Blob, width: number, height: number, originalSize: number, compressedSize: number, dataUrl: string }>}
 */
export async function compressImage(source, opts = {}) {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const img = await loadImage(source);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const originalSize = source instanceof File || source instanceof Blob ? source.size : 0;

  const { w, h, sx, sy, sw, sh } = computeDimensions(
    srcW, srcH,
    options.maxWidth, options.maxHeight,
    options.resizeMode,
  );

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Smoothing
  if (options.smoothing === 'pixelated') {
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = options.smoothing; // 'low' | 'medium' | 'high'
  }

  // Background fill (for transparent → opaque formats)
  const mime = getMimeType(options.format, source instanceof File ? source.type : 'image/png');
  if (mime === 'image/jpeg' && options.bgColor) {
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  // CSS filters
  const filter = buildFilter(options);
  if (filter) ctx.filter = filter;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  // Clean up object URL
  if (source instanceof Blob || source instanceof File) {
    URL.revokeObjectURL(img.src);
  }

  // Export
  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, options.quality),
  );

  const dataUrl = canvas.toDataURL(mime, options.quality);

  return {
    blob,
    width: w,
    height: h,
    originalSize,
    compressedSize: blob.size,
    dataUrl,
  };
}

/**
 * Generate a quick preview (low-res) for real-time slider feedback.
 * Uses a smaller canvas to keep it fast.
 */
export async function compressPreview(source, opts = {}, maxPreviewDim = 600) {
  const previewOpts = { ...opts };
  // For preview, cap dimensions for speed but preserve the user's resize intent
  if (previewOpts.resizeMode === 'none') {
    // Keep 'none' but add a preview cap so we don't render full-res canvas
    previewOpts.resizeMode = 'contain';
    previewOpts.maxWidth = maxPreviewDim;
    previewOpts.maxHeight = maxPreviewDim;
  } else {
    const mw = previewOpts.maxWidth || 9999;
    const mh = previewOpts.maxHeight || 9999;
    previewOpts.maxWidth = Math.min(mw, maxPreviewDim);
    previewOpts.maxHeight = Math.min(mh, maxPreviewDim);
  }
  return compressImage(source, previewOpts);
}
