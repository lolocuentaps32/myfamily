import { useState } from 'react'
import { pb } from '../lib/pb'
import Modal from './Modal'
import { useActiveFamily } from '../lib/useActiveFamily'

interface Props {
    isOpen: boolean
    onClose: () => void
    familyId: string | null
    onCreated?: () => void
}

export default function CreatePointsModal({ isOpen, onClose, familyId, onCreated }: Props) {
    const { myMember } = useActiveFamily()
    const [loading, setLoading] = useState(false)
    const [memberId, setMemberId] = useState('')
    const [points, setPoints] = useState(1)
    const [reason, setReason] = useState('')
    const [membersList, setMembersList] = useState<{ id: string; display_name: string }[]>([])

    async function loadMembers() {
        if (!familyId) return
        try {
            const records = await pb.collection('family_members').getFullList({
                filter: `family = "${familyId}"`,
                expand: 'member'
            })
            setMembersList(records.map((r: any) => ({
                id: r.member,
                display_name: r.expand?.member?.display_name ?? 'Miembro'
            })))
        } catch { }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!familyId || !memberId || !reason.trim() || !myMember) return

        setLoading(true)

        try {
            await pb.collection('reward_points').create({
                family: familyId,
                member: memberId,
                points,
                reason: reason.trim(),
                creator: myMember.id
            })

            // Create feed post
            const member = membersList.find(m => m.id === memberId)
            await pb.collection('family_feed').create({
                family: familyId,
                author: myMember.id,
                content: `${points >= 0 ? '🎉' : '😔'} ${member?.display_name || 'Miembro'} ${points >= 0 ? 'ganó' : 'perdió'} ${Math.abs(points)} punto${Math.abs(points) !== 1 ? 's' : ''}: ${reason.trim()}`
            })

            setMemberId('')
            setPoints(1)
            setReason('')
            onClose()
            onCreated?.()
        } catch { } finally {
            setLoading(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="⭐ Dar Puntos">
            <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-group">
                    <label>Miembro</label>
                    <select
                        value={memberId}
                        onChange={(e) => setMemberId(e.target.value)}
                        required
                        onFocus={loadMembers}
                    >
                        <option value="">Selecciona un miembro</option>
                        {membersList.map(m => (
                            <option key={m.id} value={m.id}>{m.display_name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Puntos</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setPoints(p => Math.max(-10, p - 1))}
                            style={{ width: '40px' }}
                        >
                            -
                        </button>
                        <input
                            type="number"
                            value={points}
                            onChange={(e) => setPoints(Number(e.target.value))}
                            min={-10}
                            max={10}
                            style={{ textAlign: 'center', width: '60px' }}
                        />
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setPoints(p => Math.min(10, p + 1))}
                            style={{ width: '40px' }}
                        >
                            +
                        </button>
                    </div>
                    <small className="form-hint">
                        Usa valores positivos para premiar y negativos para penalizar
                    </small>
                </div>

                <div className="form-group">
                    <label>Motivo</label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ej: Ayudó a recoger la mesa"
                        required
                    />
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading || !memberId || !reason.trim()}>
                        {loading ? 'Guardando...' : `${points >= 0 ? '+' : ''}${points} Puntos`}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
