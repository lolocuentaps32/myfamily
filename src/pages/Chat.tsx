import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useActiveFamily } from '../lib/useActiveFamily'
import './Chat.css'

type Message = {
    id: string
    content: string | null
    media_url: string | null
    media_type: string | null
    created_at: string
    updated_at: string
    is_deleted: boolean
    sender_member_id: string
    sender: { display_name: string } | null
    reply_to: { id: string; content: string | null; sender: { display_name: string } | null } | null
}

type Member = {
    id: string
    display_name: string
}

export default function ChatPage() {
    const { activeFamilyId, myMember } = useActiveFamily()
    const [messages, setMessages] = useState<Message[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [replyTo, setReplyTo] = useState<Message | null>(null)
    const [editingMessage, setEditingMessage] = useState<Message | null>(null)
    const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior })
        }
    }

    // Load messages
    const loadMessages = useCallback(async () => {
        if (!activeFamilyId) return

        try {
            const { data: messagesData, error } = await supabase
                .from('chat_messages')
                .select(`
                    id, content, media_url, media_type, created_at, updated_at, is_deleted, sender_member_id,
                    sender:sender_member_id(display_name),
                    reply_to:reply_to_id(id, content, sender:sender_member_id(display_name))
                `)
                .eq('family_id', activeFamilyId)
                .eq('is_deleted', false)
                .order('created_at', { ascending: true })
                .limit(100)

            if (!error && messagesData) {
                setMessages(messagesData as any)
            }
        } catch (e) {
            console.error('Error loading messages:', e)
        }

        setLoading(false)
    }, [activeFamilyId])

    // Load members directly from members table
    const loadMembers = useCallback(async () => {
        if (!activeFamilyId) return

        try {
            const { data } = await supabase
                .from('members')
                .select('id, display_name')
                .eq('family_id', activeFamilyId)

            if (data) {
                setMembers(data as any)
            }
        } catch (e) {
            console.error('Error loading members:', e)
        }
    }, [activeFamilyId])

    // Setup real-time subscription
    useEffect(() => {
        if (!activeFamilyId) return

        loadMembers()
        loadMessages()

        // Subscribe to messages
        const channel = supabase
            .channel(`chat:${activeFamilyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `family_id=eq.${activeFamilyId}`
                },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        // Refresh to get full sender info
                        loadMessages()
                    } else if (payload.eventType === 'UPDATE') {
                        if (payload.new.is_deleted) {
                            setMessages(prev => prev.filter(m => m.id !== payload.new.id))
                        } else {
                            loadMessages()
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeFamilyId, loadMessages, loadMembers])

    // Auto-scroll when messages change
    useEffect(() => {
        if (messages.length > 0) {
            // Use 'auto' behavior for the first load to avoid jitter
            const behavior = loading ? 'auto' : 'smooth'
            scrollToBottom(behavior)
        }
    }, [messages, loading])

    // Mark as read
    useEffect(() => {
        if (!activeFamilyId || messages.length === 0) return
        const lastMessage = messages[messages.length - 1]
        // Only run if message is not own
        if (lastMessage.sender_member_id === myMember?.id) return

        try {
            supabase.rpc('mark_messages_as_read', {
                _family_id: activeFamilyId,
                _message_id: lastMessage.id
            })
        } catch (e) {
            // Ignore RPC errors
        }
    }, [activeFamilyId, messages, myMember])

    // Send or update message
    async function sendMessage(e?: React.FormEvent) {
        e?.preventDefault()

        if ((!newMessage.trim() && !editingMessage) || !activeFamilyId || !myMember || sending) return

        const text = newMessage.trim()
        setSending(true)

        try {
            if (editingMessage) {
                // Update existing message
                const { error } = await supabase
                    .from('chat_messages')
                    .update({ content: text, updated_at: new Date().toISOString() })
                    .eq('id', editingMessage.id)

                if (!error) {
                    setNewMessage('')
                    setEditingMessage(null)
                    // Local update for immediate feedback
                    setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: text, updated_at: new Date().toISOString() } : m))
                }
            } else {
                // Create new message
                const { data, error } = await supabase.from('chat_messages').insert({
                    family_id: activeFamilyId,
                    sender_member_id: myMember.id,
                    content: text,
                    reply_to_id: replyTo?.id || null
                }).select(`
                    id, content, media_url, media_type, created_at, updated_at, is_deleted, sender_member_id,
                    sender:sender_member_id(display_name),
                    reply_to:reply_to_id(id, content, sender:sender_member_id(display_name))
                `).single()

                if (!error) {
                    setNewMessage('')
                    setReplyTo(null)
                    inputRef.current?.focus()
                    // Manual refresh if real-time lags
                    if (data) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === data.id)) return prev
                            return [...prev, data as any]
                        })
                    }
                } else {
                    console.error('Error sending message:', error)
                    alert('Error al enviar el mensaje. Por favor intenta de nuevo.')
                }
            }
        } catch (e) {
            console.error('Exception sending message:', e)
        } finally {
            setSending(false)
        }
    }

    // Delete message
    async function deleteMessage(msg: Message) {
        if (!window.confirm('¿Eliminar este mensaje?')) return

        try {
            console.log('Attempting deletion for message:', msg.id, 'Family:', activeFamilyId)
            const { data, error } = await supabase
                .from('chat_messages')
                .update({ is_deleted: true, updated_at: new Date().toISOString() })
                .eq('id', msg.id)
                .eq('family_id', activeFamilyId)
                .select('id')

            if (error) {
                console.error('Supabase delete error:', error)
                throw error
            }

            if (!data || data.length === 0) {
                throw new Error('No tienes permisos para eliminar este mensaje o el mensaje ya no existe.')
            }

            setMessages(prev => prev.filter(m => m.id !== msg.id))
            setActiveMessageMenu(null)
        } catch (e: any) {
            console.error('Exception in deleteMessage:', e)
            alert(`Error al eliminar: ${e.message || 'Error desconocido'}. Revisa la consola para más detalles.`)
        }
    }

    // Edit message
    function startEditing(msg: Message) {
        setEditingMessage(msg)
        setNewMessage(msg.content || '')
        setActiveMessageMenu(null)
        inputRef.current?.focus()
    }

    function cancelEditing() {
        setEditingMessage(null)
        setNewMessage('')
    }

    // Handle file upload
    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !activeFamilyId || !myMember) return

        setSending(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${activeFamilyId}/${Date.now()}.${fileExt}`
            const mediaType = file.type.split('/')[0]

            const { error: uploadError } = await supabase.storage
                .from('family-media')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('family-media')
                .getPublicUrl(fileName)

            await supabase.from('chat_messages').insert({
                family_id: activeFamilyId,
                sender_member_id: myMember.id,
                media_url: publicUrl,
                media_type: mediaType,
                content: ''
            })

            loadMessages()
        } catch (err) {
            console.error('Error uploading file:', err)
        } finally {
            setSending(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // Grouping messages by date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        if (date.toDateString() === today.toDateString()) return 'Hoy'
        if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
        return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }

    const messageGroups = messages.reduce((groups: { [key: string]: Message[] }, msg) => {
        const date = new Date(msg.created_at).toDateString()
        if (!groups[date]) groups[date] = []
        groups[date].push(msg)
        return groups
    }, {})

    function toggleMessageMenu(e: React.MouseEvent, id: string) {
        e.stopPropagation()
        setActiveMessageMenu(activeMessageMenu === id ? null : id)
    }

    if (loading && messages.length === 0) {
        return <div className="loading">Cargando chat...</div>
    }

    return (
        <div className="page chat-page" onClick={() => setActiveMessageMenu(null)}>
            {/* Chat Header */}
            <div className="chat-header">
                <h2><span>💬</span> Chat Familiar</h2>
                <div className="chat-header-actions">
                    <span className="chat-members">{members.length || '?'} miembros</span>
                </div>
            </div>

            {/* Messages Container */}
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="empty-chat">
                        <span className="empty-icon">✨</span>
                        <h3>¡Tu espacio familiar!</h3>
                        <p className="empty-hint">Comparte momentos, fotos o simplemente di hola. Todos los miembros de tu familia verán los mensajes aquí.</p>
                    </div>
                ) : (
                    Object.entries(messageGroups).map(([date, msgs]) => (
                        <div key={date} className="date-group">
                            <div className="date-divider">
                                <span>{formatDate(date)}</span>
                            </div>
                            {msgs.map((msg, idx) => {
                                const isOwn = msg.sender_member_id === myMember?.id
                                const showAvatar = idx === 0 || msgs[idx - 1].sender_member_id !== msg.sender_member_id

                                return (
                                    <div key={msg.id} className={`message ${isOwn ? 'own' : 'other'} ${showAvatar ? 'with-avatar' : ''}`}>
                                        <div className="message-avatar">
                                            {showAvatar ? (msg.sender?.display_name?.charAt(0) || '?') : ''}
                                        </div>

                                        <div className="message-bubble">
                                            {!isOwn && <span className="message-sender">{msg.sender?.display_name || 'Miembro'}</span>}
                                            {isOwn && <span className="message-sender self">Tú</span>}

                                            {msg.reply_to && (
                                                <div className="message-reply-quote">
                                                    <span className="reply-sender">{msg.reply_to.sender?.display_name}</span>
                                                    <span className="reply-content">{msg.reply_to.content || 'Multimedia'}</span>
                                                </div>
                                            )}

                                            {msg.media_url && (
                                                <div className="message-media">
                                                    {msg.media_type === 'image' ? (
                                                        <img src={msg.media_url} alt="Shared media" onClick={() => window.open(msg.media_url!, '_blank')} />
                                                    ) : (
                                                        <a href={msg.media_url} target="_blank" rel="noreferrer">Ver archivo</a>
                                                    )}
                                                </div>
                                            )}

                                            {msg.content && <p className="message-text">{msg.content}</p>}
                                            <span className="message-time">{formatTime(msg.created_at)}</span>

                                            {/* Message Actions */}
                                            <div className="message-actions">
                                                <button
                                                    className="message-action-btn"
                                                    onClick={(e) => toggleMessageMenu(e, msg.id)}
                                                    title="Opciones"
                                                >
                                                    {activeMessageMenu === msg.id ? '✕' : '⋯'}
                                                </button>

                                                {activeMessageMenu === msg.id && (
                                                    <div className="message-menu" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => { setReplyTo(msg); setActiveMessageMenu(null) }}>
                                                            <span>↩</span> Responder
                                                        </button>
                                                        {isOwn && msg.content && (
                                                            <button onClick={() => startEditing(msg)}>
                                                                <span>✏️</span> Editar
                                                            </button>
                                                        )}
                                                        {(isOwn || myMember?.role === 'owner' || myMember?.role === 'admin') && (
                                                            <button className="danger" onClick={() => deleteMessage(msg)}>
                                                                <span>🗑️</span> Eliminar
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply/Edit Preview */}
            {(replyTo || editingMessage) && (
                <div className={`input-preview ${editingMessage ? 'editing' : ''}`}>
                    <div className="preview-info">
                        <span className="preview-label">
                            {editingMessage ? '✏️ Editando mensaje' : `↩ Respondiendo a ${replyTo?.sender?.display_name || 'Alguien'}`}
                        </span>
                        <span className="preview-text">
                            {editingMessage ? editingMessage.content : (replyTo?.content || 'Contenido multimedia')}
                        </span>
                    </div>
                    <button className="preview-cancel" onClick={() => {
                        if (editingMessage) cancelEditing()
                        else setReplyTo(null)
                    }}>✕</button>
                </div>
            )}

            {/* Input Area */}
            <form className="chat-input-area" onSubmit={sendMessage}>
                <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()}>
                    📎
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
                <textarea
                    ref={inputRef}
                    className="chat-input"
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                        }
                    }}
                    rows={1}
                />
                <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={(!newMessage.trim() && !editingMessage) || sending}
                >
                    {sending ? '⏳' : editingMessage ? '✓' : '➤'}
                </button>
            </form>
        </div>
    )
}
