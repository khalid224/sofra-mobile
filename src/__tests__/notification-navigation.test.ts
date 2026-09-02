import {
  isSafeNotificationId,
  safeNotificationScreen,
} from '@/features/notifications/navigation';

describe('notification navigation allowlist', () => {
  it('accepts only UUID identifiers', () => {
    expect(isSafeNotificationId('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(true);
    expect(isSafeNotificationId('../../admin')).toBe(false);
    expect(isSafeNotificationId('not-a-uuid')).toBe(false);
  });

  it('accepts known screens and rejects arbitrary routes', () => {
    expect(safeNotificationScreen('/(tabs)/menu')).toBe('/(tabs)/menu');
    expect(safeNotificationScreen('/chat')).toBe('/chat');
    expect(safeNotificationScreen('/admin/users')).toBeNull();
    expect(safeNotificationScreen('https://evil.example')).toBeNull();
  });
});
