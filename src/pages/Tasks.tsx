import { useEffect, useState } from 'react'
import { pb } from '../lib/pb'
import { useActiveFamily } from '../lib/useActiveFamily'
import { useFamilyMembers, FamilyMember } from '../lib/useFamilyMembers'
import { getGenderEmoji } from '../lib/memberUtils'
import EditTaskModal from '../components/EditTaskModal'

type TaskRow = {
  id: string
  title: string
  status: string
  due_at: string | null
  priority: number
  assignee: string | null
}

const PRIORITY_OPTIONS = [
  { value: 1, label: '🔴 Alta', color: '#ff6b6b' },
  { value: 2, label: '🟡 Media', color: '#ffd93d' },
  { value: 3, label: '🟢 Baja', color: '#6bcb77' }
]

function getMemberName(members: FamilyMember[], id: string | null) {
  if (!id) return null
  const m = members.find(x => x.member_id === id)
  if (!m) return null
  const emoji = getGenderEmoji(m.gender)
  return `${emoji} ${m.display_name}`
}

export default function TasksPage() {
  const { activeFamilyId } = useActiveFamily()
  const { members } = useFamilyMembers()
  const [items, setItems] = useState<TaskRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)

  async function load() {
    if (!activeFamilyId) return
    setErr(null)
    try {
      const records = await pb.collection('tasks').getList<TaskRow>(1, 200, {
        filter: `family = "${activeFamilyId}" && status != "archived"`,
        sort: 'status,priority,due_at'
      })
      setItems(records.items)
    } catch (e: any) {
      setErr(e.message)
    }
  }

  useEffect(() => { load() }, [activeFamilyId])

  async function toggleDone(e: React.MouseEvent, t: TaskRow) {
    e.stopPropagation()
    const nextStatus = t.status === 'done' ? 'today' : 'done'
    try {
      await pb.collection('tasks').update(t.id, { status: nextStatus })
      load()
    } catch (e: any) {
      setErr(e.message)
    }
  }

  const pendingTasks = items.filter(t => t.status !== 'done')
  const doneTasks = items.filter(t => t.status === 'done')

  return (
    <div className="page">
      <div className="card-section">
        <h2>✅ Tareas</h2>
        {err && <p className="err">{err}</p>}

        <div className="section-header">
          <span className="section-icon">📋</span>
          <h3 className="section-title">Pendientes ({pendingTasks.length})</h3>
        </div>
        <div className="list">
          {pendingTasks.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <div className="empty-state-text">¡Todo completado!</div>
            </div>
          )}
          {pendingTasks.map((t) => {
            const assigneeName = getMemberName(members, t.assignee)
            const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === t.priority)
            return (
              <div
                key={t.id}
                className="item item-clickable"
                onClick={() => setEditingTask(t)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <button
                    className="checkbox-btn"
                    onClick={(e) => toggleDone(e, t)}
                    title="Marcar como hecha"
                  />
                  <div style={{ flex: 1 }}>
                    <div className="item-title">
                      {priorityInfo && <span style={{ marginRight: 6 }}>{priorityInfo.label.split(' ')[0]}</span>}
                      {t.title}
                    </div>
                    <div className="item-subtitle">
                      {t.due_at ? `📆 ${new Date(t.due_at).toLocaleDateString()}` : '📅 Sin fecha'}
                      {assigneeName && <span style={{ marginLeft: 8 }}>{assigneeName}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {doneTasks.length > 0 && (
          <>
            <div className="section-header">
              <span className="section-icon">✨</span>
              <h3 className="section-title">Completadas ({doneTasks.length})</h3>
            </div>
            <div className="list">
              {doneTasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="item done item-clickable"
                  onClick={() => setEditingTask(t)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <button
                      className="checkbox-btn checked"
                      onClick={(e) => toggleDone(e, t)}
                      title="Reabrir tarea"
                    />
                    <div>
                      <div className="item-title">{t.title}</div>
                      <div className="item-subtitle">
                        {t.due_at ? `📆 ${new Date(t.due_at).toLocaleDateString()}` : '📅 Sin fecha'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        familyId={activeFamilyId}
        onUpdated={load}
      />
    </div>
  )
}
