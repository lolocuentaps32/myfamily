import { useEffect, useState } from 'react'
import { pb } from './pb'
import { useActiveFamily } from './useActiveFamily'

export type FamilyMember = {
    member_id: string
    display_name: string
    role: string
    status: string
    auth_email: string | null
    gender: 'man' | 'woman' | 'boy' | 'girl' | null
}

export function useFamilyMembers() {
    const { activeFamilyId } = useActiveFamily()
    const [members, setMembers] = useState<FamilyMember[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!activeFamilyId) {
            setMembers([])
            setLoading(false)
            return
        }

        setLoading(true)
        pb.collection('family_members').getFullList({
            filter: `family = "${activeFamilyId}"`,
            expand: 'member'
        }).then((records) => {
            const mapped: FamilyMember[] = records.map((r: any) => ({
                member_id: r.member,
                display_name: r.expand?.member?.display_name ?? 'Miembro',
                role: r.role,
                status: r.status,
                auth_email: r.expand?.member?.email ?? null,
                gender: r.expand?.member?.gender ?? null
            }))
            setMembers(mapped)
            setLoading(false)
        }).catch(err => {
            console.warn('useFamilyMembers:', err.message)
            setMembers([])
            setLoading(false)
        })
    }, [activeFamilyId])

    return { members, loading }
}
