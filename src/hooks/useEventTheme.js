import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to load and apply event-specific theme colors.
 * When viewing an event with a custom theme, applies those colors to CSS variables.
 * Restores previous theme when component unmounts.
 */
export function useEventTheme(eventId, canManage) {
  const [eventTheme, setEventTheme] = useState(null);
  const [previousColors, setPreviousColors] = useState({});

  useEffect(() => {
    if (!eventId) return;

    let active = true;
    const savedColors = {};

    const loadTheme = async () => {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();  // Use maybeSingle to avoid error when no rows

      if (!error && data && active) {
        setEventTheme(data);
        
        // Save current colors before applying event theme
        const root = document.documentElement;
        const colors = data.colors_json || {};
        
        Object.keys(colors).forEach((key) => {
          savedColors[key] = root.style.getPropertyValue(`--color-${key}`);
        });
        setPreviousColors(savedColors);

        // Apply event theme colors
        Object.entries(colors).forEach(([key, value]) => {
          root.style.setProperty(`--color-${key}`, value);
        });
      }
    };

    loadTheme();

    return () => {
      active = false;
      
      // Restore previous colors when leaving event
      if (Object.keys(savedColors).length > 0) {
        const root = document.documentElement;
        Object.entries(savedColors).forEach(([key, value]) => {
          if (value) {
            root.style.setProperty(`--color-${key}`, value);
          } else {
            root.style.removeProperty(`--color-${key}`);
          }
        });
      }
    };
  }, [eventId]);

  const updateEventTheme = async (colors) => {
    if (!eventId || !canManage) return;

    if (eventTheme) {
      // Update existing theme
      const { error } = await supabase
        .from('themes')
        .update({
          colors_json: colors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventTheme.id);

      if (!error) {
        setEventTheme({ ...eventTheme, colors_json: colors });
        
        // Apply new colors
        const root = document.documentElement;
        Object.entries(colors).forEach(([key, value]) => {
          root.style.setProperty(`--color-${key}`, value);
        });
      }
    } else {
      // Create new theme for this event
      const { data, error } = await supabase
        .from('themes')
        .insert([{
          event_id: eventId,
          name: 'Event Theme',
          colors_json: colors,
        }])
        .select()
        .single();

      if (!error && data) {
        setEventTheme(data);
        
        // Apply new colors
        const root = document.documentElement;
        Object.entries(colors).forEach(([key, value]) => {
          root.style.setProperty(`--color-${key}`, value);
        });
      }
    }
  };

  return {
    eventTheme,
    updateEventTheme,
    hasEventTheme: !!eventTheme,
  };
}
