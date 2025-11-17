import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
  )
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function extractBearerToken(authHeader?: string | null) {
  if (!authHeader) return undefined
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token
  }
  return undefined
}

function parseSupabaseAuthCookie(value?: string) {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    return typeof parsed.access_token === 'string' ? parsed.access_token : undefined
  } catch {
    return undefined
  }
}

function getAccessToken() {
  const headerStore = headers()
  const cookieStore = cookies()

  const authHeaderToken = extractBearerToken(headerStore.get('authorization'))

  const cookieToken =
    cookieStore.get('sb-access-token')?.value ||
    cookieStore.get('sb:access-token')?.value ||
    cookieStore.get('sb:token')?.value ||
    parseSupabaseAuthCookie(cookieStore.get('supabase-auth-token')?.value) ||
    parseSupabaseAuthCookie(cookieStore.get('supabase-auth-token.0')?.value)

  return authHeaderToken || cookieToken
}

export async function getCurrentUserId(): Promise<string> {
  const accessToken = getAccessToken()

  if (!accessToken) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user) {
    throw new Error('Unauthorized')
  }

  return data.user.id
}

export async function requireAuth(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Unauthorized')
  }
  return userId
}
