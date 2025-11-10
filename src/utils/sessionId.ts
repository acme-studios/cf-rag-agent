/**
 * Session ID Management
 * 
 * Handles creation and retrieval of unique session IDs for users.
 * Sessions last 24 hours and are stored in browser cookies.
 */

const COOKIE_NAME = 'rag_session_id';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Generates a unique session ID
 * Format: session_timestamp_uuid
 * Example: session_1699564800000_a1b2c3d4-e5f6-7890-abcd-ef1234567890
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  return `session_${timestamp}_${uuid}`;
}

/**
 * Retrieves the current session ID from cookies, or creates a new one
 * 
 * How it works:
 * 1. Check if session cookie exists
 * 2. If yes, return existing session ID
 * 3. If no, generate new session ID and store in cookie
 * 
 * The cookie expires after 24 hours automatically
 */
export function getSessionId(): string {
  console.log('[SESSION] Retrieving session ID from cookies');
  
  // Parse all cookies into key-value pairs
  const cookies = document.cookie.split(';');
  
  // Look for our session cookie
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === COOKIE_NAME) {
      console.log('[SESSION] Found existing session:', value.substring(0, 20) + '...');
      return value;
    }
  }
  
  // No session found, create a new one
  console.log('[SESSION] No existing session found, creating new session');
  const sessionId = generateSessionId();
  
  // Calculate expiry date (24 hours from now)
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  
  // Store in cookie with expiry
  document.cookie = `${COOKIE_NAME}=${sessionId}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  
  console.log('[SESSION] New session created:', sessionId.substring(0, 20) + '...');
  return sessionId;
}

/**
 * Clears the current session cookie
 * Used when user explicitly logs out or session needs to be reset
 */
export function clearSession(): void {
  console.log('[SESSION] Clearing session cookie');
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Extracts the timestamp from a session ID
 * Useful for checking session age
 */
export function getSessionTimestamp(sessionId: string): number {
  const parts = sessionId.split('_');
  if (parts.length >= 2) {
    return parseInt(parts[1], 10);
  }
  return 0;
}

/**
 * Checks if a session has expired (older than 24 hours)
 */
export function isSessionExpired(sessionId: string): boolean {
  const timestamp = getSessionTimestamp(sessionId);
  const age = Date.now() - timestamp;
  return age > SESSION_DURATION_MS;
}
