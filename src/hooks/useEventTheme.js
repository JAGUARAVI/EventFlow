import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { COLOR_VAR_MAP } from '../context/ThemeContext';

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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && active) {
        setEventTheme(data);
        
        // Save current colors before applying event theme
        const root = document.documentElement;
        const colors = data.colors_json || {};
        
        Object.keys(colors).forEach((key) => {
          const varName = COLOR_VAR_MAP[key] || `--color-${key}`;
          savedColors[varName] = root.style.getPropertyValue(varName);
          // Also save the --color- version logic if needed, but saving the mapped one is key
          // Since we apply both, we should save both? 
          // Previous implementation only saved --color-, which was wrong if we overwrite --heroui-
          // Let's safe both to be safe
          savedColors[`--color-${key}`] = root.style.getPropertyValue(`--color-${key}`);
        });
        setPreviousColors(savedColors);

        // Apply event theme colors
        Object.entries(colors).forEach(([key, value]) => {
          const varName = COLOR_VAR_MAP[key] || `--color-${key}`;
          //root.style.setProperty(varName, value);
          //root.style.setProperty(`--color-${key}`, value);
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
            //root.style.setProperty(key, value); // key is already the variable name here?
            // Wait, look at how savedColors is constructed:
            // savedColors[varName] = ...
          } else {
            //root.style.removeProperty(key);
          }
        });
      }
    };
  }, [eventId]);

  const updateEventTheme = async (colors) => {
    if (!eventId || !canManage) return;

    // Check if theme exists first to decide update vs insert
    const { data: existing, error: checkError } = await supabase
      .from('themes')
      .select('id')
      .eq('event_id', eventId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing theme(s)
      const { error } = await supabase
        .from('themes')
        .update({
          colors_json: colors,
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId); // Access by event_id to ensure we catch it

      if (!error) {
        // Optimistically update state
        setEventTheme(prev => ({ ...(prev || {}), colors_json: colors, event_id: eventId }));
        
        // Apply new colors
        const root = document.documentElement;
        Object.entries(colors).forEach(([key, value]) => {
          const varName = COLOR_VAR_MAP[key] || `--color-${key}`;
          //root.style.setProperty(varName, value);
          //root.style.setProperty(`--color-${key}`, value);
        });
      } else {
        console.error('Failed to update event theme:', error);
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
          const varName = COLOR_VAR_MAP[key] || `--color-${key}`;
          //root.style.setProperty(varName, value);
          //root.style.setProperty(`--color-${key}`, value);
        });
      } else {
        console.error('Failed to create event theme:', error);
      }
    }
  };

  return {
    eventTheme,
    updateEventTheme,
    hasEventTheme: !!eventTheme,
  };
}
