'use client'

import type { Session } from '@supabase/supabase-js'

function buildCookieOptions(maxAgeSeconds: number) {
  const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  return `path=/; max-age=${maxAgeSeconds}; sameSite=Lax${secureFlag}`
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${value}; ${buildCookieOptions(maxAgeSeconds)}`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; ${buildCookieOptions(0)}`
}

export function persistSupabaseSession(session: Session | null) {
  if (!session) {
    clearCookie('sb-access-token')
    clearCookie('sb-refresh-token')
    clearCookie('supabase-auth-token')
    clearCookie('supabase-auth-token.0')
    return
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = session.expires_at ?? nowInSeconds + 3600
  const maxAge = Math.max(expiresAt - nowInSeconds, 60)

  const encodedAccessToken = encodeURIComponent(session.access_token)
  const encodedRefreshToken = encodeURIComponent(session.refresh_token ?? '')
  const serializedSession = encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
    })
  )

  setCookie('sb-access-token', encodedAccessToken, maxAge)
  setCookie('sb-refresh-token', encodedRefreshToken, maxAge)
  setCookie('supabase-auth-token', serializedSession, maxAge)
  setCookie('supabase-auth-token.0', serializedSession, maxAge)
}

