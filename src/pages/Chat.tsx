import { pb } from '../lib/pb'
import { useActiveFamily } from '../lib/useActiveFamily'
import './Chat.css'

type Message = {
    id: string
    content: string | null
    media_url: string | null
    media_type: string | null
    file: string | null
    created_at: string
    updated_at: string
    is_deleted: boolean
    sender: string
    expand?: {
        sender?: { display_name: string }
        reply_to?: { id: string; content: string | null; expand?: { sender?: { display_name: string } } }
    }
    reply_to?: string
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
            const records = await pb.collection('chat_messages').getList<any>(1, 100, {
                filter: `family = "${activeFamilyId}" && is_deleted = false`,
                sort: 'created_at',
                expand: 'sender,reply_to,reply_to.sender'
            })
            setMessages(records.items)
        } catch (e) {
            console.error('Error loading messages:', e)
        }

        setLoading(false)
    }, [activeFamilyId])

    // Load members
    const loadMembers = useCallback(async () => {
        if (!activeFamilyId) return

        try {
            const records = await pb.collection('family_members').getFullList({
                filter: `family = "${activeFamilyId}"`,
                expand: 'member'
            })
            setMembers(records.map((r: any) => ({
                id: r.member,
                display_name: r.expand?.member?.display_name ?? 'Miembro'
            })))
        } catch (e) {
            console.error('Error loading members:', e)
        }
    }, [activeFamilyId])

    // Setup real-time subscription
    useEffect(() => {
        if (!activeFamilyId) return

        loadMembers()
        loadMessages()

        // Subscribe
        pb.collection('chat_messages').subscribe('*', (e) => {
            if (e.action === 'create') {
                loadMessages()
            } else if (e.action === 'update') {
                if (e.record.is_deleted) {
                    setMessages(prev => prev.filter(m => m.id !== e.record.id))
                } else {
                    loadMessages()
                }
            } else if (e.action === 'delete') {
                setMessages(prev => prev.filter(m => m.id !== e.record.id))
            }
        }, { filter: `family = "${activeFamilyId}"` })

        return () => {
            pb.collection('chat_messages').unsubscribe('*')
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

    // Send or update message
    async function sendMessage(e?: React.FormEvent) {
        e?.preventDefault()

        if ((!newMessage.trim() && !editingMessage) || !activeFamilyId || !myMember || sending) return

        const text = newMessage.trim()
        setSending(true)

        try {
            if (editingMessage) {
                // Update existing message
                await pb.collection('chat_messages').update(editingMessage.id, {
                    content: text
                })
                setNewMessage('')
                setEditingMessage(null)
                loadMessages()
            } else {
                // Create new message
                await pb.collection('chat_messages').create({
                    family: activeFamilyId,
                    sender: myMember.id,
                    content: text,
                    reply_to: replyTo?.id || null
                })
                setNewMessage('')
                setReplyTo(null)
                inputRef.current?.focus()
                loadMessages()
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
            await pb.collection('chat_messages').update(msg.id, {
                is_deleted: true
            })
            setMessages(prev => prev.filter(m => m.id !== msg.id))
            setActiveMessageMenu(null)
        } catch (e: any) {
            console.error('Exception in deleteMessage:', e)
            alert(`Error al eliminar: ${e.message || 'Error desconocido'}.`)
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
            const mediaType = file.type.split('/')[0]
            const formData = new FormData()
            formData.append('family', activeFamilyId)
            formData.append('sender', myMember.id)
            formData.append('file', file)
            formData.append('media_type', mediaType)
            formData.append('content', '')

            await pb.collection('chat_messages').create(formData)
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
                                            {showAvatar ? (msg.expand?.sender?.display_name?.charAt(0) || '?') : ''}
                                        </div>

                                        <div className="message-bubble">
                                            {!isOwn && <span className="message-sender">{msg.expand?.sender?.display_name || 'Miembro'}</span>}
                                            {isOwn && <span className="message-sender self">Tú</span>}

                                            {msg.reply_to && msg.expand?.reply_to && (
                                                <div className="message-reply-quote">
                                                    <span className="reply-sender">{msg.expand.reply_to.expand?.sender?.display_name}</span>
                                                    <span className="reply-content">{msg.expand.reply_to.content || 'Multimedia'}</span>
                                                </div>
                                            )}

                                            {msg.file && (
                                                <div className="message-media">
                                                    {msg.media_type === 'image' ? (
                                                        <img src={pb.files.getUrl(msg, msg.file)} alt="Shared media" onClick={() => window.open(pb.files.getUrl(msg, msg.file), '_blank')} />
                                                    ) : (
                                                        <a href={pb.files.getUrl(msg, msg.file)} target="_blank" rel="noreferrer">Ver archivo</a>
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
                            {editingMessage ? '✏️ Editando mensaje' : `↩ Respondiendo a ${replyTo?.expand?.sender?.display_name || 'Alguien'}`}
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
