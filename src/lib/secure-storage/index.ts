import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SECURE_KEYS = new Set([
  'supabase.auth.token',
  'sofra_device_token',
  'sofra_refresh_token',
]);

function isSecureKey(key: string): boolean {
  return SECURE_KEYS.has(key) || key.startsWith('sb-') || key.includes('auth');
}

async function webGet(key: string): Promise<string | null> {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

async function webSet(key: string, value: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}

async function webRemove(key: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

export const SecureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      return webSet(key, value);
    }

    if (isSecureKey(key)) {
      return SecureStore.setItemAsync(key, value);
    }

    return AsyncStorage.setItem(key, value);
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return webGet(key);
    }

    if (isSecureKey(key)) {
      return SecureStore.getItemAsync(key);
    }

    return AsyncStorage.getItem(key);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      return webRemove(key);
    }

    if (isSecureKey(key)) {
      return SecureStore.deleteItemAsync(key);
    }

    return AsyncStorage.removeItem(key);
  },
};

export const supabaseSecureStorage = {
  getItem: (key: string) => SecureStorage.getItem(key),
  setItem: (key: string, value: string) => SecureStorage.setItem(key, value),
  removeItem: (key: string) => SecureStorage.removeItem(key),
};