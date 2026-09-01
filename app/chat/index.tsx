import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Input } from '@/components/ui/Primitives';
import { LoadingScreen, EmptyState } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOrCreateThread, fetchMessages, sendMessage, markThreadRead } from '@/features/chat/api/chat.api';
import { formatTimeAgo } from '@/utils';
import type { ChatMessage } from '@/types';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';

export default function ChatScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const flatRef = useRef<FlatList>(null);
  const [text, setText] = useState('');

  const thread = useQuery({
    queryKey: ['chat-thread', user?.id],
    queryFn: () => fetchOrCreateThread(user!.id),
    enabled: !!user,
  });

  useRealtimeInvalidate('chat_messages', ['chat-messages', thread.data?.id]);

  const messages = useQuery({
    queryKey: ['chat-messages', thread.data?.id],
    queryFn: () => fetchMessages(thread.data!.id),
    enabled: !!thread.data?.id,
  });

  useEffect(() => {
    if (!messages.data) return;
    if (thread.data?.id) markThreadRead(thread.data.id);
    if (messages.data.length) setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.data, thread.data?.id]);

  const sendMut = useMutation({
    mutationFn: () => sendMessage(thread.data!.id, text.trim(), 'customer'),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['chat-messages', thread.data?.id] });
    },
    onError: (e: Error) => Toast.show({ type: 'error', text1: 'فشل إرسال الرسالة', text2: e.message }),
  });

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader showBack title="المحادثات" showThemeToggle={false} />
        <EmptyState emoji="🔐" title="سجّل دخولك أولاً" description="تحتاج تسجيل الدخول للتواصل مع الدعم" />
      </View>
    );
  }

  if (thread.isLoading) return <LoadingScreen />;

  const canSend = text.trim().length > 0 && !sendMut.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader showBack title="تواصل مع سفرة" showThemeToggle={false} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          removeClippedSubviews={false}
          ref={flatRef}
          data={messages.data ?? []}
          keyExtractor={(m, i) => m.id || `msg-${i}`}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: 'center' }}>
                ابدأ المحادثة وسنرد عليك في أقرب وقت 💬
              </Text>
            </View>
          }
          renderItem={({ item }) => <MessageBubble message={item} colors={colors} />}
        />

        {/* Input bar */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder="اكتب رسالتك..."
              multiline
              maxLength={1000}
              style={{ maxHeight: 100 }}
            />
          </View>
          <Pressable
            onPress={() => canSend && sendMut.mutate()}
            disabled={!canSend}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: canSend ? colors.primary : colors.muted, alignItems: 'center', justifyContent: 'center' }}
          >
            <Send size={20} color={canSend ? '#fff' : colors.mutedForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function MessageBubble({ message, colors }: { message: ChatMessage; colors: ReturnType<typeof useTheme>['colors'] }) {
  const isCustomer = message.sender_type === 'customer';
  return (
    <View style={{ alignSelf: isCustomer ? 'flex-start' : 'flex-end', maxWidth: '80%', gap: 4 }}>
      <View style={{ backgroundColor: isCustomer ? colors.muted : colors.primary, borderRadius: radius['2xl'], borderBottomLeftRadius: isCustomer ? 4 : radius['2xl'], borderBottomRightRadius: isCustomer ? radius['2xl'] : 4, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.md, color: isCustomer ? colors.foreground : '#fff', lineHeight: 22, textAlign: isCustomer ? 'right' : 'right' }}>
          {message.message}
        </Text>
      </View>
      <Text style={{ fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.mutedForeground, alignSelf: isCustomer ? 'flex-start' : 'flex-end' }}>
        {formatTimeAgo(message.created_at)}
      </Text>
    </View>
  );
}
