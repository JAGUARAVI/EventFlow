import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Slider,
  Select,
  SelectItem,
  Switch,
  Chip,
  Card,
  CardBody,
  Tabs,
  Tab,
  Divider,
  Input,
  Spinner,
  addToast,
  Tooltip,
} from '@heroui/react';
import {
  Download,
  Upload,
  RotateCcw,
  Zap,
  SlidersHorizontal,
  Image,
  Maximize,
  Palette,
  Layers,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  Sun,
  Contrast,
  Droplets,
  Crop,
  Expand,
  Lock,
  Unlock,
  Pipette,
  SquareDashed,
  RectangleHorizontal,
  Square,
  RectangleVertical,
} from 'lucide-react';
import {
  compressImage,
  compressPreview,
  cropImage,
  extendImage,
  sampleEdgeColor,
  DEFAULT_OPTIONS,
  PRESETS,
  getExtForFormat,
} from '../lib/imageCompress';

const FORMAT_OPTIONS = [
  { key: 'original', label: 'Original' },
  { key: 'jpeg', label: 'JPEG' },
  { key: 'png', label: 'PNG' },
  { key: 'webp', label: 'WebP' },
  { key: 'avif', label: 'AVIF' },
];

const RESIZE_MODES = [
  { key: 'none', label: 'None (Original)', description: 'Keep original dimensions, no resize' },
  { key: 'contain', label: 'Contain', description: 'Fit within bounds, keep ratio' },
  { key: 'cover', label: 'Cover', description: 'Fill bounds, crop excess' },
  { key: 'stretch', label: 'Stretch', description: 'Ignore ratio, force size' },
];

const SMOOTHING_OPTIONS = [
  { key: 'high', label: 'High (Bicubic)' },
  { key: 'medium', label: 'Medium (Bilinear)' },
  { key: 'low', label: 'Low (Nearest)' },
  { key: 'pixelated', label: 'Pixelated (No smoothing)' },
];

const CROP_ASPECT_PRESETS = [
  { key: 'free', label: 'Free', icon: SquareDashed, ratio: null },
  { key: '1:1', label: '1:1', icon: Square, ratio: 1 },
  { key: '4:3', label: '4:3', icon: RectangleHorizontal, ratio: 4 / 3 },
  { key: '3:4', label: '3:4', icon: RectangleVertical, ratio: 3 / 4 },
  { key: '16:9', label: '16:9', icon: RectangleHorizontal, ratio: 16 / 9 },
  { key: '9:16', label: '9:16', icon: RectangleVertical, ratio: 9 / 16 },
  { key: '3:2', label: '3:2', icon: RectangleHorizontal, ratio: 3 / 2 },
  { key: '2:3', label: '2:3', icon: RectangleVertical, ratio: 2 / 3 },
  { key: '21:9', label: '21:9', icon: RectangleHorizontal, ratio: 21 / 9 },
];

const EXTEND_COLOR_MODES = [
  { key: 'transparent', label: 'Transparent' },
  { key: 'auto', label: 'Auto-detect' },
  { key: 'custom', label: 'Custom Color' },
  { key: 'white', label: 'White' },
  { key: 'black', label: 'Black' },
];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function pctChange(original, compressed) {
  if (!original) return 0;
  return Math.round(((compressed - original) / original) * 100);
}

/**
 * ImageCompressor modal.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {File|File[]} props.files       - File(s) to compress (from file input or existing asset)
 * @param {Function} props.onComplete     - Called with compressed File[] after user confirms
 * @param {string}   [props.mode='upload'] - 'upload' = compress then upload, 'download' = compress then download, 'replace' = compress and replace existing
 */
