import { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Button,
  Textarea,
  Slider,
  Chip,
  addToast,
} from '@heroui/react';
import { createCategory, updateCategory, deleteCategory } from '../lib/categories';
import { supabase } from '../lib/supabase';

/**
 * Manager-only modal for creating or editing a scoring category.
 * Pass `category` prop to edit; omit it to create.
 */
export default function CategoryModal({ isOpen, onClose, eventId, userId, onCreated, onUpdated, onDeleted, category = null }) {
  const isEditing = !!category;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync form when category changes (edit mode) or modal opens
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name || '');
        setDescription(category.description || '');
        setMultiplier(Number(category.points_multiplier) || 1);
      } else {
        setName('');
        setDescription('');
        setMultiplier(1);
      }
    }
  }, [isOpen, category]);

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({ title: 'Name is required', severity: 'warning' });
      return;
    }
    const mult = Number(multiplier);
    if (isNaN(mult) || mult <= 0) {
      addToast({ title: 'Multiplier must be a positive number', severity: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        // Update existing category
        const { data, error } = await updateCategory(category.id, {
          name: name.trim(),
          description: description.trim(),
          points_multiplier: mult,
        });

        if (error) {
          addToast({ title: 'Failed to update category', description: error.message, severity: 'danger' });
          return;
        }

        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'update',
          entity_type: 'category',
          entity_id: data.id,
          message: `Category "${data.name}" updated (×${mult})`,
          created_by: userId,
        });

        addToast({ title: 'Category updated', severity: 'success' });
        onUpdated?.(data);
      } else {
        // Create new category
        const { data, error } = await createCategory(
          eventId,
          { name: name.trim(), description: description.trim(), points_multiplier: mult },
          userId,
        );

        if (error) {
          addToast({ title: 'Failed to create category', description: error.message, severity: 'danger' });
          return;
        }

        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'create',
          entity_type: 'category',
          entity_id: data.id,
          message: `Category "${data.name}" created (×${mult})`,
          created_by: userId,
        });

        addToast({ title: 'Category created', severity: 'success' });
        onCreated?.(data);
      }
      onClose();
    } catch (err) {
      addToast({ title: 'Error', description: err.message, severity: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    setDeleting(true);
    try {
      const { error } = await deleteCategory(category.id);
      if (error) {
        addToast({ title: 'Failed to delete category', description: error.message, severity: 'danger' });
        return;
      }

      await supabase.from('event_audit').insert({
        event_id: eventId,
        action: 'delete',
        entity_type: 'category',
        entity_id: category.id,
        message: `Category "${category.name}" deleted`,
        created_by: userId,
      });

      addToast({ title: 'Category deleted', severity: 'success' });
      onDeleted?.(category.id);
      onClose();
    } catch (err) {
      addToast({ title: 'Error', description: err.message, severity: 'danger' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center">
      <ModalContent>
        <ModalHeader>{isEditing ? 'Edit Category' : 'New Scoring Category'}</ModalHeader>
        <ModalBody className="space-y-5">
          <Input
            label="Name"
            placeholder="e.g. Creativity, Technical, Presentation"
            value={name}
            onValueChange={setName}
            isRequired
            autoFocus
          />
          <Textarea
            label="Description"
            placeholder="What this category evaluates"
            value={description}
            onValueChange={setDescription}
            minRows={2}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-small font-medium">Points Multiplier</span>
              <Chip size="sm" variant="flat" color="primary">×{Number(multiplier).toFixed(1)}</Chip>
            </div>
            <Slider
              aria-label="Points multiplier"
              minValue={0.1}
              maxValue={5}
              step={0.1}
              value={multiplier}
              onChange={setMultiplier}
              showTooltip
              tooltipProps={{ content: `×${Number(multiplier).toFixed(1)}` }}
              classNames={{
                filler: 'bg-primary',
              }}
              renderThumb={(props) => (
                <div
                  {...props}
                  className="group top-1/2 cursor-grab data-[dragging=true]:cursor-grabbing p-1"
                >
                  <span className="block w-5 h-5 rounded-full bg-primary shadow-md ring-2 ring-background transition-transform group-data-[dragging=true]:scale-110" />
                </div>
              )}
            />
            <p className="text-tiny text-default-400">
              Main leaderboard adds multiplier × category points to cumulative total.
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="justify-between">
          <div>
            {isEditing && (
              <Button
                color="danger"
                variant="light"
                size="sm"
                isLoading={deleting}
                onPress={handleDelete}
              >
                Delete Category
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="flat" onPress={onClose}>Cancel</Button>
            <Button color="primary" isLoading={saving} onPress={handleSave}>
              {isEditing ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
