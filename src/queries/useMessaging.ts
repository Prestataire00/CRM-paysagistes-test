import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
  findOrCreateDM,
  markConversationRead,
  getAvailableUsers,
  getTotalUnreadCount,
} from '../services/messaging.service'
import type { MessageWithSender } from '../types'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const messagingKeys = {
  all: ['messaging'] as const,
  conversations: () => [...messagingKeys.all, 'conversations'] as const,
  messages: (conversationId: string) => [...messagingKeys.all, 'messages', conversationId] as const,
  users: () => [...messagingKeys.all, 'users'] as const,
  unreadCount: () => [...messagingKeys.all, 'unreadCount'] as const,
}

// ---------------------------------------------------------------------------
// useConversations
// ---------------------------------------------------------------------------
export function useConversations() {
  return useQuery({
    queryKey: messagingKeys.conversations(),
    queryFn: getConversations,
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useMessages
// ---------------------------------------------------------------------------
export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: messagingKeys.messages(conversationId!),
    queryFn: () => getMessages(conversationId!),
    enabled: !!conversationId,
    staleTime: 10 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useSendMessage
// ---------------------------------------------------------------------------
export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      sendMessage(conversationId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.messages(variables.conversationId) })
      queryClient.invalidateQueries({ queryKey: messagingKeys.conversations() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.unreadCount() })
    },
  })
}

// ---------------------------------------------------------------------------
// useCreateConversation
// ---------------------------------------------------------------------------
export function useCreateConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberIds, title, isGroup }: { memberIds: string[]; title?: string; isGroup?: boolean }) =>
      createConversation(memberIds, title, isGroup),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.conversations() })
    },
  })
}

// ---------------------------------------------------------------------------
// useFindOrCreateDM
// ---------------------------------------------------------------------------
export function useFindOrCreateDM() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (otherProfileId: string) => findOrCreateDM(otherProfileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.conversations() })
    },
  })
}

// ---------------------------------------------------------------------------
// useMarkConversationRead
// ---------------------------------------------------------------------------
export function useMarkConversationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.conversations() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.unreadCount() })
    },
  })
}

// ---------------------------------------------------------------------------
// useAvailableUsers
// ---------------------------------------------------------------------------
export function useAvailableUsers() {
  return useQuery({
    queryKey: messagingKeys.users(),
    queryFn: getAvailableUsers,
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useUnreadMessageCount
// ---------------------------------------------------------------------------
export function useUnreadMessageCount() {
  return useQuery({
    queryKey: messagingKeys.unreadCount(),
    queryFn: getTotalUnreadCount,
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useMessageRealtime — subscribe to new messages in a conversation
// ---------------------------------------------------------------------------
export function useMessageRealtime(conversationId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Append the new message to the query cache
          queryClient.setQueryData<MessageWithSender[]>(
            messagingKeys.messages(conversationId),
            (old) => {
              if (!old) return old
              const newMsg = payload.new as MessageWithSender
              // Avoid duplicates
              if (old.some((m) => m.id === newMsg.id)) return old
              return [...old, newMsg]
            },
          )
          // Refresh conversations list for last message / unread
          queryClient.invalidateQueries({ queryKey: messagingKeys.conversations() })
          queryClient.invalidateQueries({ queryKey: messagingKeys.unreadCount() })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])
}
