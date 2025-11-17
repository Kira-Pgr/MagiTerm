'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { persistSupabaseSession } from '@/lib/auth-client'

export function AuthNav() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      persistSupabaseSession(data.session ?? null)
      setSession(data.session ?? null)
      setIsChecking(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      persistSupabaseSession(nextSession)
      setSession(nextSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    persistSupabaseSession(null)
    setSession(null)
    router.refresh()
    router.push('/login')
  }

  if (isChecking) {
    return <span className="text-sm text-muted-foreground">Checking auth…</span>
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Log in
      </Link>
    )
  }

  const email = session.user.email ?? 'Signed in'

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground md:inline">{email}</span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  )
}

