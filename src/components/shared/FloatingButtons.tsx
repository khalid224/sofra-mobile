import { Animated, Pressable } from 'react-native';
import { useEffect, useRef } from 'react';
import { PhoneCall } from 'lucide-react-native';
import { shadow } from '@/theme/tokens';
import { openWhatsApp } from '@/lib/whatsapp';

interface FloatingButtonsProps {
  whatsappNumber?: string | null;
}

export function FloatingButtons({ whatsappNumber }: FloatingButtonsProps) {
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

  const handleWhatsApp = () => {
    openWhatsApp(whatsappNumber, 'السلام عليكم، أحتاج مساعدة في تطبيق سفرة 🙏');
  };

  if (!whatsappNumber) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 90,
        right: 16,
        zIndex: 999,
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}
    >
      {/* WhatsApp Action Button */}
      <Pressable
        onPress={handleWhatsApp}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: '#25D366',
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.lg,
        }}
      >
        <PhoneCall size={24} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}
