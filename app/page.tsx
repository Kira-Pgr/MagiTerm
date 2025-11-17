import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Rocket, Sparkles, Users } from 'lucide-react'
import { HeroTerminal } from '@/components/HeroTerminal'
import { Button } from '@/components/ui/button'

const features: Array<{
  title: string
  description: string | string[]
  icon: LucideIcon
}> = [
  {
    title: 'Invent',
    description: [
      'Design impossible hardware. ',
      'A 10,000-core CPU, or an OS written in music.',
      'Describe it and MagiTerm will render its reality.',
    ],
    icon: Sparkles,
  },
  {
    title: 'Collaborate',
    description: [
      'Build in duet with the AI. ',
      'Test the edges of your wildest imagination, ',
      'Refine your prompts in real time.',
    ],
    icon: Users,
  },
  {
    title: 'Simulate',
    description: [
      "Run commands on machines that shouldn't exist. ",
      "Explore their filesystems, boot surreal OSes",
      'Or just learn about terminal commands.',
    ],
    icon: Rocket,
  },
]

export default function HomePage() {
  return (
    <div className="bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] flex-col gap-24 px-4 py-24">
        <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
              Imagination mode
            </div>
            <div className="space-y-6">
              <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                The Terminal at the Edge of Imagination
              </h1>
              <p className="space-y-1 text-lg text-white/80">
                <span className="block">Welcome to MagiTerm.</span>
                <span className="block">
                  A fully AI-simulated environment where you can invent and build any system.
                </span>
                <span className="block">
                  Interact with any hardware or software you can dream up.
                </span>
                <span className="block">
                  This isn't just a terminal; it's a collaborative sandbox for your "what-if" scenarios.
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/terminal">
                <Button
                  size="lg"
                  className="bg-slate-200 px-8 text-base font-semibold text-slate-900 shadow-[0_20px_50px_rgba(51,65,85,0.3)] transition hover:bg-slate-300"
                >
                  Launch a Session
                </Button>
              </Link>
              <div className="text-sm text-white/60">
                Imagine the machine. Name the impossible specs. Watch it boot.
              </div>
            </div>
          </div>
          <HeroTerminal className="w-full" />
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/15 bg-white/5 p-8 shadow-[0_30px_80px_rgba(2,6,23,0.65)] backdrop-blur"
            >
              <div className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 p-4">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-white">{title}</h3>
              <p className="space-y-1 text-sm text-white/75">
                {Array.isArray(description)
                  ? description.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))
                  : description}
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
