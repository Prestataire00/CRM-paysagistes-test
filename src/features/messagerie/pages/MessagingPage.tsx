import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  MessageSquare,
  Send,
  Plus,
  Search,
  Loader2,
  X,
  Users as UsersIcon,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { UserAvatar } from '../../../components/ui/UserAvatar'
import {
  useConversations,
  useMessages,
  useSendMessage,
  useFindOrCreateDM,
  useCreateConversation,
  useMarkConversationRead,
  useAvailableUsers,
  useMessageRealtime,
} from '../../../queries/useMessaging'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../components/feedback/ToastProvider'
import type { ConversationWithDetails } from '../../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  responsable_commercial: 'Resp. Commercial',
  commercial: 'Commercial',
  conducteur_travaux: 'Conducteur de travaux',
  comptabilite: 'Comptabilite',
  jardinier: 'Jardinier',
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return "a l'instant"
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function getDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getConversationName(conv: ConversationWithDetails, currentUserId: string): string {
  if (conv.title) return conv.title
  const others = conv.members
    .filter((m) => m.profile_id !== currentUserId)
    .map((m) => `${m.profile.first_name} ${m.profile.last_name}`)
  return others.join(', ') || 'Conversation'
}

function getOtherMembers(conv: ConversationWithDetails, currentUserId: string) {
  return conv.members.filter((m) => m.profile_id !== currentUserId)
}

