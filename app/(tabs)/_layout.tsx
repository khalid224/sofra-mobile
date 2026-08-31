import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { Home, UtensilsCrossed, ClipboardList, Bell, User } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily } from '@/theme/tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount } from '@/features/notifications/api/notifications.api';
import { QUERY_KEYS } from '@/constants';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();

  useRealtimeInvalidate('notifications', [QUERY_KEYS.NOTIFICATIONS]);

  const unreadQuery = useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATIONS, 'unread', user?.id],
    queryFn: () => fetchUnreadCount(user!.id),
    enabled: !!user,
  });
  const unread = unreadQuery.data ?? 0;
  const tabStyle = {
    backgroundColor: colors.card,
    borderTopColor: colors.borderLight,
    borderTopWidth: 1,
    height: 74,
    paddingBottom: 9,
    paddingTop: 7,
  };

  const renderIcon = (Icon: typeof Home, color: string, focused: boolean, size: number) => (
    <View style={{ width: 38, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.primarySubtle : 'transparent' }}>
      <Icon color={color} size={focused ? size + 1 : size} strokeWidth={focused ? 2.4 : 2} />
    </View>
  );

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: tabStyle,
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 10, marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, size, focused }) => renderIcon(Home, color, focused, size),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "المنيو",
          tabBarIcon: ({ color, size, focused }) => renderIcon(UtensilsCrossed, color, focused, size),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "طلباتي",
          tabBarIcon: ({ color, size, focused }) => renderIcon(ClipboardList, color, focused, size),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "الاشعارات",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{ width: 38, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.primarySubtle : 'transparent' }}>
              <Bell color={color} size={focused ? size + 1 : size} strokeWidth={focused ? 2.4 : 2} />
              {unread > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -7,
                    right: -10,
                    minWidth: 17,
                    height: 17,
                    paddingHorizontal: 4,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.destructive,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontFamily: fontFamily.bold }}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color, size, focused }) => renderIcon(User, color, focused, size),
        }}
      />
      <Tabs.Screen name="cart" options={{ href: null }} />
    </Tabs>
  );
}
