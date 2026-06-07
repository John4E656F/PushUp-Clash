import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/expo';

// Persist Clerk's session token securely on device so sessions survive restarts.
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore write failures; user just re-auths next launch
    }
  },
};