// ===========================================================================
// MessagingPage
// ===========================================================================
export function MessagingPage() {
  const { user } = useAuth()
  const toast = useToast()
  const currentUserId = user?.id ?? ''

  // State
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [convSearch, setConvSearch] = useState('')
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [showGroupCreate, setShowGroupCreate] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([])

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Data
  const { data: conversations = [], isLoading: loadingConvs } = useConversations()
  const { data: messages = [], isLoading: loadingMessages } = useMessages(selectedConvId ?? undefined)
  const { data: availableUsers = [] } = useAvailableUsers()
  const sendMutation = useSendMessage()
  const findOrCreateDMMutation = useFindOrCreateDM()
  const createConvMutation = useCreateConversation()
  const markReadMutation = useMarkConversationRead()

  // Realtime
  useMessageRealtime(selectedConvId ?? undefined)

  // Selected conversation object
  const selectedConv = conversations.find((c) => c.id === selectedConvId)

  // Filter conversations
  const filteredConvs = useMemo(() => {
    if (!convSearch) return conversations
    const lower = convSearch.toLowerCase()
    return conversations.filter((c) => {
      const name = getConversationName(c, currentUserId)
      return name.toLowerCase().includes(lower)
    })
  }, [conversations, convSearch, currentUserId])

  // Filter available users for new message modal
  const filteredUsers = useMemo(() => {
    if (!userSearch) return availableUsers
    const lower = userSearch.toLowerCase()
    return availableUsers.filter(
      (u) =>
        u.first_name.toLowerCase().includes(lower) ||
        u.last_name.toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower),
    )
  }, [availableUsers, userSearch])

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedConvId) {
      markReadMutation.mutate(selectedConvId)
    }
  }, [selectedConvId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Send message
  const handleSend = useCallback(() => {
    if (!selectedConvId || !messageInput.trim()) return
    sendMutation.mutate(
      { conversationId: selectedConvId, content: messageInput.trim() },
      {
        onSuccess: () => {
          setMessageInput('')
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
          }
        },
        onError: () => toast.error("Erreur lors de l'envoi"),
      },
    )
  }, [selectedConvId, messageInput, sendMutation, toast])

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  // Start DM with user
  const handleStartDM = useCallback(
    (profileId: string) => {
      findOrCreateDMMutation.mutate(profileId, {
        onSuccess: (conv) => {
          setSelectedConvId(conv.id)
          setShowNewMessage(false)
          setUserSearch('')
        },
        onError: () => toast.error('Erreur lors de la creation de la conversation'),
      })
    },
    [findOrCreateDMMutation, toast],
  )

  // Create group conversation
  const handleCreateGroup = useCallback(() => {
    if (selectedGroupMembers.length === 0 || !groupTitle.trim()) {
      toast.error('Ajoutez un titre et au moins un membre')
      return
    }
    createConvMutation.mutate(
      { memberIds: selectedGroupMembers, title: groupTitle.trim(), isGroup: true },
      {
        onSuccess: (conv) => {
          setSelectedConvId(conv.id)
          setShowNewMessage(false)
          setShowGroupCreate(false)
          setGroupTitle('')
          setSelectedGroupMembers([])
        },
        onError: () => toast.error('Erreur lors de la creation du groupe'),
      },
    )
  }, [selectedGroupMembers, groupTitle, createConvMutation, toast])

  // Group member toggle
  const toggleGroupMember = useCallback((id: string) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }, [])

  // Message date grouping
  const messagesWithDates = useMemo(() => {
    const result: Array<{ type: 'date'; label: string } | { type: 'message'; data: (typeof messages)[0] }> = []
    let lastDate = ''
    for (const msg of messages) {
      const dateStr = new Date(msg.created_at).toDateString()
      if (dateStr !== lastDate) {
        result.push({ type: 'date', label: getDateSeparator(msg.created_at) })
        lastDate = dateStr
      }
      result.push({ type: 'message', data: msg })
    }
    return result
  }, [messages])

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ================================================================= */}
      {/* LEFT: Conversation sidebar */}
      {/* ================================================================= */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">Messagerie</h2>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowNewMessage(true)}
            >
              Nouveau
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Aucune conversation</p>
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const isActive = conv.id === selectedConvId
              const others = getOtherMembers(conv, currentUserId)
              const name = getConversationName(conv, currentUserId)
              const displayUser = others[0]?.profile

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2 ${
                    isActive
                      ? 'bg-green-50 border-green-600'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  {conv.is_group ? (
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <UsersIcon className="w-4 h-4 text-slate-500" />
                    </div>
                  ) : displayUser ? (
                    <UserAvatar user={displayUser} size="md" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-green-700' : 'text-slate-900'}`}>
                        {name}
                      </p>
                      {conv.last_message && (
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                          {timeAgo(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-400 truncate">
                        {conv.last_message?.content ?? 'Pas encore de messages'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 shrink-0 w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* RIGHT: Chat area */}
      {/* ================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConv ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageSquare className="w-16 h-16 text-slate-200 mb-4" />
            <h3 className="text-lg font-semibold text-slate-400">Messagerie interne</h3>
            <p className="text-sm text-slate-300 mt-1 max-w-sm">
              Selectionnez une conversation ou cliquez sur "Nouveau" pour envoyer un message
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
              {(() => {
                const others = getOtherMembers(selectedConv, currentUserId)
                const displayUser = others[0]?.profile
                return (
                  <>
                    {selectedConv.is_group ? (
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <UsersIcon className="w-4 h-4 text-slate-500" />
                      </div>
                    ) : displayUser ? (
                      <UserAvatar user={displayUser} size="md" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {getConversationName(selectedConv, currentUserId)}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {selectedConv.is_group
                          ? `${selectedConv.members.length} membres`
                          : displayUser
                            ? roleLabels[displayUser.role] ?? displayUser.role
                            : ''}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-slate-300">Aucun message — commencez la conversation !</p>
                </div>
              ) : (
                <>
                  {messagesWithDates.map((item, i) => {
                    if (item.type === 'date') {
                      return (
                        <div key={`date-${i}`} className="flex items-center gap-3 my-4">
                          <div className="flex-1 border-t border-slate-100" />
                          <span className="text-[11px] font-medium text-slate-400">{item.label}</span>
                          <div className="flex-1 border-t border-slate-100" />
                        </div>
                      )
                    }

                    const msg = item.data
                    const isMe = msg.sender_id === currentUserId
                    const sender = msg.sender ?? { first_name: '?', last_name: '?', avatar_url: null }
                    const prevItem = messagesWithDates[i - 1]
                    const showAvatar =
                      !isMe &&
                      (prevItem?.type === 'date' ||
                        (prevItem?.type === 'message' && prevItem.data.sender_id !== msg.sender_id))

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 mb-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMe && (
                          <div className="w-7 shrink-0">
                            {showAvatar && <UserAvatar user={sender} size="sm" />}
                          </div>
                        )}
                        <div
                          className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${
                            isMe
                              ? 'bg-green-600 text-white rounded-br-md'
                              : 'bg-slate-100 text-slate-900 rounded-bl-md'
                          }`}
                        >
                          {!isMe && showAvatar && selectedConv.is_group && (
                            <p className="text-[10px] font-semibold text-green-600 mb-0.5">
                              {sender.first_name} {sender.last_name}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isMe ? 'text-green-200' : 'text-slate-400'
                            }`}
                          >
                            {formatMessageTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input area */}
            <div className="px-5 py-3 border-t border-slate-200">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ecrivez un message..."
                  rows={1}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 max-h-[120px]"
                />
                <Button
                  variant="primary"
                  icon={Send}
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sendMutation.isPending}
                  loading={sendMutation.isPending}
                />
              </div>
              <p className="text-[10px] text-slate-300 mt-1">
                Entree pour envoyer · Maj+Entree pour un retour a la ligne
              </p>
            </div>
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* NEW MESSAGE MODAL */}
      {/* ================================================================= */}
      {showNewMessage && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowNewMessage(false); setShowGroupCreate(false); setUserSearch('') }} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                {showGroupCreate ? 'Creer un groupe' : 'Nouveau message'}
              </h2>
              <button
                onClick={() => { setShowNewMessage(false); setShowGroupCreate(false); setUserSearch('') }}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4">
              {!showGroupCreate && (
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={UsersIcon}
                    onClick={() => setShowGroupCreate(true)}
                  >
                    Creer un groupe
                  </Button>
                </div>
              )}

              {showGroupCreate && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder="Nom du groupe..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                  />
                  {selectedGroupMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {selectedGroupMembers.map((id) => {
                        const u = availableUsers.find((au) => au.id === id)
                        if (!u) return null
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full"
                          >
                            {u.first_name} {u.last_name}
                            <button onClick={() => toggleGroupMember(id)} className="hover:text-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const isSelected = selectedGroupMembers.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        if (showGroupCreate) {
                          toggleGroupMember(u.id)
                        } else {
                          handleStartDM(u.id)
                        }
                      }}
                      disabled={findOrCreateDMMutation.isPending}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-green-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <UserAvatar user={u} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {roleLabels[u.role] ?? u.role}
                        </p>
                      </div>
                      {showGroupCreate && isSelected && (
                        <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                          <span className="text-white text-[10px] font-bold">✓</span>
                        </div>
                      )}
                    </button>
                  )
                })}
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">Aucun utilisateur trouve</p>
                )}
              </div>
            </div>

            {showGroupCreate && (
              <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-200">
                <Button variant="secondary" size="sm" onClick={() => { setShowGroupCreate(false); setSelectedGroupMembers([]) }}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateGroup}
                  loading={createConvMutation.isPending}
                  disabled={selectedGroupMembers.length === 0 || !groupTitle.trim()}
                >
                  Creer le groupe ({selectedGroupMembers.length})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MessagingPage
