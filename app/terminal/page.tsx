import { redirect } from 'next/navigation'
import { getCurrentUserId } from '@/lib/auth'
import { TerminalListClient } from './TerminalListClient'

export default async function TerminalPage() {
  try {
    await getCurrentUserId()
  } catch {
    redirect('/login')
  }

  return <TerminalListClient />
}
