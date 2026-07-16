/**
 * Global app store using Zustand
 * per 15_AI_DEVELOPMENT_GUIDE.md: "Use Zustand for global client state"
 * Context is allowed only for Theme and Localization.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants';

// ─── App Store ────────────────────────────────────────────────
interface AppState {
  isOnboardingComplete: boolean;
  isOffline: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  maintenanceMode: boolean;

  // Actions
  completeOnboarding: () => void;
  setOffline: (offline: boolean) => void;
  setUnreadNotifications: (count: number) => void;
  setUnreadMessages: (count: number) => void;
  setMaintenanceMode: (enabled: boolean) => void;
  loadOnboardingStatus: () => Promise<void>;
}

const ONBOARDING_KEY = 'sofra_onboarding_done';

export const useAppStore = create<AppState>((set) => ({
  isOnboardingComplete: false,
  isOffline: false,
  unreadNotifications: 0,
  unreadMessages: 0,
  maintenanceMode: false,

  completeOnboarding: () => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => undefined);
    set({ isOnboardingComplete: true });
  },

  setOffline: (offline) => set({ isOffline: offline }),
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  setUnreadMessages: (count) => set({ unreadMessages: count }),
  setMaintenanceMode: (enabled) => set({ maintenanceMode: enabled }),

  loadOnboardingStatus: async () => {
    const done = await AsyncStorage.getItem(ONBOARDING_KEY).catch(() => null);
    set({ isOnboardingComplete: done === 'true' });
  },
}));

// ─── Search Store ─────────────────────────────────────────────
interface SearchState {
  recentSearches: string[];
  popularSearches: string[];
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  loadRecentSearches: () => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  recentSearches: [],
  popularSearches: ['كشري', 'محشي', 'ملوخية', 'كبدة', 'فول', 'طعمية'],

  addRecentSearch: (q: string) => {
    const updated = [q, ...get().recentSearches.filter((r) => r !== q)].slice(0, 10);
    set({ recentSearches: updated });
    AsyncStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated)).catch(() => undefined);
  },

  clearRecentSearches: () => {
    set({ recentSearches: [] });
    AsyncStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES).catch(() => undefined);
  },

  loadRecentSearches: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES).catch(() => null);
    if (raw) set({ recentSearches: JSON.parse(raw) as string[] });
  },
}));
