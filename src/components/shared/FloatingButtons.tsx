import { Animated, Linking, Pressable, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { MessageSquare, PhoneCall } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeContext';
import { radius, shadow } from '@/theme/tokens';
import { logAnalyticsEvent } from '@/lib/analytics';

interface FloatingButtonsProps {
  whatsappNumber?: string | null;
}

export function FloatingButtons({ whatsappNumber }: FloatingButtonsProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleWhatsApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logAnalyticsEvent('whatsapp_click', { whatsapp_number: whatsappNumber });
    const cleanNumber = (whatsappNumber ?? '').replace(/[^0-9]/g, '');
    if (!cleanNumber) return;

    const nativeUrl = `whatsapp://send?phone=${cleanNumber}`;
    const webUrl = `https://wa.me/${cleanNumber}`;

    try {
      const supported = await Linking.canOpenURL(nativeUrl);
      if (supported) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  const handleChat = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logAnalyticsEvent('chat_click');
    router.push('/chat' as never);
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 90,
        right: 16,
        zIndex: 999,
        gap: 12,
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}
    >
      {/* WhatsApp Button */}
      {!!whatsappNumber && (
        <Pressable
          onPress={handleWhatsApp}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#25D366',
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.md,
          }}
        >
          <PhoneCall size={22} color="#fff" />
        </Pressable>
      )}

      {/* Internal Chat Button */}
      <Pressable
        onPress={handleChat}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.md,
        }}
      >
        <MessageSquare size={22} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}
