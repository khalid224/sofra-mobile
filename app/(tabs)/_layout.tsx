import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { Home, Search, ClipboardList, Bell, User } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize } from '@/theme/tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount } from '@/features/notifications/api/notifications.api';
import { QUERY_KEYS } from '@/constants';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();

  // Poll unread notifications count for badge
  const unreadQuery = useQuery({
    queryKey: [QUERY_KEYS.NOTIFICATIONS, 'unread', user?.id],
    queryFn: () => fetchUnreadCount(user!.id),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const unread = unreadQuery.data ?? 0;

  const tabStyle = {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 10,
    paddingTop: 8,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: tabStyle,
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "المنيو",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "طلباتي",
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "الاشعارات",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Bell color={color} size={size} />
              {unread > 0 && (
                <View
                  style={{
                    position: "absolute", top: -6, left: -10,
                    backgroundColor: colors.destructive, borderRadius: 9,
                    minWidth: 18, height: 18, alignItems: "center",
                    justifyContent: "center", paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontFamily: fontFamily.bold }}>
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
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="cart" options={{ href: null }} />
    </Tabs>
  );
}
