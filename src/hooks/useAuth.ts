import { useAuthContext } from "../context/AuthContext";

/**
 * Reusable React Hook to access current authentication state and actions.
 */
export function useAuth() {
  return useAuthContext();
}
