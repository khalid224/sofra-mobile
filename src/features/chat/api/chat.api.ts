import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/errors';
import type { ChatMessage, ChatThread, UUID } from '@/types';

const THREAD_FIELDS = `id, customer_id, last_message_at, unread_count, created_at, updated_at`;
const MESSAGE_FIELDS = `id, thread_id, sender_type, message, attachment_url, is_read, created_at`;

export async function fetchOrCreateThread(customerId: UUID): Promise<ChatThread> {
  const { data: existing } = await supabase
    .from('chat_threads')
    .select(THREAD_FIELDS)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existing) return existing as ChatThread;

  const { data: created, error } = await supabase
    .from('chat_threads')
    .insert({ customer_id: customerId, unread_count: 0 })
    .select(THREAD_FIELDS)
    .single();
  handleSupabaseError(error);
  return created as ChatThread;
}

export async function fetchMessages(threadId: UUID): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_FIELDS)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  handleSupabaseError(error);
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(threadId: UUID, message: string, senderType: 'customer' | 'admin'): Promise<void> {
  const { error: msgError } = await supabase
    .from('chat_messages')
    .insert({ thread_id: threadId, sender_type: senderType, message, is_read: false });
  handleSupabaseError(msgError);
}

export async function markThreadRead(threadId: UUID): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ is_read: true })
    .eq('thread_id', threadId)
    .eq('sender_type', 'admin')
    .eq('is_read', false);
  handleSupabaseError(error);
}
