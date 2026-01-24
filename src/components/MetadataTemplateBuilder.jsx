import { useState } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  Divider,
  Switch,
} from '@heroui/react';
import { Plus, Trash2, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'url', label: 'URL' },
];

export default function MetadataTemplateBuilder({ eventId, initialTemplate, onSave }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState(initialTemplate?.fields_json || []);
  const [newField, setNewField] = useState({ name: '', type: 'text', required: false });
  const [saving, setSaving] = useState(false);

  const handleAddField = () => {
    if (!newField.name.trim()) return;

    const field = {
      ...newField,
      id: Math.random().toString(36).substr(2, 9),
    };

    if (field.type === 'select' || field.type === 'multiselect') {
      field.options = [];
    }

    setFields([...fields, field]);
    setNewField({ name: '', type: 'text', required: false });
  };

  const handleRemoveField = (fieldId) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };

  const handleFieldChange = (fieldId, key, value) => {
    setFields(
      fields.map((f) => (f.id === fieldId ? { ...f, [key]: value } : f))
    );
  };

  const handleAddOption = (fieldId, optionValue) => {
    if (!optionValue.trim()) return;

    setFields(
      fields.map((f) => {
        if (f.id === fieldId && (f.type === 'select' || f.type === 'multiselect')) {
          return {
            ...f,
            options: [...(f.options || []), optionValue],
          };
        }
        return f;
      })
    );
  };

  const handleRemoveOption = (fieldId, optionIndex) => {
    setFields(
      fields.map((f) => {
        if (f.id === fieldId) {
          return {
            ...f,
            options: (f.options || []).filter((_, i) => i !== optionIndex),
          };
        }
        return f;
      })
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (initialTemplate) {
        // Update existing
        const { error } = await supabase
          .from('metadata_templates')
          .update({ fields_json: fields })
          .eq('id', initialTemplate.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('metadata_templates')
          .insert({
            event_id: eventId,
            fields_json: fields,
            created_by: user?.id,
          });

        if (error) throw error;
      }

      if (onSave) {
        onSave(fields);
      }
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Error saving template: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        startContent={<Settings size={16} />}
        onPress={() => setIsOpen(true)}
        variant="bordered"
        size="sm"
      >
        {initialTemplate ? 'Edit' : 'Create'} Team Fields
      </Button>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen} size="2xl">
        <ModalContent>
          <ModalHeader>Team Metadata Fields</ModalHeader>

          <ModalBody className="gap-4">
            <p className="text-sm text-default-600">
              Define custom fields that will appear in team profiles
            </p>

            {/* Existing Fields */}
            {fields.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Current Fields</h4>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <Card key={field.id} isBlurred>
                      <CardBody className="gap-2 p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{field.name}</p>
                            <p className="text-xs text-default-600">
                              Type: {FIELD_TYPES.find((t) => t.value === field.type)?.label}
                              {field.required ? ' • Required' : ''}
                            </p>

                            {field.options && field.options.length > 0 && (
                              <div className="mt-2 flex gap-1 flex-wrap">
                                {field.options.map((opt, idx) => (
                                  <div key={idx} className="text-xs bg-default-200 px-2 py-1 rounded">
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <Button
                            isIconOnly
                            size="sm"
                            color="danger"
                            variant="light"
                            onPress={() => handleRemoveField(field.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Divider />

            {/* Add New Field */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Add New Field</h4>

              <Input
                label="Field Name"
                placeholder="e.g., School, Contact Person, Team Color"
                value={newField.name}
                onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                size="sm"
              />

              <div className="flex gap-2 mt-3">
                <Select
                  label="Type"
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                  size="sm"
                  className="flex-1"
                >
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </Select>

                <Switch
                  checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  size="sm"
                  className="mt-4"
                >
                  Required
                </Switch>
              </div>

              {(newField.type === 'select' || newField.type === 'multiselect') && (
                <div className="mt-3">
                  <p className="text-xs text-default-600 mb-2">Options</p>
                  <div className="space-y-2">
                    {(newField.options || []).map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={opt}
                          disabled
                          size="sm"
                          className="flex-1"
                        />
                        <Button
                          isIconOnly
                          size="sm"
                          color="danger"
                          variant="light"
                          onPress={() => {
                            const updated = [...(newField.options || [])];
                            updated.splice(idx, 1);
                            setNewField({ ...newField, options: updated });
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}

                    <Input
                      placeholder="Add option..."
                      size="sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddOption(
                            'temp',
                            e.target.value
                          );
                          setNewField({
                            ...newField,
                            options: [
                              ...(newField.options || []),
                              e.target.value,
                            ],
                          });
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <Button
                startContent={<Plus size={16} />}
                onPress={handleAddField}
                color="primary"
                variant="flat"
                size="sm"
                className="mt-3 w-full"
                isDisabled={!newField.name.trim()}
              >
                Add Field
              </Button>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button color="default" onPress={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSave}
              isLoading={saving}
              isDisabled={fields.length === 0}
            >
              Save Template
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
