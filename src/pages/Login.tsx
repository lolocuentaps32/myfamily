import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pb'
import { useSession } from '../lib/useSession'

export default function LoginPage() {
  const { session, loading } = useSession()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && session) nav('/')
  }, [loading, session, nav])

  const canSubmit = useMemo(() => email.trim().includes('@') && password.length >= 6, [email, password])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await pb.collection('users').authWithPassword(email.trim(), password)
      setMsg('¡Bienvenido de nuevo! 🎉')
    } catch (e: any) {
      setErr(e?.message ?? 'Email o contraseña incorrectos')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ paddingTop: '40px', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="card welcome-card" style={{ width: '100%' }}>
        <div className="welcome-icon">🏠</div>
        <h1 className="welcome-title">FamilyOS</h1>
        <p className="welcome-subtitle">
          Tu espacio familiar organizado
        </p>

        <form onSubmit={onSubmit} style={{ textAlign: 'left', marginTop: 32 }}>
          <label>Email</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
          />

          <div style={{ marginTop: 16 }}>
            <label>Contraseña</label>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="btn" style={{ width: '100%' }} disabled={!canSubmit || busy}>
              {busy ? 'Un momento...' : 'Entrar'}
            </button>
          </div>

          {msg && <p className="success-msg" style={{ marginTop: 16, textAlign: 'center' }}>{msg}</p>}
          {err && <p className="err" style={{ marginTop: 16, textAlign: 'center' }}>{err}</p>}
        </form>
      </div>
    </div>
  )
}
