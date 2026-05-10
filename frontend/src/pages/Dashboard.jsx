import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Code2,
  Database,
  ExternalLink,
  Gauge,
  GitBranch,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Network,
  PackageCheck,
  RadioTower,
  Server,
  ShieldCheck,
  Undo2,
  Workflow,
} from 'lucide-react'
import { useState } from 'react'
import heroEvidence from '../assets/evidence/observability-verification.svg'
import k8sPods from '../assets/evidence/k8s-pods.svg'
import sagaOrderDb from '../assets/evidence/saga-order-db.svg'
import sagaProductDb from '../assets/evidence/saga-product-db.svg'

const githubUrl = 'https://github.com/SundaePorkCutlet/go-commerce'

const heroTags = ['Go', 'MSA', 'Kafka Saga', 'Outbox', 'Kubernetes', 'Observability']

const serviceCards = [
  {
    name: 'USERFC',
    role: 'Identity boundary',
    detail: 'JWT, Redis blacklist, gRPC user profile lookup',
    icon: ShieldCheck,
    tone: 'cyan',
  },
  {
    name: 'PRODUCTFC',
    role: 'Stock owner',
    detail: 'Catalog CRUD, atomic stock reservation, stock events',
    icon: PackageCheck,
    tone: 'emerald',
  },
  {
    name: 'ORDERFC',
    role: 'Checkout core',
    detail: 'Order transaction, idempotency reservation, outbox worker',
    icon: GitBranch,
    tone: 'amber',
  },
  {
    name: 'PAYMENTFC',
    role: 'Payment boundary',
    detail: 'Payment request, Xendit path, MongoDB audit trail',
    icon: Database,
    tone: 'rose',
  },
]

const sagaScenarios = {
  success: {
    label: 'Success path',
    eyebrow: 'happy path',
    railClass: 'saga-success',
    description: 'Stock is reserved, payment succeeds, and the order is completed through domain events.',
    steps: [
      ['ORDERFC', 'order.created', 'Order and outbox are committed together', 'cyan'],
      ['PRODUCTFC', 'stock.reserved', 'Stock owner reserves inventory atomically', 'emerald'],
      ['PAYMENTFC', 'payment.requested', 'Payment request and audit log are recorded', 'cyan'],
      ['ORDERFC', 'payment.success', 'Order status becomes completed', 'emerald'],
    ],
  },
  paymentFailed: {
    label: 'Payment failed',
    eyebrow: 'compensation path',
    railClass: 'saga-failure',
    description: 'Payment failure is not hidden. ORDERFC cancels the order and emits rollback intent for stock recovery.',
    steps: [
      ['ORDERFC', 'order.created', 'Order and outbox are committed together', 'cyan'],
      ['PRODUCTFC', 'stock.reserved', 'Inventory was reserved before payment', 'emerald'],
      ['PAYMENTFC', 'payment.failed', 'Invoice creation or webhook processing fails', 'rose'],
      ['ORDERFC', 'stock.rollback', 'Order is cancelled and rollback event is published', 'amber'],
      ['PRODUCTFC', 'stock.restored', 'Reserved stock is restored by the stock owner', 'emerald'],
    ],
  },
  stockRejected: {
    label: 'Stock rejected',
    eyebrow: 'early rejection',
    railClass: 'saga-rejected',
    description: 'If PRODUCTFC cannot reserve inventory, payment never starts and ORDERFC cancels the order early.',
    steps: [
      ['ORDERFC', 'order.created', 'Order and outbox are committed together', 'cyan'],
      ['PRODUCTFC', 'stock.rejected', 'Stock owner rejects reservation atomically', 'rose'],
      ['ORDERFC', 'order.cancelled', 'Order is cancelled without creating payment', 'amber'],
    ],
  },
}

