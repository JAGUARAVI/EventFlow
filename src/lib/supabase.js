import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublicKey = import.meta.env.VITE_SUPABASE_PUBLIC_KEY;

if (!supabaseUrl || !supabasePublicKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLIC_KEY. Create .env from .env.example');
}

export const supabase = createClient(supabaseUrl || '', supabasePublicKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 100, // Increased from 10 to handle rapid updates
    },
    heartbeatIntervalMs: 5000, // Send heartbeats more frequently to keep connection alive on mobile
  },
  global: {
    fetch: (...args) => {
      // Add request timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const [url, options = {}] = args;
      const fetchOptions = {
        ...options,
        signal: controller.signal,
      };
      
      return fetch(url, fetchOptions)
        .then(response => {
          clearTimeout(timeoutId);
          return response;
        })
        .catch(err => {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            console.error('[Supabase] Request timed out:', url);
            throw new Error('Request timed out. Please try again.');
          }
          throw err;
        });
    },
  },
});

/**
 * Helper to retry failed database operations with exponential backoff
 * @param {Function} operation - Async function that returns { data, error }
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<{data: any, error: any}>}
 */
export async function withRetry(operation, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // If no error, return immediately
      if (!result.error) {
        return result;
      }
      
      // Check if error is retryable
      const isRetryable = 
        result.error.message?.includes('timeout') ||
        result.error.message?.includes('network') ||
        result.error.message?.includes('Failed to fetch') ||
        result.error.code === 'PGRST301' || // Connection error
        result.error.code === '57014'; // Query canceled
        
      if (!isRetryable) {
        return result; // Non-retryable error, return immediately
      }
      
      lastError = result.error;
      
      if (attempt < maxRetries - 1) {
        // Wait with exponential backoff: 500ms, 1000ms, 2000ms
        const delay = 500 * Math.pow(2, attempt);
        console.warn(`[Supabase] Retrying operation (attempt ${attempt + 2}/${maxRetries}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (err) {
      lastError = err;
      
      if (attempt < maxRetries - 1) {
        const delay = 500 * Math.pow(2, attempt);
        console.warn(`[Supabase] Retrying operation (attempt ${attempt + 2}/${maxRetries}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { data: null, error: lastError };
}

// Debug helper - log active channels count (only in development)
if (import.meta.env.DEV) {
  const originalChannel = supabase.channel.bind(supabase);
  let activeChannels = new Set();
  
  supabase.channel = function(name, opts) {
    activeChannels.add(name);
    console.debug(`[Supabase] Channel created: ${name} (active: ${activeChannels.size})`);
    return originalChannel(name, opts);
  };
  
  const originalRemoveChannel = supabase.removeChannel.bind(supabase);
  supabase.removeChannel = function(channel) {
    if (channel?.topic) {
      activeChannels.delete(channel.topic);
      console.debug(`[Supabase] Channel removed: ${channel.topic} (active: ${activeChannels.size})`);
    }
    return originalRemoveChannel(channel);
  };
  
  // Expose for debugging in console
  window.__supabaseActiveChannels = () => Array.from(activeChannels);
}
