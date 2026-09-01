import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, UtensilsCrossed, ClipboardList, User } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily } from '@/theme/tokens';

export default function TabsLayout() {
  const { colors } = useTheme();
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
        options={{ href: null }}
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
