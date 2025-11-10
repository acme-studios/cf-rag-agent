/**
 * useSession Hook
 * 
 * React hook for managing user sessions in the RAG Agent app.
 * Handles session ID generation, storage, and retrieval.
 * 
 * Usage:
 * const { sessionId, isNewSession } = useSession();
 */

import { useState, useEffect } from 'react';
import { getSessionId, isSessionExpired } from '../utils/sessionId';

interface UseSessionReturn {
  sessionId: string;
  isNewSession: boolean;
  isLoading: boolean;
}

/**
 * Hook to manage user session
 * 
 * This hook:
 * 1. Gets or creates a session ID on mount
 * 2. Checks if the session is new or existing
 * 3. Provides session ID to components
 * 
 * The session ID is stored in a cookie that expires after 24 hours
 */
export function useSession(): UseSessionReturn {
  const [sessionId, setSessionId] = useState<string>('');
  const [isNewSession, setIsNewSession] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('[HOOK] useSession: Initializing session');
    
    try {
      // Get session ID from cookie or create new one
      const id = getSessionId();
      
      // Check if this is a new session or expired session
      const expired = isSessionExpired(id);
      
      if (expired) {
        console.log('[HOOK] useSession: Session expired, treating as new');
        setIsNewSession(true);
      } else {
        console.log('[HOOK] useSession: Existing valid session');
        setIsNewSession(false);
      }
      
      setSessionId(id);
      console.log('[HOOK] useSession: Session ID set:', id.substring(0, 20) + '...');
    } catch (error) {
      console.error('[HOOK] useSession: Error initializing session:', error);
      // Fallback to a default session ID
      setSessionId('session_default_' + Date.now());
      setIsNewSession(true);
    } finally {
      setIsLoading(false);
    }
  }, []); // Run once on mount

  return {
    sessionId,
    isNewSession,
    isLoading
  };
}
