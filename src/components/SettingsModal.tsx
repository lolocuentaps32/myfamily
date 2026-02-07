import { useState, useEffect } from 'react'
import Modal from './Modal'
import { pb } from '../lib/pb'
import { useActiveFamily } from '../lib/useActiveFamily'
import { useSession } from '../lib/useSession'

type MemberRow = {
    member_id: string
    display_name: string
    role: string
    status: string
    auth_email: string
}

type InvitationRow = {
    family_id: string
    family_name: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: Props) {
    const { session } = useSession()
    const { families, activeFamilyId, setActiveFamily, loading } = useActiveFamily()

    const [members, setMembers] = useState<MemberRow[]>([])
    const [pendingInvitations, setPendingInvitations] = useState<InvitationRow[]>([])
    const [newFamilyName, setNewFamilyName] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<'admin' | 'adult' | 'child'>('adult')
    const [inviteDisplayName, setInviteDisplayName] = useState('')
    const [inviteGender, setInviteGender] = useState<'man' | 'woman' | 'boy' | 'girl' | ''>('')
    const [creating, setCreating] = useState(false)
    const [inviting, setInviting] = useState(false)
    const [pushEnabled, setPushEnabled] = useState(false)
    const [pushLoading, setPushLoading] = useState(false)
    const [msg, setMsg] = useState<string | null>(null)
    const [err, setErr] = useState<string | null>(null)

    async function loadMembers() {
        if (!activeFamilyId) return
        try {
            const records = await pb.collection('family_members').getFullList({
                filter: `family = "${activeFamilyId}"`,
                expand: 'member'
            })
            setMembers(records.map((r: any) => ({
                member_id: r.member,
                display_name: r.expand?.member?.display_name ?? 'Miembro',
                role: r.role,
                status: r.status,
                auth_email: r.expand?.member?.email ?? ''
            })))
        } catch { setMembers([]) }
    }

    async function loadPendingInvitations() {
        if (!pb.authStore.model?.id) return
        try {
            // Buscamos si el usuario actual tiene el email de alguna invitación
            const userEmail = pb.authStore.model.email
            const records = await pb.collection('family_members').getFullList({
                filter: `status = "invited" && expand.member.email = "${userEmail}"`,
                expand: 'family'
            })
            setPendingInvitations(records.map((r: any) => ({
                family_id: r.family,
                family_name: r.expand?.family?.name ?? 'Familia'
            })))
        } catch (e) {
            console.error(e)
            setPendingInvitations([])
        }
    }

    useEffect(() => {
        if (isOpen) {
            loadMembers()
            loadPendingInvitations()
        }
    }, [isOpen, activeFamilyId])

    async function onCreateFamily() {
        if (!newFamilyName.trim()) return
        setCreating(true)
        setErr(null)
        setMsg(null)
        try {
            // 1. Create family
            const family = await pb.collection('families').create({
                name: newFamilyName.trim()
            })

            // 2. Find or create member for current user
            let member;
            try {
                member = await pb.collection('members').getFirstListItem(`email="${pb.authStore.model?.email}"`)
            } catch {
                member = await pb.collection('members').create({
                    email: pb.authStore.model?.email,
                    display_name: displayName.trim() || pb.authStore.model?.email?.split('@')[0] || 'Yo'
                })
            }

            // 3. Create family_member as owner
            await pb.collection('family_members').create({
                family: family.id,
                member: member.id,
                role: 'owner',
                status: 'active'
            })

            setMsg('¡Familia creada! 🎉')
            setNewFamilyName('')
            setDisplayName('')
            setTimeout(() => window.location.reload(), 1500)
        } catch (e: any) {
            setErr(e?.message ?? 'Error creando familia')
        } finally {
            setCreating(false)
        }
    }

    async function onInviteMember() {
        if (!activeFamilyId || !inviteEmail.trim()) return
        setInviting(true)
        setErr(null)
        setMsg(null)
        try {
            // 1. Find or create member
            let member;
            const emailEnc = inviteEmail.trim().toLowerCase()
            try {
                member = await pb.collection('members').getFirstListItem(`email="${emailEnc}"`)
            } catch {
                member = await pb.collection('members').create({
                    email: emailEnc,
                    display_name: inviteDisplayName.trim() || emailEnc.split('@')[0],
                    gender: inviteGender || null
                })
            }

            // 2. Create family_member link
            await pb.collection('family_members').create({
                family: activeFamilyId,
                member: member.id,
                role: inviteRole,
                status: 'invited'
            })

            setMsg(`¡Invitación enviada a ${inviteEmail}! 📨`)
            setInviteEmail('')
            setInviteDisplayName('')
            setInviteGender('')
            loadMembers()
        } catch (e: any) {
            setErr(e?.message ?? 'Error enviando invitación')
        } finally {
            setInviting(false)
        }
    }

    async function acceptInvitation(familyId: string) {
        try {
            const userEmail = pb.authStore.model?.email
            if (!userEmail) throw new Error('No user email')

            const member = await pb.collection('members').getFirstListItem(`email="${userEmail}"`)
            const link = await pb.collection('family_members').getFirstListItem(`family="${familyId}" && member="${member.id}"`)

            await pb.collection('family_members').update(link.id, {
                status: 'active'
            })

            setMsg('¡Invitación aceptada! 🎉')
            loadPendingInvitations()
            setTimeout(() => window.location.reload(), 1500)
        } catch (e: any) {
            setErr(e.message)
        }
    }

    const currentUserRole = families.find(f => f.family_id === activeFamilyId)?.role
    const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'

    function getRoleLabel(role: string) {
        switch (role) {
            case 'owner': return '👑 Propietario'
            case 'admin': return '🛡️ Administrador'
            case 'adult': return '👤 Adulto'
            case 'child': return '👶 Niño'
            default: return role
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="⚙️ Configuración">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {err && <p className="err">{err}</p>}
                {msg && <p className="success-msg">{msg}</p>}

                {/* Familia activa - only for Admin */}
                {isAdmin && (
                    <div className="card-inner">
                        <h4>👨‍👩‍👧‍👦 Familia Activa</h4>
                        {loading ? (
                            <p className="muted">Cargando...</p>
                        ) : families.length === 0 ? (
                            <p className="muted">No perteneces a ninguna familia aún.</p>
                        ) : (
                            <select
                                value={activeFamilyId ?? ''}
                                onChange={(e) => setActiveFamily(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                {families.map((f) => (
                                    <option key={f.family_id} value={f.family_id}>
                                        {f.family_name} ({f.role})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {/* Invitaciones pendientes - visible for all */}
                {pendingInvitations.length > 0 && (
                    <div className="card-inner">
                        <h4>📨 Invitaciones Pendientes</h4>
                        {pendingInvitations.map((inv) => (
                            <div key={inv.family_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span>{inv.family_name}</span>
                                <button className="btn btn-primary btn-sm" onClick={() => acceptInvitation(inv.family_id)}>
                                    Aceptar
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Miembros - visible for all */}
                {activeFamilyId && (
                    <div className="card-inner">
                        <h4>👥 Miembros</h4>
                        {members.length === 0 ? (
                            <p className="muted">No hay miembros</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {members.map((m) => (
                                    <div key={m.member_id} style={{ fontSize: 14 }}>
                                        <strong>{m.display_name}</strong>
                                        <span className="muted" style={{ marginLeft: 8 }}>{getRoleLabel(m.role)}</span>
                                        {m.status === 'invited' && <span style={{ marginLeft: 8, color: 'var(--warning)' }}>📨 Invitado</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Invitar miembro - only for Admin */}
                {isAdmin && activeFamilyId && (
                    <div className="card-inner">
                        <h4>➕ Invitar Miembro</h4>
                        <input
                            type="email"
                            placeholder="Email del nuevo miembro"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Nombre (opcional)"
                            value={inviteDisplayName}
                            onChange={(e) => setInviteDisplayName(e.target.value)}
                            style={{ marginTop: 8 }}
                        />
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} style={{ marginTop: 8 }}>
                            <option value="admin">🛡️ Administrador</option>
                            <option value="adult">👤 Adulto</option>
                            <option value="child">👶 Niño</option>
                        </select>
                        <select value={inviteGender} onChange={(e) => setInviteGender(e.target.value as any)} style={{ marginTop: 8 }}>
                            <option value="">Género (opcional)</option>
                            <option value="man">👨 Hombre</option>
                            <option value="woman">👩 Mujer</option>
                            <option value="boy">👦 Niño</option>
                            <option value="girl">👧 Niña</option>
                        </select>
                        <button
                            className="btn btn-primary"
                            onClick={onInviteMember}
                            disabled={inviting || !inviteEmail.trim()}
                            style={{ marginTop: 12, width: '100%' }}
                        >
                            {inviting ? 'Enviando...' : 'Enviar Invitación'}
                        </button>
                    </div>
                )}

                {/* Crear nueva familia - only for Admin */}
                {isAdmin && (
                    <div className="card-inner">
                        <h4>🏠 Crear Nueva Familia</h4>
                        <input
                            type="text"
                            placeholder="Nombre de la familia"
                            value={newFamilyName}
                            onChange={(e) => setNewFamilyName(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Tu nombre en esta familia"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            style={{ marginTop: 8 }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={onCreateFamily}
                            disabled={creating || !newFamilyName.trim()}
                            style={{ marginTop: 12, width: '100%' }}
                        >
                            {creating ? 'Creando...' : 'Crear Familia'}
                        </button>
                    </div>
                )}

                {/* Cerrar sesión - visible for all */}
                <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--danger)', width: '100%' }}
                    onClick={() => {
                        pb.authStore.clear()
                        window.location.reload()
                    }}
                >
                    Cerrar sesión
                </button>
            </div>
        </Modal>
    )
}
