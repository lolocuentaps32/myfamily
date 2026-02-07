import { useEffect, useMemo, useState } from 'react'
import { pb } from './pb'
import { useSession } from './useSession'

export type FamilyOption = {
  family_id: string
  role: string
  name: string
  member_id: string
}

export type MyMember = {
  id: string
  display_name: string
  avatar_url: string | null
  role: string
}

const LS_KEY = 'familyos.active_family_id'

export function useActiveFamily() {
  const { session } = useSession()
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null)
  const [myMember, setMyMember] = useState<MyMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fromLS = localStorage.getItem(LS_KEY)
    if (fromLS) setActiveFamilyId(fromLS)
  }, [])

  useEffect(() => {
    if (!session) return

      ; (async () => {
        setLoading(true)
        setError(null)

        try {
          const records = await pb.collection('family_members').getFullList({
            filter: `auth_user_id = "${session.user.id}" && status = "active"`,
            expand: 'family'
          })

          const opts: FamilyOption[] = records.map((r: any) => ({
            family_id: r.family,
            role: r.role,
            member_id: r.member,
            name: r.expand?.family?.name ?? 'Familia'
          }))

          setFamilies(opts)

          if (!activeFamilyId && opts.length > 0) {
            setActiveFamilyId(opts[0].family_id)
            localStorage.setItem(LS_KEY, opts[0].family_id)
          } else if (activeFamilyId && !opts.some((o) => o.family_id === activeFamilyId) && opts.length > 0) {
            setActiveFamilyId(opts[0].family_id)
            localStorage.setItem(LS_KEY, opts[0].family_id)
          }
        } catch (e: any) {
          setError(e.message)
          console.error('Error loading families:', e)
        } finally {
          setLoading(false)
        }
      })()
  }, [session, activeFamilyId])

  // Load myMember details when activeFamilyId changes
  useEffect(() => {
    if (!activeFamilyId || !session) {
      setMyMember(null)
      return
    }

    const activeOpt = families.find(f => f.family_id === activeFamilyId)
    if (!activeOpt) return

      ; (async () => {
        try {
          const record = await pb.collection('members').getOne(activeOpt.member_id)

          if (record) {
            setMyMember({
              id: record.id,
              display_name: record.display_name,
              avatar_url: null,
              role: activeOpt.role
            })
          }
        } catch (e) {
          console.error('Error fetching myMember:', e)
        }
      })()
  }, [activeFamilyId, families, session])

  const active = useMemo(() => families.find((f) => f.family_id === activeFamilyId) ?? null, [families, activeFamilyId])

  function setActiveFamily(familyId: string) {
    setActiveFamilyId(familyId)
    localStorage.setItem(LS_KEY, familyId)
  }

  return { families, activeFamilyId, activeFamily: active, myMember, setActiveFamily, loading, error }
}
