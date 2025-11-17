'use client'

import { FormEvent, useMemo, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { persistSupabaseSession } from '@/lib/auth-client'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

type AuthMode = 'sign-in' | 'sign-up'

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@magiterm.com'

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  const verifyServerSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        return false
      }

      const payload = (await response.json()) as { authenticated: boolean }
      return payload.authenticated
    } catch (error) {
      console.error('Failed to verify server session', error)
      return false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const checkExistingSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (!isMounted) {
          return
        }

        if (error) {
          console.error('Failed to fetch Supabase session', error)
        }

        const activeSession = data.session ?? null

        if (!activeSession) {
          setSessionChecked(true)
          return
        }

        persistSupabaseSession(activeSession)

        const serverHasSession = await verifyServerSession()

        if (!isMounted) {
          return
        }

        if (!serverHasSession) {
          await supabase.auth.signOut()
          persistSupabaseSession(null)

          if (!isMounted) {
            return
          }

          setErrorMessage('Your session expired. Please sign in again.')
          setSessionChecked(true)
          return
        }

        router.replace('/terminal')
      } catch (error) {
        console.error('Failed to boot Supabase auth', error)
        if (isMounted) {
          setSessionChecked(true)
        }
      }
    }

    checkExistingSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      persistSupabaseSession(nextSession)

      if (!isMounted) {
        return
      }

      if (nextSession) {
        const serverHasSession = await verifyServerSession()

        if (!isMounted) {
          return
        }

        if (serverHasSession) {
          router.replace('/terminal')
        } else {
          await supabase.auth.signOut()
          persistSupabaseSession(null)
          if (!isMounted) {
            return
          }
          setErrorMessage('Please sign in again to continue.')
          setSessionChecked(true)
        }
      } else {
        setSessionChecked(true)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router, supabase, verifyServerSession])

  useEffect(() => {
    setErrorMessage(null)
    setStatusMessage(null)
  }, [mode])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)
    setIsSubmitting(true)

    try {
      if (mode === 'sign-in') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw error
        }

        if (data.session) {
          persistSupabaseSession(data.session)
          router.replace('/terminal')
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) {
          throw error
        }

        if (data.session) {
          persistSupabaseSession(data.session)
          router.replace('/terminal')
        } else {
          setStatusMessage('Check your email to confirm your account.')
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!sessionChecked) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Checking authentication status...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'sign-in'
              ? 'Enter your credentials to access your sessions.'
              : 'Create an account to start using MagiTerm.'}
          </p>
        </div>

        <div className="mb-6 flex gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode('sign-in')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              mode === 'sign-in'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('sign-up')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              mode === 'sign-up'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground'
            }`}
          >
            Sign up
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2"
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <p className="rounded-md border border-red-900/50 bg-red-900/20 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          {statusMessage && (
            <p className="rounded-md border border-emerald-900/50 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
              {statusMessage}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Having trouble?{' '}
            <a
              href={`mailto:${supportEmail}`}
              className="text-foreground underline"
            >
              Contact our support team
            </a>
            .
          </p>
        </div>
      </div>

      <Link
        href="/"
        className="mt-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to home
      </Link>
    </div>
  )
}

