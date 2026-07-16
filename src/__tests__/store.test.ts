/**
 * Unit tests for Zustand store (src/store/index.ts)
 * Per 13_TESTING_STRATEGY.md: Unit tests for hooks and state management
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore, useSearchStore } from '../store';

// Reset store between tests
beforeEach(() => {
  useAppStore.setState({
    isOnboardingComplete: false,
    isOffline: false,
    unreadNotifications: 0,
    unreadMessages: 0,
    maintenanceMode: false,
  });
  useSearchStore.setState({ recentSearches: [], popularSearches: [] });
});

// ─── App Store ────────────────────────────────────────────────
describe('useAppStore', () => {
  describe('completeOnboarding', () => {
    it('sets isOnboardingComplete to true', () => {
      const { completeOnboarding } = useAppStore.getState();
      completeOnboarding();
      expect(useAppStore.getState().isOnboardingComplete).toBe(true);
    });

    it('persists to AsyncStorage', () => {
      const { completeOnboarding } = useAppStore.getState();
      completeOnboarding();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('sofra_onboarding_done', 'true');
    });
  });

  describe('setOffline', () => {
    it('updates offline status', () => {
      const { setOffline } = useAppStore.getState();
      setOffline(true);
      expect(useAppStore.getState().isOffline).toBe(true);
      setOffline(false);
      expect(useAppStore.getState().isOffline).toBe(false);
    });
  });

  describe('setUnreadNotifications', () => {
    it('updates unread notification count', () => {
      const { setUnreadNotifications } = useAppStore.getState();
      setUnreadNotifications(5);
      expect(useAppStore.getState().unreadNotifications).toBe(5);
    });

    it('can be set to 0 after reading', () => {
      useAppStore.setState({ unreadNotifications: 10 });
      useAppStore.getState().setUnreadNotifications(0);
      expect(useAppStore.getState().unreadNotifications).toBe(0);
    });
  });

  describe('setMaintenanceMode', () => {
    it('enables and disables maintenance mode', () => {
      useAppStore.getState().setMaintenanceMode(true);
      expect(useAppStore.getState().maintenanceMode).toBe(true);
      useAppStore.getState().setMaintenanceMode(false);
      expect(useAppStore.getState().maintenanceMode).toBe(false);
    });
  });

  describe('loadOnboardingStatus', () => {
    it('sets isOnboardingComplete from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');
      await useAppStore.getState().loadOnboardingStatus();
      expect(useAppStore.getState().isOnboardingComplete).toBe(true);
    });

    it('stays false when AsyncStorage returns null', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      await useAppStore.getState().loadOnboardingStatus();
      expect(useAppStore.getState().isOnboardingComplete).toBe(false);
    });
  });
});

// ─── Search Store ─────────────────────────────────────────────
describe('useSearchStore', () => {
  const STORAGE_KEY = 'sofra_recent_searches';

  describe('addRecentSearch', () => {
    it('adds a search term', () => {
      useSearchStore.getState().addRecentSearch('كشري');
      expect(useSearchStore.getState().recentSearches).toContain('كشري');
    });

    it('prevents duplicates by moving term to front', () => {
      useSearchStore.getState().addRecentSearch('كشري');
      useSearchStore.getState().addRecentSearch('محشي');
      useSearchStore.getState().addRecentSearch('كشري'); // Add again
      const searches = useSearchStore.getState().recentSearches;
      expect(searches[0]).toBe('كشري');
      expect(searches.filter(s => s === 'كشري')).toHaveLength(1);
    });

    it('limits to 10 recent searches', () => {
      for (let i = 0; i < 15; i++) {
        useSearchStore.getState().addRecentSearch(`بحث ${i}`);
      }
      expect(useSearchStore.getState().recentSearches).toHaveLength(10);
    });

    it('persists to AsyncStorage', () => {
      useSearchStore.getState().addRecentSearch('طعمية');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('طعمية'),
      );
    });
  });

  describe('clearRecentSearches', () => {
    it('clears all recent searches', () => {
      useSearchStore.setState({ recentSearches: ['كشري', 'محشي'] });
      useSearchStore.getState().clearRecentSearches();
      expect(useSearchStore.getState().recentSearches).toHaveLength(0);
    });

    it('removes from AsyncStorage', () => {
      useSearchStore.getState().clearRecentSearches();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });
});
