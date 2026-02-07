import { useState } from 'react'
import Modal from './Modal'
import { pb } from '../lib/pb'

interface Props {
    isOpen: boolean
    onClose: () => void
    familyId: string | null
    onCreated?: () => void
}

function toPBDate(iso: string) {
    return iso.replace('T', ' ').split('.')[0]
}

export default function CreateBillModal({ isOpen, onClose, familyId, onCreated }: Props) {
    const [name, setName] = useState('')
    const [amount, setAmount] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!familyId || !name.trim() || !amount || !dueDate) return

        setBusy(true)
        setErr(null)
        try {
            const cents = Math.round(parseFloat(amount) * 100)
            await pb.collection('recurring_bills').create({
                family: familyId,
                name: name.trim(),
                amount_cents: cents,
                currency: 'EUR',
                next_due_at: toPBDate(new Date(dueDate).toISOString()),
                is_active: true
            })

            // Reset
            setName('')
            setAmount('')
            setDueDate('')
            onCreated?.()
            onClose()
        } catch (e: any) {
            setErr(e?.message ?? 'Error creando factura')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="💰 Factura Recurrente">
            <form onSubmit={handleSubmit}>
                {err && <p className="err">{err}</p>}

                <label>Nombre</label>
                <input
                    type="text"
                    placeholder="Ej: Netflix, Luz, Internet..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />

                <label style={{ marginTop: 12 }}>Importe (€)</label>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />

                <label style={{ marginTop: 12 }}>Próximo vencimiento</label>
                <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                />

                <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 20, width: '100%' }}>
                    {busy ? 'Guardando...' : 'Guardar Factura'}
                </button>
            </form>
        </Modal>
    )
}
