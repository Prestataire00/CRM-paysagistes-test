// ---------------------------------------------------------------------------
// Messaging types
// ---------------------------------------------------------------------------
export interface Conversation {
  id: string
  title: string | null
  is_group: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConversationMember {
  id: string
  conversation_id: string
  profile_id: string
  last_read_at: string
  joined_at: string
}

export interface InternalMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

// Enriched types for UI
export interface MemberProfile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  role: string
}

export interface ConversationWithDetails extends Conversation {
  members: Array<{
    profile_id: string
    last_read_at: string
    profile: MemberProfile
  }>
  last_message?: {
    content: string
    sender_id: string
    created_at: string
  }
  unread_count: number
}

export interface MessageWithSender extends InternalMessage {
  sender: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}
