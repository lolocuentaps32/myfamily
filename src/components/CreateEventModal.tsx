import { useState } from 'react'
import Modal from './Modal'
import { pb } from '../lib/pb'
import { isoLocalToUtc } from '../lib/dateUtils'

interface Props {
    isOpen: boolean
    onClose: () => void
    familyId: string | null
    onCreated?: () => void
}

function toPBDate(iso: string) {
    return iso.replace('T', ' ').split('.')[0]
}

export default function CreateEventModal({ isOpen, onClose, familyId, onCreated }: Props) {
    const [title, setTitle] = useState('')
    const [start, setStart] = useState('')
    const [end, setEnd] = useState('')
    const [location, setLocation] = useState('')
    const [allDay, setAllDay] = useState(false)
    const [status, setStatus] = useState('confirmed')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!familyId || !title.trim() || !start) return
        if (!allDay && !end) return

        setBusy(true)
        setErr(null)
        try {
            const startsAt = allDay
                ? toPBDate(new Date(start + 'T00:00:00').toISOString())
                : toPBDate(isoLocalToUtc(start))
            const endsAt = allDay
                ? toPBDate(new Date(start + 'T23:59:59').toISOString())
                : toPBDate(isoLocalToUtc(end))

            await pb.collection('events').create({
                family: familyId,
                title: title.trim(),
                starts_at: startsAt,
                ends_at: endsAt,
                location: location.trim() || null,
                all_day: allDay,
                status,
                visibility: 'family'
            })

            // Reset
            setTitle('')
            setStart('')
            setEnd('')
            setLocation('')
            setAllDay(false)
            setStatus('confirmed')
            onCreated?.()
            onClose()
        } catch (e: any) {
            setErr(e?.message ?? 'Error creando evento')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📅 Nuevo Evento">
            <form onSubmit={handleSubmit}>
                {err && <p className="err">{err}</p>}

                <label>Título</label>
                <input
                    type="text"
                    placeholder="¿Qué evento es?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />

                <div className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={allDay}
                        onChange={(e) => setAllDay(e.target.checked)}
                    />
                    <span>Todo el día</span>
                </div>

                <label style={{ marginTop: 12 }}>{allDay ? 'Fecha' : 'Inicio'}</label>
                <input
                    type={allDay ? 'date' : 'datetime-local'}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                />

                {!allDay && (
                    <>
                        <label style={{ marginTop: 12 }}>Fin</label>
                        <input
                            type="datetime-local"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            required
                        />
                    </>
                )}

                <label style={{ marginTop: 12 }}>Ubicación</label>
                <input
                    type="text"
                    placeholder="¿Dónde?"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />

                <label style={{ marginTop: 12 }}>Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="confirmed">✅ Confirmado</option>
                    <option value="tentative">🔄 Tentativo</option>
                    <option value="cancelled">❌ Cancelado</option>
                </select>

                <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 20, width: '100%' }}>
                    {busy ? 'Creando...' : 'Crear Evento'}
                </button>
            </form>
        </Modal>
    )
}
