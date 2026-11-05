/**
 * HandDeck - Configuration (Milestone 4)
 * Loads backend URL from environment or defaults to http://localhost:8000.
 */

export const CONFIG = {
  BACKEND_URL: (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:8000',
  REQUEST_TIMEOUT_MS: 6000, // 6-second timeout requirement
};

