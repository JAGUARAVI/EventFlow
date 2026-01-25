import { useState, useEffect } from 'react';
import {
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
  cn
} from '@heroui/react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export default function ThemeBuilder({ isOpen, onOpenChange, eventId, currentTheme, onSave }) {
  const [selectedTheme, setSelectedTheme] = useState(currentTheme || 'modern');
  const [loading, setLoading] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    if (currentTheme) {
        setSelectedTheme(currentTheme);
    }
  }, [currentTheme, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Fetch current settings to preserve other keys
      const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('settings')
        .eq('id', eventId)
        .single();
      
      if (fetchError) throw fetchError;

      const currentSettings = event.settings || {};
      const newSettings = { ...currentSettings, theme: selectedTheme };

        const { error } = await supabase
        .from('events')
        .update({ settings: newSettings })
        .eq('id', eventId);
      
      if (error) throw error;
      
      onSave(selectedTheme);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const CustomRadio = (props) => {
    const {children, ...otherProps} = props;
    return (
      <Radio
        {...otherProps}
        classNames={{
          base: cn(
            "inline-flex m-0 bg-content1 hover:bg-content2 items-center justify-between",
            "flex-row-reverse max-w-full cursor-pointer rounded-lg gap-4 p-4 border-2 border-transparent",
            "data-[selected=true]:border-primary"
          ),
        }}
      >
        {children}
      </Radio>
    );
  };

  return (
    <Modal className={selectedTheme + (isDark ? "-dark" : "-light")} isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Select Event Theme</ModalHeader>
            <ModalBody>
              <RadioGroup
                description="Choose a theme to apply to this event page."
                value={selectedTheme}
                onValueChange={setSelectedTheme}
              >
                <CustomRadio description="Default dark/light appearance" value="modern">
                  Modern
                </CustomRadio>
                <CustomRadio description="Brand colors (Deep Blue & Hot Pink)" value="sunset">
                  Sunset
                </CustomRadio>
                <CustomRadio description="Rich brown tones with a cozy feel" value="coffee">
                  Coffee
                </CustomRadio>
                <CustomRadio description="Vibrant greens and blues for a fresh look" value="fresh">
                  Fresh
                </CustomRadio>
              </RadioGroup>
              
              <div className="mt-4 p-4 rounded-lg border border-default-200">
                <h4 className="text-small font-bold mb-2">Preview</h4>
                <div className="p-4 rounded-md transition-colors">
                  <p className="font-bold">Event Title</p>
                  <Button size="sm" className="mt-2">
                    Action
                  </Button>
                </div>
              </div>

            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave} isLoading={loading}>
                Save Theme
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
