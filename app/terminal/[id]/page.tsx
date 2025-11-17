import { redirect } from 'next/navigation'
import { getCurrentUserId } from '@/lib/auth'
import { TerminalSessionClient } from './TerminalSessionClient'

interface PageProps {
  params: { id: string }
}

export default async function TerminalSessionPage({ params }: PageProps) {
  try {
    await getCurrentUserId()
  } catch {
    redirect('/login')
  }

  return <TerminalSessionClient sessionId={params.id} />
}
