import { useEffect, useState } from 'react'
import { pb } from './pb'

export function useSession() {
  const [session, setSession] = useState<{ user: any } | null>(pb.authStore.model ? { user: pb.authStore.model } : null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setSession(model ? { user: model } : null)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return { session, loading }
}
