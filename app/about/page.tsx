import Link from 'next/link'
import { ArrowRight, MonitorCog, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const dreamStatements = [
  'Most terminals are a conversation with a machine. MagiTerm is a conversation with an imagination.',
  "It's not a server in the cloud. It's not a virtual machine. It's a fully AI-simulated environment, powered by a language model that has read the history of computing--and the future of science fiction.",
  'Real terminals are bound by silicon and code. lshw shows the hardware you have. MagiTerm shows the hardware you invent.',
  'This is a sandbox for "what-ifs." A duet between your curiosity and the AI\'s vast, simulated knowledge. You provide the prompt, and the AI builds the world, right down to the last blinking cursor.',
]

const personas = [
  {
    title: 'For the CS Learner',
    subtitle: 'The Unbreakable Lab',
    icon: MonitorCog,
    intro:
      'Ever wanted to explore the file system of a 1980s mainframe? Or safely see what rm -rf / really does on a Linux system without destroying your own machine?',
    bullets: [
      'Explore any OS: Spin up a simulated VAX/VMS, a classic Mac OS 9, or a modern Kubernetes cluster. No installs, no hardware required.',
      'Learn by doing: Run dangerous commands, edit system files, and explore network protocols in an environment where the "undo" button is simply a new session.',
      'Understand the abstract: Get detailed, AI-powered explanations for why a command works the way it does, complete with its simulated output.',
    ],
  },
  {
    title: 'For the Sci-Fi Enthusiast',
    subtitle: 'The World-Building Engine',
    icon: Sparkles,
    intro:
      'What if your operating system was grown from crystal and ran on light? What if your server was powered by steam? What if you could ssh into the computer from a 1980s sci-fi movie?',
    bullets: [
      'Invent hardware: `lshw --cpu_type=quantum --cores=8192`. Tell the AI what you have, and it will exist.',
      'Design fictional OSes: Create your own commands, file structures, and boot sequences. `boot --os=DreamWeaver_v3` is a valid move.',
      'Collaborate on ideas: Ask "What if my filesystem was 4-dimensional?" and watch the simulation unfold.',
    ],
  },
]

export default function AboutPage() {
  return (
    <div className="bg-gradient-to-b from-slate-950 via-slate-940 to-slate-900 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-24">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            About
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-white/50">
              What If Your Computer Was a Dream?
            </p>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              MagiTerm is where speculative computing becomes tactile.
            </h1>
            <p className="text-lg text-white/80">
              Most tools help you run commands on the hardware you already own. MagiTerm hands you a
              simulated machine that bends to your imagination and narrates what happens next.
            </p>
          </div>
        </section>

        <section className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(2,6,23,0.65)] backdrop-blur">
          {dreamStatements.map((statement) => (
            <p key={statement} className="text-base text-white/80">
              {statement}
            </p>
          ))}
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/50">
              A Tool for Learning. A Canvas for Creation.
            </p>
            <p className="mt-3 text-lg text-white/80">
              MagiTerm is built for two core purposes: to explore what is, and to build what could
              be.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {personas.map(({ title, subtitle, icon: Icon, intro, bullets }) => (
              <div
                key={title}
                className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/60 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.55)]"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-white/15 bg-white/5 p-3">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/60">{subtitle}</p>
                    <h3 className="text-xl font-semibold">{title}</h3>
                  </div>
                </div>
                <p className="text-sm text-white/75">{intro}</p>
                <ul className="space-y-3 text-sm text-white/80">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">How Does It Work?</h2>
          <p className="text-base text-white/80">
            When you type <code className="rounded bg-white/10 px-2 py-1 text-sm">connect
            --host=mars.network</code>, you are not sending a network packet--you are sending a prompt.
          </p>
          <p className="text-base text-white/80">
            The MagiTerm AI doesn't run code; it narrates the execution of code. It understands the
            idea of a boot sequence, the logic of a B-tree filesystem, and the poetry of a dial-up
            modem. It uses this understanding to generate a continuous, interactive, and persistent
            simulation of a computer that exists only for you.
          </p>
        </section>

        <section className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-center shadow-[0_30px_80px_rgba(2,6,23,0.65)]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/50">
              The Prompt is Waiting.
            </p>
            <p className="text-lg text-white/80">
              This tool is for the digital archaeologist and the system architect. The learner and
              the dreamer. The cursor is blinking. What will you invent first?
            </p>
          </div>
          <Link href="/terminal" className="inline-flex justify-center">
            <Button
              size="lg"
              className="group gap-3 bg-slate-100 px-8 text-base font-semibold text-slate-900 hover:bg-white"
            >
              <span>[ &gt; Start Your First Simulation ]</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Button>
          </Link>
        </section>
      </div>
    </div>
  )
}

