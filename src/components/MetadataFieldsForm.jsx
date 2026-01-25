import { useState, useEffect } from 'react';
import { Input, Select, SelectItem, Textarea, Checkbox, Card, CardBody } from '@heroui/react';
import { supabase } from '../lib/supabase';

/**
 * Component to display and edit metadata field values for a team
 * NOTE: Requires running migration 19_add_team_metadata_values.sql in Supabase
 * to add the metadata_values column to the teams table
 */
export default function MetadataFieldsForm({
  eventId,
  teamMetadata = {},
  onMetadataChange,
  onValidationChange,
  disabled = false,
}) {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [eventId]);

  useEffect(() => {
    if (!template || !template.fields_json || template.fields_json.length === 0) {
        onValidationChange?.(true);
        return;
    }

    const isValid = template.fields_json.every(field => {
        if (!field.required) return true;
        const value = teamMetadata[field.id];
        return value !== undefined && value !== null && String(value).trim() !== '';
    });

    onValidationChange?.(isValid);
  }, [template, teamMetadata, onValidationChange]);

  const loadTemplate = async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('metadata_templates')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (!error && data) {
      setTemplate(data);
    }
    setLoading(false);
  };

  if (loading || !template || !template.fields_json || template.fields_json.length === 0) {
    return null;
  }

  const fields = template.fields_json;

  const handleFieldChange = (fieldId, value) => {
    const updated = { ...teamMetadata, [fieldId]: value };
    onMetadataChange(updated);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Team Information</h4>
      <Card isBlurred>
        <CardBody className="gap-4">
          {fields.map((field) => {
            const value = teamMetadata[field.id] || '';

            if (field.type === 'text' || field.type === 'email' || field.type === 'url') {
              return (
                <Input
                  key={field.id}
                  label={field.name}
                  type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                  value={value}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  isRequired={field.required}
                  placeholder={`Enter ${field.name.toLowerCase()}`}
                  isDisabled={disabled}
                />
              );
            }

            if (field.type === 'number') {
              return (
                <Input
                  key={field.id}
                  label={field.name}
                  type="number"
                  value={value}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  isRequired={field.required}
                  placeholder={`Enter ${field.name.toLowerCase()}`}
                  isDisabled={disabled}
                />
              );
            }

            if (field.type === 'textarea') {
              return (
                <Textarea
                  key={field.id}
                  label={field.name}
                  value={value}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  isRequired={field.required}
                  placeholder={`Enter ${field.name.toLowerCase()}`}
                  minRows={2}
                  isDisabled={disabled}
                />
              );
            }

            if (field.type === 'select') {
              return (
                <Select
                  key={field.id}
                  label={field.name}
                  selectedKeys={value ? [value] : []}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  isRequired={field.required}
                  placeholder={`Select ${field.name.toLowerCase()}`}
                  isDisabled={disabled}
                >
                  {(field.options || []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </Select>
              );
            }

            if (field.type === 'multiselect') {
              const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
              return (
                <Select
                  key={field.id}
                  label={field.name}
                  selectionMode="multiple"
                  selectedKeys={new Set(selectedValues)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    handleFieldChange(field.id, selected);
                  }}
                  isRequired={field.required}
                  placeholder={`Select ${field.name.toLowerCase()}`}
                  isDisabled={disabled}
                >
                  {(field.options || []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </Select>
              );
            }

            return null;
          })}
        </CardBody>
      </Card>
    </div>
  );
}
