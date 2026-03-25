import { supabase } from '../lib/supabase'
import type {
  Conversation,
  ConversationWithDetails,
  MessageWithSender,
  InternalMessage,
} from '../types'

// ---------------------------------------------------------------------------
// getConversations — all conversations for the current user
// ---------------------------------------------------------------------------
export async function getConversations(): Promise<ConversationWithDetails[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get conversations where user is a member
  const { data: memberRows, error: memberErr } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('profile_id', user.id)

  if (memberErr) throw memberErr
  if (!memberRows || memberRows.length === 0) return []

  const conversationIds = memberRows.map((m) => m.conversation_id)

  // Get conversations with members + profiles
  const { data: conversations, error: convErr } = await supabase
    .from('internal_conversations')
    .select(`
      *,
      members:conversation_members(
        profile_id,
        last_read_at,
        profile:profiles!profile_id(id, first_name, last_name, avatar_url, role)
      )
    `)
    .in('id', conversationIds)
    .order('updated_at', { ascending: false })

  if (convErr) throw convErr

  // Get last message for each conversation
  const result: ConversationWithDetails[] = []
  for (const conv of conversations ?? []) {
    const { data: lastMsgRows } = await supabase
      .from('internal_messages')
      .select('content, sender_id, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const lastMsg = lastMsgRows?.[0] ?? null

    // Calculate unread count
    const myMembership = (conv.members as Array<{ profile_id: string; last_read_at: string }>)
      .find((m) => m.profile_id === user.id)
    const lastReadAt = myMembership?.last_read_at ?? conv.created_at

    const { count } = await supabase
      .from('internal_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .gt('created_at', lastReadAt)
      .neq('sender_id', user.id)

    result.push({
      ...conv,
      members: conv.members as ConversationWithDetails['members'],
      last_message: lastMsg ?? undefined,
      unread_count: count ?? 0,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// getMessages — messages for a conversation
// ---------------------------------------------------------------------------
export async function getMessages(conversationId: string, limit = 50): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('internal_messages')
    .select(`
      *,
      sender:profiles!sender_id(id, first_name, last_name, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as MessageWithSender[]
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------
export async function sendMessage(conversationId: string, content: string): Promise<InternalMessage> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('internal_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) throw error

  // Update conversation updated_at
  await supabase
    .from('internal_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data as InternalMessage
}

// ---------------------------------------------------------------------------
// createConversation
// ---------------------------------------------------------------------------
export async function createConversation(
  memberIds: string[],
  title?: string,
  isGroup = false,
): Promise<Conversation> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: conv, error: convErr } = await supabase
    .from('internal_conversations')
    .insert({
      title: title || null,
      is_group: isGroup,
      created_by: user.id,
    })
    .select()
    .single()

  if (convErr) throw convErr

  // Add all members including the creator
  const allMembers = [...new Set([user.id, ...memberIds])]
  const rows = allMembers.map((profileId) => ({
    conversation_id: conv.id,
    profile_id: profileId,
  }))

  const { error: memberErr } = await supabase
    .from('conversation_members')
    .insert(rows)

  if (memberErr) throw memberErr

  return conv as Conversation
}

// ---------------------------------------------------------------------------
// findOrCreateDM — find existing 1:1 or create new one
// ---------------------------------------------------------------------------
export async function findOrCreateDM(otherProfileId: string): Promise<Conversation> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Find existing 1:1 conversations where both users are members
  const { data: myConvs } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('profile_id', user.id)

  if (myConvs && myConvs.length > 0) {
    const myConvIds = myConvs.map((c) => c.conversation_id)

    const { data: shared } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('profile_id', otherProfileId)
      .in('conversation_id', myConvIds)

    if (shared && shared.length > 0) {
      // Check if any of these shared conversations are 1:1 (not group)
      for (const s of shared) {
        const { data: conv } = await supabase
          .from('internal_conversations')
          .select('*')
          .eq('id', s.conversation_id)
          .eq('is_group', false)
          .single()

        if (conv) {
          // Verify it only has 2 members
          const { count } = await supabase
            .from('conversation_members')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)

          if (count === 2) return conv as Conversation
        }
      }
    }
  }

  // No existing DM found, create a new one
  return createConversation([otherProfileId], undefined, false)
}

// ---------------------------------------------------------------------------
// markConversationRead
// ---------------------------------------------------------------------------
export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', user.id)

  if (error) throw error
}

// ---------------------------------------------------------------------------
// getAvailableUsers — all active profiles except current user
// ---------------------------------------------------------------------------
export interface AvailableUser {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  avatar_url: string | null
}

export async function getAvailableUsers(): Promise<AvailableUser[]> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, avatar_url')
    .eq('is_active', true)
    .neq('id', user?.id ?? '')
    .order('last_name')

  if (error) throw error
  return (data ?? []) as AvailableUser[]
}

// ---------------------------------------------------------------------------
// getTotalUnreadCount
// ---------------------------------------------------------------------------
export async function getTotalUnreadCount(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { data: memberships, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('profile_id', user.id)

    if (error || !memberships) return 0

    let total = 0
    for (const m of memberships) {
      const { count } = await supabase
        .from('internal_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', m.conversation_id)
        .gt('created_at', m.last_read_at)
        .neq('sender_id', user.id)

      total += count ?? 0
    }

    return total
  } catch (error) {
    console.error('[getTotalUnreadCount]', error)
    return 0
  }
}