const reliabilityCards = [
  {
    title: 'Transactional Outbox',
    body: 'Kafka publish is decoupled from the request path without losing the order-created intent.',
    icon: GitBranch,
  },
  {
    title: 'Idempotency Token Reservation',
    body: 'Duplicate checkout requests are blocked before order rows are created.',
    icon: LockKeyhole,
  },
  {
    title: 'Consumer Idempotency Mindset',
    body: 'The system is designed around at-least-once delivery rather than pretending exactly-once.',
    icon: MessageSquare,
  },
  {
    title: 'Kubernetes Runtime Proof',
    body: 'kind manifests verify service DNS, probes, Kafka listener setup, and metric scraping.',
    icon: Server,
  },
]

const evidenceCards = [
  {
    title: 'Prometheus scrape verification',
    label: 'up=1 for all services',
    image: heroEvidence,
  },
  {
    title: 'Kubernetes pods',
    label: 'MSA stack running in kind',
    image: k8sPods,
  },
  {
    title: 'ORDERFC outbox',
    label: 'order.created published',
    image: sagaOrderDb,
  },
  {
    title: 'PRODUCTFC stock',
    label: 'stock changed after Saga',
    image: sagaProductDb,
  },
]

function ToneIcon({ icon: Icon, tone = 'cyan' }) {
  const tones = {
    cyan: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200',
    emerald: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200',
    amber: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
    rose: 'border-rose-300/30 bg-rose-300/10 text-rose-200',
  }

  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${tones[tone]}`}>
      <Icon size={19} />
    </span>
  )
}

function SectionTitle({ eyebrow, title, children }) {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-sm leading-6 text-zinc-400 md:text-base">{children}</p>}
    </div>
  )
}

function toneBadge(tone) {
  const tones = {
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200',
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
    amber: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
    rose: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
  }

  return tones[tone] || tones.cyan
}

function eventTone(tone) {
  const tones = {
    cyan: 'text-cyan-200',
    emerald: 'text-emerald-200',
    amber: 'text-amber-200',
    rose: 'text-rose-200',
  }

  return tones[tone] || tones.cyan
}

export default function Dashboard() {
  const [sagaMode, setSagaMode] = useState('success')
  const activeSaga = sagaScenarios[sagaMode]

  return (
    <div className="portfolio-showcase -mx-4 -my-4 md:-mx-6 md:-my-6 lg:-mx-8 lg:-my-8">
      <section className="case-hero relative min-h-[76vh] overflow-hidden px-5 py-16 md:px-10 lg:px-16">
        <img
          src={heroEvidence}
          alt="Prometheus verification terminal evidence"
          className="absolute inset-0 h-full w-full object-cover opacity-22"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,10,10,0.96)_0%,rgba(8,10,10,0.88)_42%,rgba(8,10,10,0.62)_100%)]" />
        <div className="absolute inset-0 case-grid opacity-70" />

        <div className="relative z-10 flex min-h-[calc(76vh-8rem)] max-w-6xl flex-col justify-center">
          <div className="mb-5 flex flex-wrap gap-2">
            {heroTags.map((tag) => (
              <span key={tag} className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
                {tag}
              </span>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Backend engineering portfolio
          </p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
            Go Commerce
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            Event-driven commerce platform designed around Saga reliability, transactional outbox, idempotency, Kubernetes deployment evidence, and observability.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`${githubUrl}/blob/master/docs/PORTFOLIO_BRIEF.md`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
            >
              Portfolio brief <ExternalLink size={15} />
            </a>
            <a
              href={`${githubUrl}/blob/master/docs/INTERVIEW_QA.md`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
            >
              Interview Q&A <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 lg:px-16">
        <SectionTitle eyebrow="Architecture" title="Four bounded contexts, one checkout story">
          Each service owns its data and publishes domain events instead of sharing database tables across service boundaries.
        </SectionTitle>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {serviceCards.map(({ name, role, detail, icon, tone }) => (
            <article key={name} className="group min-h-[220px] rounded-lg border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055]">
              <ToneIcon icon={icon} tone={tone} />
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{role}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{name}</h3>
              <p className="mt-4 text-sm leading-6 text-zinc-400">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-5 py-16 md:px-10 lg:px-16">
        <SectionTitle eyebrow="System flow" title="Saga choreography across service boundaries">
          The checkout path shows how order, stock, and payment domains coordinate through Kafka events.
        </SectionTitle>

        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-3 md:flex-row md:items-center md:justify-between">
            <div className="px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{activeSaga.eyebrow}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-300">{activeSaga.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Object.entries(sagaScenarios).map(([key, scenario]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSagaMode(key)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    sagaMode === key
                      ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                      : 'border-white/10 bg-white/[0.025] text-zinc-400 hover:border-white/20 hover:text-zinc-100'
                  }`}
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`saga-rail ${activeSaga.railClass} relative grid grid-cols-1 gap-4 lg:grid-flow-col lg:auto-cols-fr`}>
            {activeSaga.steps.map(([owner, event, detail, tone], index) => (
              <article key={`${sagaMode}-${owner}-${event}`} className="relative rounded-lg border border-white/10 bg-[#0f1111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${toneBadge(tone)}`}>
                    {owner}
                  </span>
                  <span className="font-mono text-xs text-zinc-600">0{index + 1}</span>
                </div>
                <p className={`font-mono text-sm ${eventTone(tone)}`}>{event}</p>
                <p className="mt-4 text-sm leading-6 text-zinc-400">{detail}</p>
                {index < activeSaga.steps.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-zinc-600 lg:block" size={22} />
                )}
              </article>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4">
              <CheckCircle2 size={17} className="text-emerald-300" />
              <p className="mt-2 text-sm font-semibold text-white">Success is explicit</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">`payment.success` completes the order only after stock reservation.</p>
            </div>
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-4">
              <Undo2 size={17} className="text-amber-300" />
              <p className="mt-2 text-sm font-semibold text-white">Rollback is modeled</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">Payment failure emits rollback intent instead of pretending the flow never happened.</p>
            </div>
            <div className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-4">
              <Ban size={17} className="text-rose-300" />
              <p className="mt-2 text-sm font-semibold text-white">Rejection stops early</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">Stock rejection cancels the order before payment is created.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 lg:px-16">
        <SectionTitle eyebrow="Reliability" title="The real portfolio is the failure model">
          These are the parts that make the project more than a CRUD demo.
        </SectionTitle>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2">
          {reliabilityCards.map(({ title, body, icon: Icon }) => (
            <article key={title} className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0d0f0f] px-5 py-16 md:px-10 lg:px-16">
        <SectionTitle eyebrow="Implementation evidence" title="Kubernetes, Saga, and observability proof">
          Verification artifacts from the kind deployment are presented as part of the engineering portfolio.
        </SectionTitle>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2">
          {evidenceCards.map(({ title, label, image }) => (
            <article key={title} className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
              <div className="aspect-[16/7] overflow-hidden border-b border-white/10 bg-black">
                <img src={image} alt={title} className="h-full w-full object-cover opacity-90 transition duration-500 hover:scale-[1.03]" />
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-zinc-500">{label}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Interview narrative</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              The answer I want reviewers to remember
            </h2>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6">
            <p className="text-lg leading-8 text-zinc-200">
              I started from a Go commerce MSA and strengthened the parts where distributed systems usually fail:
              order/event consistency, duplicate checkout requests, asynchronous compensation, Kubernetes runtime wiring, and metric-based verification.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                [Workflow, 'Saga', 'business flow'],
                [Gauge, 'RED', 'operating signal'],
                [Network, 'K8s', 'runtime boundary'],
              ].map(([Icon, title, body]) => (
                <div key={title} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <Icon size={18} className="text-cyan-300" />
                  <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-10 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 size={17} className="text-emerald-300" />
              Portfolio-ready presentation
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              The first screen is designed for public review, while the navigation keeps the deeper API and debugging tools available.
            </p>
          </div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
          >
            Repository <Code2 size={15} />
          </a>
        </div>
      </section>
    </div>
  )
}
