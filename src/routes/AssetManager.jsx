import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  CardBody,
  Button,
  Input,
  Chip,
  Spinner,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  addToast,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react';
import {
  Upload,
  Trash2,
  Copy,
  Search,
  Image,
  FileText,
  Film,
  Music,
  File,
  Grid3X3,
  List,
  FolderPlus,
  ExternalLink,
  HardDrive,
  Check,
  MoreVertical,
  Download,
  Eye,
} from 'lucide-react';
import { listAssets, uploadAsset, deleteAssets, getAssetPublicUrl } from '../lib/assets';

const ITEMS_PER_PAGE = 24;

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'ico', 'bmp'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];

function getFileExt(name) {
  return (name || '').split('.').pop().toLowerCase();
}

function getFileIcon(name) {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.includes(ext)) return <Image size={20} className="text-primary" />;
  if (VIDEO_EXTS.includes(ext)) return <Film size={20} className="text-warning" />;
  if (AUDIO_EXTS.includes(ext)) return <Music size={20} className="text-secondary" />;
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx'].includes(ext))
    return <FileText size={20} className="text-success" />;
  return <File size={20} className="text-default-400" />;
}

function isImageFile(name) {
  return IMAGE_EXTS.includes(getFileExt(name));
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function stripTimestampPrefix(name) {
  // Files are stored as {timestamp}_{originalName} — show original name
  return name.replace(/^\d+_/, '');
}

export default function AssetManager() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [previewAsset, setPreviewAsset] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const {
    isOpen: isPreviewOpen,
    onOpen: onPreviewOpen,
    onClose: onPreviewClose,
  } = useDisclosure();

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listAssets();
    if (error) {
      addToast({ title: 'Failed to load assets', description: error.message, color: 'danger' });
    } else {
      // Filter out folder placeholders (.emptyFolderPlaceholder)
      setAssets((data || []).filter((f) => f.name && !f.name.startsWith('.')));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Filter
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter((a) => stripTimestampPrefix(a.name).toLowerCase().includes(q));
  }, [assets, searchQuery]);

  // Paginate
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Upload handler
  const handleUpload = useCallback(
    async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      setUploading(true);
      setUploadProgress(0);
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 50 MB limit
        if (file.size > 50 * 1024 * 1024) {
          addToast({ title: `${file.name} exceeds 50 MB limit`, color: 'warning' });
          failCount++;
          continue;
        }

        const { error } = await uploadAsset(file);
        if (error) {
          addToast({ title: `Failed to upload ${file.name}`, description: error.message, color: 'danger' });
          failCount++;
        } else {
          successCount++;
        }
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(false);
      setUploadProgress(0);

      if (successCount > 0) {
        addToast({
          title: `Uploaded ${successCount} file${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          color: 'success',
        });
        fetchAssets();
      }
    },
    [fetchAssets],
  );

  // Copy public URL
  const copyUrl = useCallback((name) => {
    const url = getAssetPublicUrl(name);
    navigator.clipboard.writeText(url);
    setCopiedId(name);
    setTimeout(() => setCopiedId(null), 2000);
    addToast({ title: 'URL copied to clipboard', color: 'success' });
  }, []);

  // Delete selected
  const handleDeleteSelected = useCallback(async () => {
    const paths = Array.from(selectedAssets);
    if (!paths.length) return;
    const { error } = await deleteAssets(paths);
    if (error) {
      addToast({ title: 'Failed to delete', description: error.message, color: 'danger' });
    } else {
      addToast({ title: `Deleted ${paths.length} asset${paths.length > 1 ? 's' : ''}`, color: 'success' });
      setSelectedAssets(new Set());
      fetchAssets();
    }
    onDeleteClose();
  }, [selectedAssets, fetchAssets, onDeleteClose]);

  // Delete single
  const handleDeleteSingle = useCallback(
    async (name) => {
      const { error } = await deleteAssets([name]);
      if (error) {
        addToast({ title: 'Failed to delete', description: error.message, color: 'danger' });
      } else {
        addToast({ title: 'Asset deleted', color: 'success' });
        fetchAssets();
      }
    },
    [fetchAssets],
  );

  // Toggle selection
  const toggleSelect = useCallback((name) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Select all / deselect all
  const toggleSelectAll = useCallback(() => {
    if (selectedAssets.size === paginated.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(paginated.map((a) => a.name)));
    }
  }, [selectedAssets, paginated]);

  // Preview
  const openPreview = useCallback(
    (asset) => {
      setPreviewAsset(asset);
      onPreviewOpen();
    },
    [onPreviewOpen],
  );

  // Drag-and-drop
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) {
        // Trigger through the same handler
        const fakeEvent = { target: { files } };
        handleUpload(fakeEvent);
      }
    },
    [handleUpload],
  );

  if (loading && assets.length === 0) {
    return (
      <div className="container mx-auto p-6 flex justify-center items-center min-h-[40vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      className="container mx-auto p-6 max-w-7xl"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <HardDrive className="w-8 h-8" />
          Asset Manager
        </h1>
        <p className="text-default-500">
          Upload and manage public assets for your events and club.
        </p>
      </div>

      {/* Toolbar */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={<Search size={16} />}
              isClearable
              onClear={() => setSearchQuery('')}
              className="flex-1"
              size="sm"
            />

            <div className="flex gap-2 flex-wrap">
              <Button
                color="primary"
                variant="shadow"
                startContent={<Upload size={16} />}
                onPress={() => fileInputRef.current?.click()}
                isLoading={uploading}
                size="sm"
              >
                {uploading ? `Uploading ${uploadProgress}%` : 'Upload Files'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
              />

              <div className="flex border border-default-200 rounded-lg overflow-hidden">
                <Button
                  isIconOnly
                  size="sm"
                  variant={viewMode === 'grid' ? 'solid' : 'light'}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                  onPress={() => setViewMode('grid')}
                >
                  <Grid3X3 size={16} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant={viewMode === 'list' ? 'solid' : 'light'}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  onPress={() => setViewMode('list')}
                >
                  <List size={16} />
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Drag-and-drop overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="border-2 border-dashed border-primary p-12">
            <CardBody className="flex flex-col items-center gap-4">
              <Upload size={48} className="text-primary animate-bounce" />
              <p className="text-xl font-semibold">Drop files to upload</p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Selection toolbar */}
      {selectedAssets.size > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <Chip variant="flat" color="primary">
            {selectedAssets.size} selected
          </Chip>
          <Button
            size="sm"
            variant="flat"
            onPress={toggleSelectAll}
          >
            {selectedAssets.size === paginated.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            startContent={<Trash2 size={14} />}
            onPress={onDeleteOpen}
          >
            Delete Selected
          </Button>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !loading && (
        <Card>
          <CardBody className="py-16 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-default-100 flex items-center justify-center">
              <FolderPlus size={36} className="text-default-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">
                {searchQuery ? 'No assets match your search' : 'No assets uploaded yet'}
              </p>
              <p className="text-default-500 text-sm mt-1">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Upload files by clicking the button above or drag & drop'}
              </p>
            </div>
            {!searchQuery && (
              <Button
                color="primary"
                startContent={<Upload size={16} />}
                onPress={() => fileInputRef.current?.click()}
              >
                Upload Your First Asset
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {paginated.map((asset) => {
            const isImage = isImageFile(asset.name);
            const publicUrl = getAssetPublicUrl(asset.name);
            const selected = selectedAssets.has(asset.name);
            const displayName = stripTimestampPrefix(asset.name);

            return (
              <Card
                key={asset.name}
                isPressable
                onPress={() => toggleSelect(asset.name)}
                className={`group transition-all ${selected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'}`}
              >
                <CardBody className="p-0 overflow-hidden">
                  {/* Thumbnail / icon */}
                  <div className="relative aspect-square bg-default-100 flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      <img
                        src={publicUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        {getFileIcon(asset.name)}
                        <span className="text-[10px] text-default-400 uppercase font-mono">
                          {getFileExt(asset.name)}
                        </span>
                      </div>
                    )}

                    {/* Selection indicator */}
                    <div
                      className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        selected
                          ? 'bg-primary border-primary'
                          : 'border-default-300 bg-background/60 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {selected && <Check size={12} className="text-white" />}
                    </div>

                    {/* Actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            className="bg-background/80 backdrop-blur-sm min-w-6 w-6 h-6"
                            onPress={(e) => e?.stopPropagation?.()}
                          >
                            <MoreVertical size={14} />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Asset actions">
                          {isImage && (
                            <DropdownItem
                              key="preview"
                              startContent={<Eye size={14} />}
                              onPress={() => openPreview(asset)}
                            >
                              Preview
                            </DropdownItem>
                          )}
                          <DropdownItem
                            key="copy"
                            startContent={copiedId === asset.name ? <Check size={14} /> : <Copy size={14} />}
                            onPress={() => copyUrl(asset.name)}
                          >
                            {copiedId === asset.name ? 'Copied!' : 'Copy URL'}
                          </DropdownItem>
                          <DropdownItem
                            key="open"
                            startContent={<ExternalLink size={14} />}
                            href={publicUrl}
                            target="_blank"
                          >
                            Open in Tab
                          </DropdownItem>
                          <DropdownItem
                            key="delete"
                            startContent={<Trash2 size={14} />}
                            color="danger"
                            className="text-danger"
                            onPress={() => handleDeleteSingle(asset.name)}
                          >
                            Delete
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </div>

                  {/* File info */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={displayName}>
                      {displayName}
                    </p>
                    <p className="text-[10px] text-default-400">
                      {formatBytes(asset.metadata?.size)}
                    </p>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filtered.length > 0 && (
        <div className="space-y-2">
          {paginated.map((asset) => {
            const isImage = isImageFile(asset.name);
            const publicUrl = getAssetPublicUrl(asset.name);
            const selected = selectedAssets.has(asset.name);
            const displayName = stripTimestampPrefix(asset.name);

            return (
              <Card
                key={asset.name}
                isPressable
                onPress={() => toggleSelect(asset.name)}
                className={`transition-all ${selected ? 'ring-2 ring-primary' : ''}`}
              >
                <CardBody className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Selection check */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? 'bg-primary border-primary' : 'border-default-300'
                      }`}
                    >
                      {selected && <Check size={12} className="text-white" />}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {isImage ? (
                        <img src={publicUrl} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        getFileIcon(asset.name)
                      )}
                    </div>

                    {/* Name & details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <div className="flex items-center gap-2 text-xs text-default-400">
                        <span>{formatBytes(asset.metadata?.size)}</span>
                        <span>·</span>
                        <span className="uppercase font-mono">{getFileExt(asset.name)}</span>
                        {asset.created_at && (
                          <>
                            <span>·</span>
                            <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isImage && (
                        <Tooltip content="Preview">
                          <Button isIconOnly size="sm" variant="light" onPress={() => openPreview(asset)}>
                            <Eye size={16} />
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip content={copiedId === asset.name ? 'Copied!' : 'Copy URL'}>
                        <Button isIconOnly size="sm" variant="light" onPress={() => copyUrl(asset.name)}>
                          {copiedId === asset.name ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                        </Button>
                      </Tooltip>
                      <Tooltip content="Open">
                        <Button
                          as="a"
                          href={publicUrl}
                          target="_blank"
                          isIconOnly
                          size="sm"
                          variant="light"
                        >
                          <ExternalLink size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => handleDeleteSingle(asset.name)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            total={totalPages}
            page={currentPage}
            onChange={setCurrentPage}
            showControls
            showShadow
          />
        </div>
      )}

      {/* Stats bar */}
      <div className="mt-4 text-xs text-default-400 text-center">
        {filtered.length} asset{filtered.length !== 1 ? 's' : ''}
        {searchQuery ? ` matching "${searchQuery}"` : ''}
        {' · '}
        {formatBytes(filtered.reduce((sum, a) => sum + (a.metadata?.size || 0), 0))} total
      </div>

      {/* Bulk delete confirmation modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm">
        <ModalContent>
          <ModalHeader>Delete {selectedAssets.size} asset{selectedAssets.size > 1 ? 's' : ''}?</ModalHeader>
          <ModalBody>
            <p className="text-default-500">
              This will permanently delete the selected file{selectedAssets.size > 1 ? 's' : ''}. This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDeleteSelected}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Image preview modal */}
      <Modal isOpen={isPreviewOpen} onClose={onPreviewClose} size="3xl">
        <ModalContent>
          {previewAsset && (
            <>
              <ModalHeader className="truncate">
                {stripTimestampPrefix(previewAsset.name)}
              </ModalHeader>
              <ModalBody className="p-2">
                <img
                  src={getAssetPublicUrl(previewAsset.name)}
                  alt={previewAsset.name}
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                />
              </ModalBody>
              <ModalFooter>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Copy size={14} />}
                    onPress={() => copyUrl(previewAsset.name)}
                  >
                    Copy URL
                  </Button>
                  <Button
                    as="a"
                    href={getAssetPublicUrl(previewAsset.name)}
                    target="_blank"
                    size="sm"
                    variant="flat"
                    startContent={<ExternalLink size={14} />}
                  >
                    Open Original
                  </Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