export default function ImageCompressor({ isOpen, onClose, files: rawFiles, onComplete, mode = 'upload' }) {
  // Normalise to array
  const files = useMemo(() => {
    if (!rawFiles) return [];
    return Array.isArray(rawFiles) ? rawFiles : [rawFiles];
  }, [rawFiles]);

  // Options state
  const [options, setOptions] = useState({ ...DEFAULT_OPTIONS });
  const [activePreset, setActivePreset] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Preview state
  const [originalInfo, setOriginalInfo] = useState(null); // { dataUrl, width, height, size }
  const [previewInfo, setPreviewInfo] = useState(null);   // { dataUrl, width, height, compressedSize }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const compareRef = useRef(null);

  // Crop & Extend state
  const [cropEnabled, setCropEnabled] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 0, h: 0 }); // in source-px
  const [cropAspect, setCropAspect] = useState('free');
  const [extendEnabled, setExtendEnabled] = useState(false);
  const [extendPadding, setExtendPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [extendColorMode, setExtendColorMode] = useState('transparent');
  const [extendCustomColor, setExtendCustomColor] = useState('#ffffff');
  const [detectedEdgeColor, setDetectedEdgeColor] = useState(null);
  const [linkExtendSides, setLinkExtendSides] = useState(true);
  const [cropPreviewUrl, setCropPreviewUrl] = useState(null);
  const [cropApplied, setCropApplied] = useState(false);
  const [extendApplied, setExtendApplied] = useState(false);
  // Crop canvas interactive state
  const cropCanvasRef = useRef(null);
  const cropImgCacheRef = useRef(null); // pre-loaded HTMLImageElement for fast redraws
  const [cropDragging, setCropDragging] = useState(false); // 'move'|'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w'|false
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0, rect: null });
  const cropDisplayRef = useRef({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 });
  // Version counter to force preview refresh when crop/extend are toggled
  const [previewVersion, setPreviewVersion] = useState(0);

  // Active file index (for batch)
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const activeFile = files[activeFileIndex] || null;

  // Load original info when file changes
  useEffect(() => {
    if (!activeFile || !isOpen) return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.naturalWidth, 600);
      canvas.height = Math.round((canvas.width / img.naturalWidth) * img.naturalHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setOriginalInfo({
        dataUrl: canvas.toDataURL('image/png'),
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: activeFile.size,
      });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(activeFile);
    return () => URL.revokeObjectURL(img.src);
  }, [activeFile, isOpen]);

  // Preview timer ref (debounces preview updates)
  const previewTimerRef = useRef(null);

  // Pre-load the crop overlay image into a cached HTMLImageElement
  useEffect(() => {
    if (!originalInfo?.dataUrl) { cropImgCacheRef.current = null; return; }
    const img = new window.Image();
    img.onload = () => { cropImgCacheRef.current = img; };
    img.src = originalInfo.dataUrl;
  }, [originalInfo?.dataUrl]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setActiveFileIndex(0);
      setOptions({ ...DEFAULT_OPTIONS });
      setActivePreset(null);
      setShowAdvanced(false);
      setCompareMode(false);
      setPreviewInfo(null);
      setOriginalInfo(null);
      // Reset crop/extend
      setCropEnabled(false);
      setCropRect({ x: 0, y: 0, w: 0, h: 0 });
      setCropAspect('free');
      setExtendEnabled(false);
      setExtendPadding({ top: 0, right: 0, bottom: 0, left: 0 });
      setExtendColorMode('transparent');
      setDetectedEdgeColor(null);
      setCropPreviewUrl(null);
      setCropApplied(false);
      setExtendApplied(false);
    }
  }, [isOpen]);

  // Init crop rect when originalInfo loads or crop is enabled
  useEffect(() => {
    if (originalInfo && cropEnabled && cropRect.w === 0) {
      setCropRect({ x: 0, y: 0, w: originalInfo.width, h: originalInfo.height });
    }
  }, [originalInfo, cropEnabled, cropRect.w]);

  // Auto-detect edge color when extend mode is 'auto' and original loads
  useEffect(() => {
    if (!activeFile || extendColorMode !== 'auto') return;
    const img = new window.Image();
    img.onload = () => {
      const color = sampleEdgeColor(img);
      setDetectedEdgeColor(color);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(activeFile);
    return () => URL.revokeObjectURL(img.src);
  }, [activeFile, extendColorMode]);

  // Build the source for preview/compress — applies crop + extend as pre-processing
  const buildProcessedSource = useCallback(async (file) => {
    let source = file;
    // Apply crop first
    if (cropApplied && cropRect.w > 0 && cropRect.h > 0) {
      const cropped = await cropImage(source, cropRect);
      source = new File([cropped.blob], file.name, { type: 'image/png' });
    }
    // Then apply extend
    if (extendApplied && (extendPadding.top > 0 || extendPadding.right > 0 || extendPadding.bottom > 0 || extendPadding.left > 0)) {
      let color = extendColorMode;
      if (color === 'custom') color = extendCustomColor;
      else if (color === 'white') color = '#ffffff';
      else if (color === 'black') color = '#000000';
      else if (color === 'auto') color = 'auto';
      const extended = await extendImage(source, extendPadding, color);
      source = new File([extended.blob], file.name, { type: 'image/png' });
      if (extended.detectedColor) setDetectedEdgeColor(extended.detectedColor);
    }
    return source;
  }, [cropApplied, cropRect, extendApplied, extendPadding, extendColorMode, extendCustomColor]);

  // Keep a stable ref to buildProcessedSource so the preview effect doesn't
  // depend on the callback identity (which changes on every cropRect change).
  const buildProcessedSourceRef = useRef(buildProcessedSource);
  useEffect(() => { buildProcessedSourceRef.current = buildProcessedSource; }, [buildProcessedSource]);

  // Override the preview pipeline to use processed source
  const processedSourceRef = useRef(null);
  useEffect(() => {
    if (!activeFile || !isOpen) return;
    let cancelled = false;
    setPreviewLoading(true);
    clearTimeout(previewTimerRef.current);
    // Use a shorter debounce so toggling crop/extend feels responsive
    previewTimerRef.current = setTimeout(async () => {
      try {
        const src = await buildProcessedSourceRef.current(activeFile);
        if (cancelled) return;
        processedSourceRef.current = src;
        const result = await compressPreview(src, options, 600);
        if (cancelled) return;
        setPreviewInfo({
          dataUrl: result.dataUrl,
          width: result.width,
          height: result.height,
          compressedSize: result.compressedSize,
        });
      } catch (err) {
        console.error('Preview failed:', err);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(previewTimerRef.current); };
  // previewVersion forces a refresh when crop/extend toggles change
  }, [activeFile, options, isOpen, previewVersion]);

  // Crop canvas drawing — uses cached image for synchronous, lag-free redraws
  const drawCropCanvas = useCallback(() => {
    const canvas = cropCanvasRef.current;
    const cachedImg = cropImgCacheRef.current;
    if (!canvas || !originalInfo || !cachedImg) return;
    const ctx = canvas.getContext('2d');
    const containerW = canvas.parentElement?.clientWidth || 500;
    const containerH = canvas.parentElement?.clientHeight || 400;

    // Calculate scale to fit image in container
    const imgW = originalInfo.width;
    const imgH = originalInfo.height;
    const scale = Math.min(containerW / imgW, containerH / imgH, 1);
    const dispW = Math.round(imgW * scale);
    const dispH = Math.round(imgH * scale);
    const offsetX = Math.round((containerW - dispW) / 2);
    const offsetY = Math.round((containerH - dispH) / 2);

    canvas.width = containerW;
    canvas.height = containerH;
    cropDisplayRef.current = { scaleX: scale, scaleY: scale, offsetX, offsetY, dispW, dispH };

    // Clear and draw image synchronously from cache
    ctx.clearRect(0, 0, containerW, containerH);
    ctx.drawImage(cachedImg, offsetX, offsetY, dispW, dispH);

    // Dim overlay outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const cx = offsetX + cropRect.x * scale;
    const cy = offsetY + cropRect.y * scale;
    const cw = cropRect.w * scale;
    const ch = cropRect.h * scale;

    // Top
    ctx.fillRect(offsetX, offsetY, dispW, cy - offsetY);
    // Bottom
    ctx.fillRect(offsetX, cy + ch, dispW, offsetY + dispH - cy - ch);
    // Left
    ctx.fillRect(offsetX, cy, cx - offsetX, ch);
    // Right
    ctx.fillRect(cx + cw, cy, offsetX + dispW - cx - cw, ch);

    // Crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Rule of thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + (cw * i) / 3, cy);
      ctx.lineTo(cx + (cw * i) / 3, cy + ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + (ch * i) / 3);
      ctx.lineTo(cx + cw, cy + (ch * i) / 3);
      ctx.stroke();
    }

    // Corner handles
    const handleSize = 10;
    ctx.fillStyle = '#fff';
    const corners = [
      [cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch],
    ];
    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }

    // Edge midpoint handles
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const hs = 6;
    const mids = [
      [cx + cw / 2, cy], [cx + cw / 2, cy + ch],  // top-mid, bottom-mid
      [cx, cy + ch / 2], [cx + cw, cy + ch / 2],   // left-mid, right-mid
    ];
    for (const [mx, my] of mids) {
      ctx.fillRect(mx - hs / 2, my - hs / 2, hs, hs);
    }

    // Dimensions label
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(cx + cw / 2 - 40, cy + ch / 2 - 10, 80, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(cropRect.w)}×${Math.round(cropRect.h)}`, cx + cw / 2, cy + ch / 2);
  }, [originalInfo, cropRect]);

  const cropRafRef = useRef(null);
  useEffect(() => {
    if (cropEnabled && originalInfo) {
      cancelAnimationFrame(cropRafRef.current);
      cropRafRef.current = requestAnimationFrame(drawCropCanvas);
    }
    return () => cancelAnimationFrame(cropRafRef.current);
  }, [cropEnabled, originalInfo, cropRect, drawCropCanvas]);

  // Convert mouse event to source-image coordinates
  const canvasToSource = useCallback((e) => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const { scaleX, scaleY, offsetX, offsetY } = cropDisplayRef.current;
    return {
      x: (clientX - rect.left - offsetX) / scaleX,
      y: (clientY - rect.top - offsetY) / scaleY,
    };
  }, []);

  // Determine which handle the cursor is over
  const getHandleAt = useCallback((srcPt) => {
    const { x, y, w, h } = cropRect;
    const threshold = 12 / (cropDisplayRef.current.scaleX || 1); // threshold in source px
    const corners = {
      nw: [x, y], ne: [x + w, y], sw: [x, y + h], se: [x + w, y + h],
    };
    for (const [key, [cx, cy]] of Object.entries(corners)) {
      if (Math.abs(srcPt.x - cx) < threshold && Math.abs(srcPt.y - cy) < threshold) return key;
    }
    // Edge handles
    if (Math.abs(srcPt.y - y) < threshold && srcPt.x > x && srcPt.x < x + w) return 'n';
    if (Math.abs(srcPt.y - (y + h)) < threshold && srcPt.x > x && srcPt.x < x + w) return 's';
    if (Math.abs(srcPt.x - x) < threshold && srcPt.y > y && srcPt.y < y + h) return 'w';
    if (Math.abs(srcPt.x - (x + w)) < threshold && srcPt.y > y && srcPt.y < y + h) return 'e';
    // Inside = move
    if (srcPt.x >= x && srcPt.x <= x + w && srcPt.y >= y && srcPt.y <= y + h) return 'move';
    return null;
  }, [cropRect]);

  // Crop mouse/touch handlers
  const handleCropPointerDown = useCallback((e) => {
    e.preventDefault();
    const pt = canvasToSource(e);
    const handle = getHandleAt(pt);
    if (!handle) return;
    setCropDragging(handle);
    setCropDragStart({ x: pt.x, y: pt.y, rect: { ...cropRect } });
  }, [canvasToSource, getHandleAt, cropRect]);

  const handleCropPointerMove = useCallback((e) => {
    if (!cropDragging || !originalInfo) return;
    e.preventDefault();
    const pt = canvasToSource(e);
    const dx = pt.x - cropDragStart.x;
    const dy = pt.y - cropDragStart.y;
    const orig = cropDragStart.rect;
    const imgW = originalInfo.width;
    const imgH = originalInfo.height;

    const aspectRatio = CROP_ASPECT_PRESETS.find(p => p.key === cropAspect)?.ratio || null;

    let newRect = { ...orig };

    if (cropDragging === 'move') {
      newRect.x = Math.max(0, Math.min(orig.x + dx, imgW - orig.w));
      newRect.y = Math.max(0, Math.min(orig.y + dy, imgH - orig.h));
    } else {
      // Resize handles
      if (cropDragging.includes('e')) newRect.w = Math.max(20, orig.w + dx);
      if (cropDragging.includes('w')) { newRect.x = orig.x + dx; newRect.w = Math.max(20, orig.w - dx); }
      if (cropDragging.includes('s')) newRect.h = Math.max(20, orig.h + dy);
      if (cropDragging.includes('n')) { newRect.y = orig.y + dy; newRect.h = Math.max(20, orig.h - dy); }

      // Enforce aspect ratio
      if (aspectRatio) {
        if (cropDragging.includes('e') || cropDragging.includes('w')) {
          newRect.h = Math.round(newRect.w / aspectRatio);
        } else {
          newRect.w = Math.round(newRect.h * aspectRatio);
        }
      }

      // Clamp to image bounds
      if (newRect.x < 0) { newRect.w += newRect.x; newRect.x = 0; }
      if (newRect.y < 0) { newRect.h += newRect.y; newRect.y = 0; }
      if (newRect.x + newRect.w > imgW) newRect.w = imgW - newRect.x;
      if (newRect.y + newRect.h > imgH) newRect.h = imgH - newRect.y;
    }

    setCropRect(newRect);
  }, [cropDragging, cropDragStart, canvasToSource, originalInfo, cropAspect]);

  const handleCropPointerUp = useCallback(() => {
    setCropDragging(false);
  }, []);

  // Attach/detach crop mouse events
  useEffect(() => {
    if (!cropDragging) return;
    const onMove = (e) => handleCropPointerMove(e);
    const onUp = () => handleCropPointerUp();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [cropDragging, handleCropPointerMove, handleCropPointerUp]);

  // Cursor style for crop canvas
  const getCropCursor = useCallback((e) => {
    const pt = canvasToSource(e);
    const handle = getHandleAt(pt);
    const cursors = {
      nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize',
      n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
      move: 'move',
    };
    return cursors[handle] || 'crosshair';
  }, [canvasToSource, getHandleAt]);

  // Update extend padding with link
  const updateExtendPadding = useCallback((side, value) => {
    const v = Math.max(0, parseInt(value) || 0);
    if (linkExtendSides) {
      setExtendPadding({ top: v, right: v, bottom: v, left: v });
    } else {
      setExtendPadding(prev => ({ ...prev, [side]: v }));
    }
  }, [linkExtendSides]);

  // Get the extend fill color for display
  const extendDisplayColor = useMemo(() => {
    if (extendColorMode === 'transparent') return 'transparent';
    if (extendColorMode === 'auto') return detectedEdgeColor || '#888888';
    if (extendColorMode === 'white') return '#ffffff';
    if (extendColorMode === 'black') return '#000000';
    if (extendColorMode === 'custom') return extendCustomColor;
    return '#ffffff';
  }, [extendColorMode, detectedEdgeColor, extendCustomColor]);

  // Effective dimensions after crop/extend
  const processedDims = useMemo(() => {
    if (!originalInfo) return null;
    let w = originalInfo.width;
    let h = originalInfo.height;
    if (cropApplied && cropRect.w > 0 && cropRect.h > 0) {
      w = Math.round(cropRect.w);
      h = Math.round(cropRect.h);
    }
    if (extendApplied) {
      w += extendPadding.left + extendPadding.right;
      h += extendPadding.top + extendPadding.bottom;
    }
    return { w, h };
  }, [originalInfo, cropApplied, cropRect, extendApplied, extendPadding]);

  // Option updaters
  const updateOption = useCallback((key, value) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null); // clear preset when manually changed
  }, []);

  const applyPreset = useCallback((presetKey) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      setOptions({ ...preset.options });
      setActivePreset(presetKey);
    }
  }, []);

  const resetOptions = useCallback(() => {
    setOptions({ ...DEFAULT_OPTIONS });
    setActivePreset(null);
  }, []);

  // Compare slider drag
  const handleCompareMove = useCallback((e) => {
    if (!compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setComparePosition((x / rect.width) * 100);
  }, []);

  // Process & output
  const handleCompress = useCallback(async () => {
    if (!files.length) return;
    setProcessing(true);
    try {
      const results = [];
      for (const file of files) {
        const processedSrc = await buildProcessedSource(file);
        const result = await compressImage(processedSrc, options);
        const ext = getExtForFormat(options.format, file.name);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const newName = `${baseName}.${ext}`;
        const compressedFile = new File([result.blob], newName, { type: result.blob.type });
        results.push(compressedFile);
      }
      onComplete?.(results);
      addToast({
        title: `Compressed ${results.length} image${results.length > 1 ? 's' : ''}`,
        color: 'success',
      });
      onClose();
    } catch (err) {
      addToast({ title: 'Compression failed', description: err.message, color: 'danger' });
    } finally {
      setProcessing(false);
    }
  }, [files, options, onComplete, onClose, buildProcessedSource]);

  // Quick download single preview
  const handleDownloadPreview = useCallback(async () => {
    if (!activeFile) return;
    setProcessing(true);
    try {
      const processedSrc = await buildProcessedSource(activeFile);
      const result = await compressImage(processedSrc, options);
      const ext = getExtForFormat(options.format, activeFile.name);
      const baseName = activeFile.name.replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_compressed.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ title: 'Download failed', description: err.message, color: 'danger' });
    } finally {
      setProcessing(false);
    }
  }, [activeFile, options, buildProcessedSource]);

  const savings = originalInfo && previewInfo
    ? pctChange(originalInfo.size, previewInfo.compressedSize)
    : 0;

  // Compute estimated final output dimensions (what the actual compress will produce)
  // Takes crop/extend into account as they are applied before resize.
  const estimatedDims = useMemo(() => {
    if (!originalInfo) return null;
    // Start from original, then apply crop, then extend
    let srcW = originalInfo.width;
    let srcH = originalInfo.height;
    if (cropApplied && cropRect.w > 0 && cropRect.h > 0) {
      srcW = Math.round(cropRect.w);
      srcH = Math.round(cropRect.h);
    }
    if (extendApplied) {
      srcW += extendPadding.left + extendPadding.right;
      srcH += extendPadding.top + extendPadding.bottom;
    }
    const mw = options.maxWidth;
    const mh = options.maxHeight;
    const mode = options.resizeMode;
    // 'none' or no dimensions set → keep processed size
    if (mode === 'none' || (!mw && !mh)) return { w: srcW, h: srcH };
    if (mode === 'stretch' || mode === 'exact') {
      return { w: mw || srcW, h: mh || srcH };
    }
    if (mode === 'cover') {
      return { w: mw || srcW, h: mh || srcH };
    }
    // contain
    const targetW = mw || Infinity;
    const targetH = mh || Infinity;
    const ratio = Math.min(targetW / srcW, targetH / srcH, 1);
    return { w: Math.round(srcW * ratio), h: Math.round(srcH * ratio) };
  }, [originalInfo, options.maxWidth, options.maxHeight, options.resizeMode, cropApplied, cropRect, extendApplied, extendPadding]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <SlidersHorizontal size={20} />
          <span>Image Compressor</span>
          {files.length > 1 && (
            <Chip size="sm" variant="flat" color="primary">
              {files.length} images
            </Chip>
          )}
        </ModalHeader>

        <ModalBody className="p-0">
          <div className="flex flex-col lg:flex-row h-full">
            {/* Left: Preview panel */}
            <div className="flex-1 p-4 flex flex-col gap-4 min-w-0 border-b lg:border-b-0 lg:border-r border-default-200">
              {/* File tabs for batch */}
              {files.length > 1 && (
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {files.map((f, i) => (
                    <Chip
                      key={i}
                      variant={activeFileIndex === i ? 'solid' : 'flat'}
                      color={activeFileIndex === i ? 'primary' : 'default'}
                      className="cursor-pointer flex-shrink-0"
                      onClick={() => setActiveFileIndex(i)}
                    >
                      {f.name.length > 20 ? f.name.slice(0, 17) + '...' : f.name}
                    </Chip>
                  ))}
                </div>
              )}

              {/* Compare toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    size="sm"
                    isSelected={compareMode}
                    onValueChange={setCompareMode}
                  >
                    <span className="text-sm">Before / After</span>
                  </Switch>
                </div>
                {previewLoading && <Spinner size="sm" />}
              </div>

              {/* Preview area */}
              <div className="flex-1 flex items-center justify-center bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] rounded-xl overflow-hidden min-h-[300px] relative">
                {compareMode && originalInfo && previewInfo ? (
                  /* Side-by-side slider compare */
                  <div
                    ref={compareRef}
                    className="relative w-full h-full cursor-col-resize select-none overflow-hidden"
                    onMouseMove={handleCompareMove}
                    onTouchMove={handleCompareMove}
                    onMouseDown={() => {
                      const onMove = (e) => handleCompareMove(e);
                      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                    }}
                  >
                    {/* After (compressed) — full background */}
                    <img
                      src={previewInfo.dataUrl}
                      alt="Compressed"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                    {/* Before (original) — clipped with clip-path */}
                    <img
                      src={originalInfo.dataUrl}
                      alt="Original"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      draggable={false}
                      style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                    />
                    {/* Slider line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 pointer-events-none"
                      style={{ left: `${comparePosition}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                        <ArrowRight size={14} className="text-default-600 -rotate-180" />
                        <ArrowRight size={14} className="text-default-600" />
                      </div>
                    </div>
                    {/* Labels */}
                    <div className="absolute top-3 left-3 z-10 pointer-events-none">
                      <Chip size="sm" variant="solid" className="bg-black/60 text-white">Original</Chip>
                    </div>
                    <div className="absolute top-3 right-3 z-10 pointer-events-none">
                      <Chip size="sm" variant="solid" className="bg-black/60 text-white">Compressed</Chip>
                    </div>
                  </div>
                ) : previewInfo ? (
                  <img
                    src={previewInfo.dataUrl}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : originalInfo ? (
                  <img
                    src={originalInfo.dataUrl}
                    alt="Original"
                    className="max-w-full max-h-full object-contain opacity-50"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-default-400">
                    <Image size={48} />
                    <p>Loading preview…</p>
                  </div>
                )}
              </div>

              {/* Stats bar */}
              {originalInfo && previewInfo && (
                <Card className="border border-default-200">
                  <CardBody className="p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-default-400 uppercase tracking-wider">Original</p>
                        <p className="text-sm font-semibold">{formatBytes(originalInfo.size)}</p>
                        <p className="text-[10px] text-default-500">
                          {originalInfo.width}×{originalInfo.height}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-default-400 uppercase tracking-wider">Compressed</p>
                        <p className="text-sm font-semibold">{formatBytes(previewInfo.compressedSize)}</p>
                        <p className="text-[10px] text-default-500">
                          {estimatedDims ? `${estimatedDims.w}×${estimatedDims.h}` : `${previewInfo.width}×${previewInfo.height}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-default-400 uppercase tracking-wider">Savings</p>
                        <p className={`text-sm font-bold ${savings < 0 ? 'text-success' : savings > 0 ? 'text-danger' : ''}`}>
                          {savings < 0 ? `${Math.abs(savings)}% smaller` : savings > 0 ? `${savings}% larger` : 'Same size'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-default-400 uppercase tracking-wider">Format</p>
                        <p className="text-sm font-semibold uppercase">
                          {options.format === 'original' ? activeFile?.type?.split('/')[1] || '—' : options.format}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Active crop/extend badges */}
              {(cropApplied || extendApplied) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {cropApplied && (
                    <Chip size="sm" color="primary" variant="flat" startContent={<Crop size={10} />}>
                      Cropped to {Math.round(cropRect.w)}×{Math.round(cropRect.h)}
                    </Chip>
                  )}
                  {extendApplied && (
                    <Chip size="sm" color="secondary" variant="flat" startContent={<Expand size={10} />}>
                      Padded +{extendPadding.top}/{extendPadding.right}/{extendPadding.bottom}/{extendPadding.left}
                    </Chip>
                  )}
                </div>
              )}
            </div>

            {/* Right: Controls panel */}
            <div className="w-full lg:w-[380px] flex-shrink-0 p-4 overflow-y-auto">
              <Tabs aria-label="Compression options" size="sm" fullWidth classNames={{ panel: "pt-3" }}>
                {/* Presets tab */}
                <Tab
                  key="presets"
                  title={
                    <div className="flex items-center gap-1.5">
                      <Zap size={14} />
                      <span>Presets</span>
                    </div>
                  }
                >
                  <div className="flex flex-col gap-2">
                    {Object.entries(PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyPreset(key)}
                        className={`text-left p-3 rounded-lg border-2 transition-all ${
                          activePreset === key
                            ? 'border-primary bg-primary/10'
                            : 'border-default-200 hover:border-default-300'
                        }`}
                      >
                        <p className="text-sm font-medium">{preset.label}</p>
                        {preset.description && (
                          <p className="text-xs text-default-500 mt-0.5">{preset.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </Tab>

                {/* Manual tab */}
                <Tab
                  key="manual"
                  title={
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal size={14} />
                      <span>Manual</span>
                    </div>
                  }
                >
                  <div className="flex flex-col gap-5">
                    {/* Quality */}
                    <div>
                      <Slider
                        label="Quality"
                        step={0.01}
                        minValue={0.01}
                        maxValue={1}
                        value={options.quality}
                        onChange={(v) => updateOption('quality', v)}
                        className="max-w-full"
                        size="sm"
                        showTooltip
                        tooltipProps={{ content: `${Math.round(options.quality * 100)}%` }}
                        startContent={<span className="text-[10px] text-default-400 w-6">Low</span>}
                        endContent={<span className="text-[10px] text-default-400 w-8">High</span>}
                        renderValue={() => (
                          <span className="text-sm font-mono">{Math.round(options.quality * 100)}%</span>
                        )}
                      />
                      <p className="text-[10px] text-default-400 mt-1">
                        Lower = smaller file, more artifacts. 70–85% is usually a good balance.
                      </p>
                    </div>

                    <Divider />

                    {/* Output format */}
                    <Select
                      label="Output Format"
                      size="sm"
                      selectedKeys={[options.format]}
                      onSelectionChange={(keys) => updateOption('format', [...keys][0] || 'original')}
                      description="WebP offers the best size-to-quality ratio for web"
                    >
                      {FORMAT_OPTIONS.map((f) => (
                        <SelectItem key={f.key}>{f.label}</SelectItem>
                      ))}
                    </Select>

                    <Divider />

                    {/* Dimensions */}
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Maximize size={14} /> Resize
                      </p>
                      <Select
                        label="Resize Mode"
                        size="sm"
                        selectedKeys={[options.resizeMode]}
                        onSelectionChange={(keys) => {
                          const mode = [...keys][0] || 'none';
                          if (mode === 'none') {
                            setOptions((prev) => ({ ...prev, resizeMode: 'none', maxWidth: 0, maxHeight: 0 }));
                            setActivePreset(null);
                          } else {
                            updateOption('resizeMode', mode);
                          }
                        }}
                        className="mb-2"
                      >
                        {RESIZE_MODES.map((m) => (
                          <SelectItem key={m.key} description={m.description}>{m.label}</SelectItem>
                        ))}
                      </Select>
                      {options.resizeMode === 'none' ? (
                        <p className="text-xs text-default-400">
                          Output will keep original dimensions{originalInfo ? ` (${originalInfo.width}×${originalInfo.height})` : ''}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            label={options.resizeMode === 'stretch' ? 'Width' : 'Max Width'}
                            size="sm"
                            placeholder={originalInfo ? `${originalInfo.width}` : 'No limit'}
                            value={options.maxWidth || ''}
                            onValueChange={(v) => updateOption('maxWidth', parseInt(v) || 0)}
                            endContent={<span className="text-[10px] text-default-400">px</span>}
                          />
                          <Input
                            type="number"
                            label={options.resizeMode === 'stretch' ? 'Height' : 'Max Height'}
                            size="sm"
                            placeholder={originalInfo ? `${originalInfo.height}` : 'No limit'}
                            value={options.maxHeight || ''}
                            onValueChange={(v) => updateOption('maxHeight', parseInt(v) || 0)}
                            endContent={<span className="text-[10px] text-default-400">px</span>}
                          />
                        </div>
                      )}
                    </div>

                    <Divider />

                    {/* Advanced section */}
                    <button
                      type="button"
                      className="flex items-center justify-between w-full text-sm font-medium text-default-600 hover:text-foreground transition-colors"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      <span className="flex items-center gap-1.5">
                        <Layers size={14} />
                        Advanced Options
                      </span>
                      {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showAdvanced && (
                      <div className="flex flex-col gap-4 pl-1 border-l-2 border-default-200 ml-1">
                        {/* Smoothing / interpolation */}
                        <Select
                          label="Resampling Algorithm"
                          size="sm"
                          selectedKeys={[options.smoothing]}
                          onSelectionChange={(keys) => updateOption('smoothing', [...keys][0] || 'high')}
                          description="Controls how pixels are interpolated when resizing"
                        >
                          {SMOOTHING_OPTIONS.map((s) => (
                            <SelectItem key={s.key}>{s.label}</SelectItem>
                          ))}
                        </Select>

                        {/* Background color (for transparent → JPEG) */}
                        <div>
                          <p className="text-xs font-medium mb-1.5">Background Fill</p>
                          <p className="text-[10px] text-default-400 mb-2">
                            Used when converting transparent images to JPEG
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={options.bgColor}
                              onChange={(e) => updateOption('bgColor', e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border border-default-200"
                            />
                            <Input
                              size="sm"
                              value={options.bgColor}
                              onValueChange={(v) => updateOption('bgColor', v)}
                              className="flex-1"
                              placeholder="#ffffff"
                            />
                          </div>
                        </div>

                        <Divider />

                        {/* Image adjustments */}
                        <div>
                          <p className="text-xs font-medium mb-3 flex items-center gap-1.5">
                            <Palette size={12} /> Color Adjustments
                          </p>

                          <div className="flex flex-col gap-3">
                            <Slider
                              label={
                                <span className="flex items-center gap-1">
                                  <Sun size={12} /> Brightness
                                </span>
                              }
                              step={1}
                              minValue={-100}
                              maxValue={100}
                              value={options.brightness}
                              onChange={(v) => updateOption('brightness', v)}
                              size="sm"
                              showTooltip
                              renderValue={() => (
                                <span className="text-xs font-mono w-8 text-right">{options.brightness}</span>
                              )}
                            />

                            <Slider
                              label={
                                <span className="flex items-center gap-1">
                                  <Contrast size={12} /> Contrast
                                </span>
                              }
                              step={1}
                              minValue={-100}
                              maxValue={100}
                              value={options.contrast}
                              onChange={(v) => updateOption('contrast', v)}
                              size="sm"
                              showTooltip
                              renderValue={() => (
                                <span className="text-xs font-mono w-8 text-right">{options.contrast}</span>
                              )}
                            />

                            <Slider
                              label={
                                <span className="flex items-center gap-1">
                                  <Droplets size={12} /> Saturation
                                </span>
                              }
                              step={1}
                              minValue={-100}
                              maxValue={100}
                              value={options.saturation}
                              onChange={(v) => updateOption('saturation', v)}
                              size="sm"
                              showTooltip
                              renderValue={() => (
                                <span className="text-xs font-mono w-8 text-right">{options.saturation}</span>
                              )}
                            />
                          </div>
                        </div>

                        <Divider />

                        <Slider
                          label="Blur"
                          step={0.5}
                          minValue={0}
                          maxValue={20}
                          value={options.blur}
                          onChange={(v) => updateOption('blur', v)}
                          size="sm"
                          showTooltip
                          renderValue={() => (
                            <span className="text-xs font-mono w-8 text-right">{options.blur}px</span>
                          )}
                        />

                        <Switch
                          size="sm"
                          isSelected={options.grayscale}
                          onValueChange={(v) => updateOption('grayscale', v)}
                        >
                          <span className="text-sm">Grayscale</span>
                        </Switch>
                      </div>
                    )}

                    {/* Reset button */}
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<RotateCcw size={14} />}
                      onPress={resetOptions}
                      className="mt-1"
                    >
                      Reset All Options
                    </Button>
                  </div>
                </Tab>

                {/* Crop & Extend tab */}
                <Tab
                  key="crop"
                  title={
                    <div className="flex items-center gap-1.5">
                      <Crop size={14} />
                      <span>Crop & Pad</span>
                    </div>
                  }
                >
                  <div className="flex flex-col gap-5">
                    {/* ── Crop Section ── */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Crop size={14} /> Crop
                        </p>
                        <Switch
                          size="sm"
                          isSelected={cropEnabled}
                          onValueChange={(v) => {
                            setCropEnabled(v);
                            if (!v) { setCropApplied(false); setCropRect({ x: 0, y: 0, w: 0, h: 0 }); setPreviewVersion(ver => ver + 1); }
                          }}
                        />
                      </div>

                      {cropEnabled && (
                        <div className="flex flex-col gap-3">
                          {/* Aspect ratio presets */}
                          <div>
                            <p className="text-xs text-default-500 mb-1.5">Aspect Ratio</p>
                            <div className="flex flex-wrap gap-1">
                              {CROP_ASPECT_PRESETS.map((preset) => {
                                const Icon = preset.icon;
                                return (
                                  <Chip
                                    key={preset.key}
                                    variant={cropAspect === preset.key ? 'solid' : 'flat'}
                                    color={cropAspect === preset.key ? 'primary' : 'default'}
                                    className="cursor-pointer"
                                    startContent={<Icon size={10} />}
                                    size="sm"
                                    onClick={() => {
                                      setCropAspect(preset.key);
                                      // Adjust crop rect to match new aspect ratio
                                      if (preset.ratio && originalInfo) {
                                        const r = preset.ratio;
                                        const maxW = cropRect.w || originalInfo.width;
                                        const maxH = cropRect.h || originalInfo.height;
                                        let w, h;
                                        if (maxW / maxH > r) {
                                          h = maxH;
                                          w = Math.round(h * r);
                                        } else {
                                          w = maxW;
                                          h = Math.round(w / r);
                                        }
                                        const cx = Math.max(0, Math.round(cropRect.x + (cropRect.w - w) / 2));
                                        const cy = Math.max(0, Math.round(cropRect.y + (cropRect.h - h) / 2));
                                        setCropRect({
                                          x: Math.min(cx, originalInfo.width - w),
                                          y: Math.min(cy, originalInfo.height - h),
                                          w, h,
                                        });
                                      }
                                    }}
                                  >
                                    {preset.label}
                                  </Chip>
                                );
                              })}
                            </div>
                          </div>

                          {/* Interactive crop canvas */}
                          <div className="relative bg-default-100 rounded-lg overflow-hidden" style={{ height: 220 }}>
                            <canvas
                              ref={cropCanvasRef}
                              className="w-full h-full"
                              onMouseDown={handleCropPointerDown}
                              onTouchStart={handleCropPointerDown}
                              onMouseMove={(e) => {
                                if (!cropDragging && cropCanvasRef.current) {
                                  cropCanvasRef.current.style.cursor = getCropCursor(e);
                                }
                              }}
                              style={{ touchAction: 'none' }}
                            />
                          </div>

                          {/* Crop dimensions — numeric inputs */}
                          <div className="grid grid-cols-4 gap-1.5">
                            <Input
                              type="number"
                              label="X"
                              size="sm"
                              value={Math.round(cropRect.x) || ''}
                              onValueChange={(v) => {
                                const val = Math.max(0, Math.min(parseInt(v) || 0, originalInfo ? originalInfo.width - cropRect.w : 9999));
                                setCropRect(prev => ({ ...prev, x: val }));
                              }}
                              classNames={{ input: "text-xs" }}
                            />
                            <Input
                              type="number"
                              label="Y"
                              size="sm"
                              value={Math.round(cropRect.y) || ''}
                              onValueChange={(v) => {
                                const val = Math.max(0, Math.min(parseInt(v) || 0, originalInfo ? originalInfo.height - cropRect.h : 9999));
                                setCropRect(prev => ({ ...prev, y: val }));
                              }}
                              classNames={{ input: "text-xs" }}
                            />
                            <Input
                              type="number"
                              label="W"
                              size="sm"
                              value={Math.round(cropRect.w) || ''}
                              onValueChange={(v) => {
                                const val = Math.max(1, parseInt(v) || 1);
                                setCropRect(prev => ({ ...prev, w: Math.min(val, originalInfo ? originalInfo.width - prev.x : val) }));
                              }}
                              classNames={{ input: "text-xs" }}
                            />
                            <Input
                              type="number"
                              label="H"
                              size="sm"
                              value={Math.round(cropRect.h) || ''}
                              onValueChange={(v) => {
                                const val = Math.max(1, parseInt(v) || 1);
                                setCropRect(prev => ({ ...prev, h: Math.min(val, originalInfo ? originalInfo.height - prev.y : val) }));
                              }}
                              classNames={{ input: "text-xs" }}
                            />
                          </div>

                          {/* Apply / reset crop */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              color="primary"
                              variant={cropApplied ? 'solid' : 'flat'}
                              className="flex-1"
                              startContent={<Crop size={14} />}
                              onPress={() => { setCropApplied(!cropApplied); setPreviewVersion(v => v + 1); }}
                            >
                              {cropApplied ? 'Crop Applied ✓' : 'Apply Crop'}
                            </Button>
                            <Tooltip content="Reset crop to full image">
                              <Button
                                size="sm"
                                variant="flat"
                                isIconOnly
                                onPress={() => {
                                  if (originalInfo) setCropRect({ x: 0, y: 0, w: originalInfo.width, h: originalInfo.height });
                                  setCropApplied(false);
                                }}
                              >
                                <RotateCcw size={14} />
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      )}
                    </div>

                    <Divider />

                    {/* ── Extend / Pad Section ── */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Expand size={14} /> Extend / Pad
                        </p>
                        <Switch
                          size="sm"
                          isSelected={extendEnabled}
                          onValueChange={(v) => {
                            setExtendEnabled(v);
                            if (!v) { setExtendApplied(false); setExtendPadding({ top: 0, right: 0, bottom: 0, left: 0 }); setPreviewVersion(ver => ver + 1); }
                          }}
                        />
                      </div>

                      {extendEnabled && (
                        <div className="flex flex-col gap-3">
                          {/* Padding color mode */}
                          <div>
                            <p className="text-xs text-default-500 mb-1.5">Fill Color</p>
                            <div className="flex flex-wrap gap-1">
                              {EXTEND_COLOR_MODES.map((cm) => (
                                <Chip
                                  key={cm.key}
                                  variant={extendColorMode === cm.key ? 'solid' : 'flat'}
                                  color={extendColorMode === cm.key ? 'secondary' : 'default'}
                                  className="cursor-pointer"
                                  size="sm"
                                  onClick={() => setExtendColorMode(cm.key)}
                                >
                                  {cm.label}
                                </Chip>
                              ))}
                            </div>
                          </div>

                          {/* Auto-detect result */}
                          {extendColorMode === 'auto' && detectedEdgeColor && (
                            <div className="flex items-center gap-2 text-xs text-default-500">
                              <Pipette size={12} />
                              <span>Detected:</span>
                              {detectedEdgeColor === 'transparent' ? (
                                <span className="italic">Transparent</span>
                              ) : (
                                <>
                                  <div
                                    className="w-5 h-5 rounded border border-default-300"
                                    style={{ backgroundColor: detectedEdgeColor }}
                                  />
                                  <span className="font-mono">{detectedEdgeColor}</span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Custom color picker */}
                          {extendColorMode === 'custom' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={extendCustomColor}
                                onChange={(e) => setExtendCustomColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border border-default-200"
                              />
                              <Input
                                size="sm"
                                value={extendCustomColor}
                                onValueChange={setExtendCustomColor}
                                className="flex-1"
                                placeholder="#ffffff"
                              />
                            </div>
                          )}

                          {/* Extend preview swatch */}
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-default-500">Preview:</p>
                            <div className="relative w-16 h-10 rounded border border-default-300 overflow-hidden bg-[repeating-conic-gradient(#80808030_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]">
                              <div
                                className="absolute inset-0"
                                style={{ backgroundColor: extendDisplayColor === 'transparent' ? 'transparent' : extendDisplayColor }}
                              />
                            </div>
                          </div>

                          <Divider />

                          {/* Link sides toggle */}
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-default-500">Padding (px)</p>
                            <Tooltip content={linkExtendSides ? 'Linked: all sides change together' : 'Independent: each side separate'}>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => setLinkExtendSides(!linkExtendSides)}
                              >
                                {linkExtendSides ? <Lock size={14} /> : <Unlock size={14} />}
                              </Button>
                            </Tooltip>
                          </div>

                          {/* Padding visual layout */}
                          <div className="flex flex-col items-center gap-1">
                            {/* Top */}
                            <Input
                              type="number"
                              size="sm"
                              placeholder="0"
                              value={extendPadding.top || ''}
                              onValueChange={(v) => updateExtendPadding('top', v)}
                              className="w-20"
                              classNames={{ input: "text-center text-xs" }}
                              startContent={<span className="text-[10px] text-default-400">T</span>}
                            />
                            <div className="flex items-center gap-1">
                              {/* Left */}
                              <Input
                                type="number"
                                size="sm"
                                placeholder="0"
                                value={extendPadding.left || ''}
                                onValueChange={(v) => updateExtendPadding('left', v)}
                                className="w-20"
                                classNames={{ input: "text-center text-xs" }}
                                startContent={<span className="text-[10px] text-default-400">L</span>}
                              />
                              {/* Center preview */}
                              <div
                                className="w-16 h-12 rounded border-2 border-dashed border-default-300 flex items-center justify-center"
                                style={{
                                  borderColor: extendDisplayColor === 'transparent' ? undefined : extendDisplayColor,
                                  borderWidth: '3px',
                                }}
                              >
                                <span className="text-[9px] text-default-400">IMG</span>
                              </div>
                              {/* Right */}
                              <Input
                                type="number"
                                size="sm"
                                placeholder="0"
                                value={extendPadding.right || ''}
                                onValueChange={(v) => updateExtendPadding('right', v)}
                                className="w-20"
                                classNames={{ input: "text-center text-xs" }}
                                startContent={<span className="text-[10px] text-default-400">R</span>}
                              />
                            </div>
                            {/* Bottom */}
                            <Input
                              type="number"
                              size="sm"
                              placeholder="0"
                              value={extendPadding.bottom || ''}
                              onValueChange={(v) => updateExtendPadding('bottom', v)}
                              className="w-20"
                              classNames={{ input: "text-center text-xs" }}
                              startContent={<span className="text-[10px] text-default-400">B</span>}
                            />
                          </div>

                          {/* Resulting dimensions */}
                          {processedDims && (
                            <p className="text-xs text-default-500 text-center">
                              Output: {processedDims.w}×{processedDims.h} px
                            </p>
                          )}

                          {/* Apply extend */}
                          <Button
                            size="sm"
                            color="secondary"
                            variant={extendApplied ? 'solid' : 'flat'}
                            className="w-full"
                            startContent={<Expand size={14} />}
                            onPress={() => { setExtendApplied(!extendApplied); setPreviewVersion(v => v + 1); }}
                          >
                            {extendApplied ? 'Padding Applied ✓' : 'Apply Padding'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Active crop/extend indicators */}
                    {(cropApplied || extendApplied) && (
                      <>
                        <Divider />
                        <div className="flex flex-wrap gap-1.5">
                          {cropApplied && (
                            <Chip
                              size="sm"
                              color="primary"
                              variant="flat"
                              onClose={() => { setCropApplied(false); setCropEnabled(false); setCropRect({ x: 0, y: 0, w: 0, h: 0 }); setPreviewVersion(v => v + 1); }}
                            >
                              Crop: {Math.round(cropRect.w)}×{Math.round(cropRect.h)}
                            </Chip>
                          )}
                          {extendApplied && (
                            <Chip
                              size="sm"
                              color="secondary"
                              variant="flat"
                              onClose={() => { setExtendApplied(false); setExtendEnabled(false); setExtendPadding({ top: 0, right: 0, bottom: 0, left: 0 }); setPreviewVersion(v => v + 1); }}
                            >
                              Pad: {extendPadding.top}/{extendPadding.right}/{extendPadding.bottom}/{extendPadding.left}
                            </Chip>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </Tab>
              </Tabs>
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="border-t border-default-200">
          <div className="flex items-center gap-2 w-full justify-between flex-wrap">
            <div className="flex items-center gap-2">
              {originalInfo && previewInfo && savings < 0 && (
                <Chip size="sm" variant="flat" color="success">
                  ~{Math.abs(savings)}% smaller
                </Chip>
              )}
              {originalInfo && previewInfo && savings > 0 && (
                <Chip size="sm" variant="flat" color="warning">
                  {savings}% larger — try lower quality
                </Chip>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Tooltip content="Download compressed image to your computer">
                <Button
                  variant="flat"
                  startContent={<Download size={16} />}
                  onPress={handleDownloadPreview}
                  isLoading={processing}
                >
                  Download
                </Button>
              </Tooltip>
              <Button
                color="primary"
                startContent={<Upload size={16} />}
                onPress={handleCompress}
                isLoading={processing}
              >
                {mode === 'replace' ? 'Compress & Replace' : `Compress & Upload${files.length > 1 ? ` (${files.length})` : ''}`}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
