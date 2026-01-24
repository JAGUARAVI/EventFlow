import { useState, useEffect, useRef } from 'react';
import {
  Button,
  Card,
  CardBody,
  Input,
  Divider,
} from '@heroui/react';
import { Palette, RotateCcw } from 'lucide-react';
import { useTheme, COLOR_VAR_MAP } from '../context/ThemeContext';

export default function ThemeBuilder({ isOpen, onOpenChange, initialColors, onSave }) {
  const { colors, updateColors, resetColors, defaultColors } = useTheme();
  const [tempColors, setTempColors] = useState(initialColors || colors);
  const savedRef = useRef(false);

  // Update tempColors when initialColors changes (for event themes)
  useEffect(() => {
    if (initialColors) {
      setTempColors(initialColors);
    }
  }, [initialColors]);

  // Live preview and cleanup
  useEffect(() => {
    const root = document.documentElement;
    // Apply temporary colors for preview
    Object.entries(tempColors).forEach(([key, value]) => {
      const varName = COLOR_VAR_MAP[key] || `--color-${key}`;
      //root.style.setProperty(varName, value);
      // Keep legacy support for now
      //root.style.setProperty(`--color-${key}`, value);
    });

    return () => {
      // On unmount or change, if not saved, revert to original
      // This runs before the next effect or on unmount
      if (!savedRef.current) {
        // If we are unmounting permanently (modal closed without save), this reverts.
        // If just re-rendering (color change), the next effect immediately re-applies tempColors.
      }
    };
  }, [tempColors]);

  // Handle final cleanup on unmount
  useEffect(() => {
    return () => {
      if (!savedRef.current) {
        const root = document.documentElement;
        // Revert to initial state (either event specific or global)
        const target = initialColors || colors;
        Object.entries(target).forEach(([key, value]) => {
           const varName = COLOR_VAR_MAP[key] || `--color-${key}`;
           if(value) {
             //root.style.setProperty(varName, value);
             //root.style.setProperty(`--color-${key}`, value);
           } else {
             //root.style.removeProperty(varName);
             //root.style.removeProperty(`--color-${key}`);
           }
        });
      }
    };
  }, []); // Run once on mount, cleanup on unmount

  const handleColorChange = (key, value) => {
    setTempColors(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    savedRef.current = true;
    if (onSave) {
      // Event-specific theme save - DO NOT update global localStorage
      onSave(tempColors);
    } else {
      // Global theme save
      updateColors(tempColors);
    }
    if (onOpenChange) onOpenChange(false);
  };

  const handleCancel = () => {
    // Revert logic handled by unmount effect, but we can also be explicit
    setTempColors(initialColors || colors); // Updates state, triggering effect
    if (onOpenChange) onOpenChange(false);
  };

  const handleReset = () => {
    setTempColors(defaultColors);
    updateColors(defaultColors); // Also update global theme to reflect changes
  };

  const colorLabels = {
    primary: 'Primary',
    secondary: 'Secondary',
    accent: 'Accent',
    neutral: 'Neutral',
    surface: 'Surface',
    background: 'Background',
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-default-600">
        {onSave ? 'Customize event colors. Changes will be visible to all viewers.' : 'Customize your theme colors. Changes are saved locally.'}
      </p>

      <Divider />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(colorLabels).map(([key, label]) => (
          <Card key={key} isBlurred>
            <CardBody className="gap-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-sm">{label}</label>
                <div
                  className="w-8 h-8 rounded border-2 border-default-300 cursor-pointer"
                  style={{ backgroundColor: tempColors[key] }}
                  title={tempColors[key]}
                />
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  size="sm"
                  value={tempColors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  placeholder="#000000"
                />
                <input
                  type="color"
                  value={tempColors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-10 h-10 cursor-pointer border border-default-300 rounded"
                />
              </div>

              {tempColors[key] !== defaultColors[key] && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleColorChange(key, defaultColors[key])}
                >
                  Reset to default
                </Button>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <Divider />

      <div>
        <h4 className="font-semibold text-sm mb-2">Preview</h4>
        <Card isBlurred>
          <CardBody className="gap-3">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(colorLabels).map(([key, label]) => (
                <div key={key}>
                  <div
                    className="w-12 h-12 rounded flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: tempColors[key] }}
                    title={label}
                  >
                    {label.charAt(0)}
                  </div>
                  <p className="text-xs text-default-600 text-center mt-1">{label}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          isIconOnly
          color="default"
          variant="light"
          onPress={handleReset}
          title="Reset all to default"
        >
          <RotateCcw size={18} />
        </Button>

        <Button
          color="primary"
          onPress={handleApply}
          startContent={<Palette size={16} />}
        >
          Apply Theme
        </Button>
      </div>
    </div>
  );
}
