import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Gauge,
  GitBranch,
  Layers3,
  LockKeyhole,
  PackageCheck,
  RadioTower,
  RefreshCw,
  Route,
  Server,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { checkAllHealth, SERVICES } from '../api/services'

const SERVICE_DETAILS = {
  userfc: {
    role: 'Identity & Auth',
    storage: 'PostgreSQL user + Redis',
    protocol: 'REST / gRPC',
    accent: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  },
  productfc: {
    role: 'Catalog & Stock Owner',
    storage: 'PostgreSQL product + Redis',
    protocol: 'Kafka consumer',
    accent: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  },
  orderfc: {
    role: 'Checkout Orchestrator',
    storage: 'PostgreSQL order + Outbox',
    protocol: 'REST / Kafka',
    accent: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  },
  paymentfc: {
    role: 'Payment & Audit',
    storage: 'PostgreSQL payment + MongoDB',
    protocol: 'Kafka / gRPC',
    accent: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  },
}

const SAGA_STEPS = [
  {
    title: 'Order committed',
    event: 'order.created',
    owner: 'ORDERFC',
    detail: 'orders + order_details + outbox saved in one DB transaction',
    icon: PackageCheck,
    tone: 'amber',
  },
  {
    title: 'Stock reserved',
    event: 'stock.reserved / stock.rejected',
    owner: 'PRODUCTFC',
    detail: 'stock owner reserves atomically and emits the next domain event',
    icon: Boxes,
    tone: 'emerald',
  },
  {
    title: 'Payment requested',
    event: 'payment.success / payment.failed',
    owner: 'PAYMENTFC',
    detail: 'payment request reaches Xendit path and records audit trail',
    icon: ShieldCheck,
    tone: 'rose',
  },
]

const RELIABILITY_ITEMS = [
  {
    title: 'Transactional Outbox',
    body: 'Order data and Kafka-ready event are persisted together before worker publish.',
    icon: GitBranch,
    badge: 'DB tx',
  },
  {
    title: 'Idempotency Reservation',
    body: 'Checkout token is reserved before order creation to block duplicate writes.',
    icon: LockKeyhole,
    badge: 'race safe',
  },
  {
    title: 'Kubernetes Runtime',
    body: 'Deployment, Service, ConfigMap, Secret, readiness/liveness probes verified in kind.',
    icon: Server,
    badge: 'kind',
  },
  {
    title: 'RED Observability',
    body: 'Prometheus scrapes service metrics and Grafana reads request, error, latency signals.',
    icon: Gauge,
    badge: 'up=1',
  },
]

const PROOF_ROWS = [
  ['Saga proof', 'ORDERFC outbox published, PRODUCTFC stock decreased, PAYMENTFC request stored'],
  ['Kafka proof', 'consumer topics and broker connectivity verified inside cluster'],
  ['K8s proof', 'all service/database/messaging pods running with zero restarts'],
  ['Metric proof', 'Prometheus query returned up=1 for all four services'],
]

function formatTime(date) {
  if (!date) return 'waiting'
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function StatusPill({ status, children }) {
  const styles = {
    healthy: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    neutral: 'border-stone-600 bg-stone-800/70 text-stone-300',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {children}
    </span>
  )
}

function KpiTile({ icon: Icon, label, value, detail, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-400/30 text-emerald-300',
    amber: 'border-amber-400/30 text-amber-300',
    rose: 'border-rose-400/30 text-rose-300',
    sky: 'border-sky-400/30 text-sky-300',
  }

  return (
    <div className="min-h-[138px] rounded-lg border border-stone-800 bg-[#171410] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="mb-5 flex items-center justify-between">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border bg-black/20 ${tones[tone]}`}>
          <Icon size={18} />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-stone-50">{value}</p>
      <p className="mt-2 min-h-10 text-sm leading-5 text-stone-400">{detail}</p>
    </div>
  )
}

function ServiceNode({ serviceKey, service, health }) {
  const details = SERVICE_DETAILS[serviceKey]
  const isChecking = !health
  const isHealthy = health?.status === 'healthy'
  const statusLabel = isChecking ? 'checking' : isHealthy ? 'healthy' : 'unreachable'

  return (
    <div className="min-h-[184px] rounded-lg border border-stone-800 bg-[#181510] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: service.color }} />
            <h3 className="text-sm font-semibold text-stone-100">{service.name}</h3>
          </div>
          <p className="mt-1 text-xs text-stone-500">{details.role}</p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
            isHealthy
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : isChecking
                ? 'border-stone-600 bg-stone-800 text-stone-400'
                : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-stone-500">endpoint</span>
          <span className="font-mono text-stone-300">{health?.endpoint || '/health'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-stone-500">latency</span>
          <span className="font-mono text-stone-300">{health?.latency != null ? `${health.latency}ms` : '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-stone-500">storage</span>
          <span className="text-right text-stone-300">{details.storage}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-stone-500">protocol</span>
          <span className={`rounded-md border px-2 py-1 text-[11px] ${details.accent}`}>{details.protocol}</span>
        </div>
      </div>
    </div>
  )
}

function FlowStep({ step, index }) {
  const Icon = step.icon
  const toneClass = {
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  }[step.tone]

  return (
    <div className="relative min-h-[190px] rounded-lg border border-stone-800 bg-[#181510] p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${toneClass}`}>
          <Icon size={18} />
        </span>
        <span className="font-mono text-xs text-stone-500">0{index + 1}</span>
      </div>
      <p className="text-sm font-semibold text-stone-100">{step.title}</p>
      <p className="mt-1 font-mono text-xs text-amber-200">{step.event}</p>
      <p className="mt-3 text-xs leading-5 text-stone-400">{step.detail}</p>
      <div className="mt-4 inline-flex rounded-md border border-stone-700 bg-stone-900/60 px-2 py-1 text-[11px] font-medium text-stone-300">
        owner: {step.owner}
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-100">{title}</h2>
      </div>
      {children && <div className="text-sm text-stone-400">{children}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [health, setHealth] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await checkAllHealth()
    setHealth(results)
    setLastChecked(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [refresh])

  const totalCount = Object.keys(SERVICES).length
  const healthyCount = useMemo(
    () => Object.values(health).filter((item) => item.status === 'healthy').length,
    [health],
  )
  const isAllHealthy = healthyCount === totalCount

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-stone-800 bg-[#15130f]">
        <div className="dashboard-grid px-5 py-6 md:px-7 md:py-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="mb-4 flex flex-wrap gap-2">
                <StatusPill status={isAllHealthy ? 'healthy' : 'warning'}>
                  {isAllHealthy ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {healthyCount}/{totalCount} live services
                </StatusPill>
                <StatusPill status="neutral">
                  <RadioTower size={13} />
                  Kafka Saga
                </StatusPill>
                <StatusPill status="neutral">
                  <Gauge size={13} />
                  RED metrics
                </StatusPill>
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-stone-50 md:text-5xl">
                Go Commerce Operations Console
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-400 md:text-base">
                MSA, Saga, Outbox, Idempotency, Kubernetes, Observability까지 하나의 주문 흐름으로 묶은 백엔드 포트폴리오 대시보드.
              </p>
            </div>

            <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[420px]">
              <div className="rounded-lg border border-stone-800 bg-black/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">last check</p>
                <p className="mt-2 font-mono text-lg text-stone-100">{formatTime(lastChecked)}</p>
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                className="inline-flex min-h-[86px] items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={Activity}
          label="service health"
          value={`${healthyCount}/${totalCount}`}
          detail="Live HTTP health checks through the dashboard proxy."
          tone="emerald"
        />
        <KpiTile
          icon={Workflow}
          label="saga path"
          value="3 stages"
          detail="order.created to stock reservation to payment request."
          tone="amber"
        />
        <KpiTile
          icon={ShieldCheck}
          label="reliability"
          value="Outbox"
          detail="Durable event handoff with idempotent checkout protection."
          tone="rose"
        />
        <KpiTile
          icon={Layers3}
          label="runtime proof"
          value="kind"
          detail="Kubernetes manifests, rollout checks, and metric evidence."
          tone="sky"
        />
      </section>

      <section>
        <SectionHeader eyebrow="Live Topology" title="Service Ownership Map">
          <span>DB ownership, protocol boundary, and runtime status</span>
        </SectionHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(SERVICES).map(([key, service]) => (
            <ServiceNode key={key} serviceKey={key} service={service} health={health[key]} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Core Flow" title="Checkout Saga">
          <span>Choreography over centralized orchestration</span>
        </SectionHeader>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {SAGA_STEPS.map((step, index) => (
            <div key={step.event} className="contents">
              <FlowStep step={step} index={index} />
              {index < SAGA_STEPS.length - 1 && (
                <div className="hidden items-center justify-center text-stone-600 lg:flex">
                  <ArrowRight size={22} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-stone-800 bg-[#15130f] p-5">
          <SectionHeader eyebrow="Reliability Stack" title="Failure Points Covered">
            <span>What changed from simple CRUD</span>
          </SectionHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {RELIABILITY_ITEMS.map(({ title, body, icon: Icon, badge }) => (
              <div key={title} className="min-h-[138px] rounded-lg border border-stone-800 bg-[#1b1711] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-700 bg-black/20 text-amber-200">
                    <Icon size={18} />
                  </span>
                  <span className="rounded-md border border-stone-700 bg-stone-900 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">
                    {badge}
                  </span>
                </div>
                <p className="text-sm font-semibold text-stone-100">{title}</p>
                <p className="mt-2 text-xs leading-5 text-stone-400">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-stone-800 bg-[#15130f] p-5">
          <SectionHeader eyebrow="Evidence" title="Verification Trail" />
          <div className="space-y-4">
            {PROOF_ROWS.map(([label, value]) => (
              <div key={label} className="border-b border-stone-800 pb-4 last:border-0 last:pb-0">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-300" />
                  <p className="text-sm font-semibold text-stone-100">{label}</p>
                </div>
                <p className="text-xs leading-5 text-stone-400">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-stone-800 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
              <Route size={16} className="text-amber-300" />
              Interview route
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              Start with Saga reliability, move to Kubernetes runtime proof, then finish with RED metric verification.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-stone-800 bg-[#15130f] p-5">
        <SectionHeader eyebrow="Operating Questions" title="What This Console Answers" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            ['Is checkout alive?', 'Health cards show service reachability and endpoint latency.'],
            ['Where can consistency break?', 'Saga and reliability panels expose outbox, idempotency, and compensation points.'],
            ['Can it run outside compose?', 'Kubernetes proof links the same MSA to Deployment and Service boundaries.'],
          ].map(([question, answer]) => (
            <div key={question} className="rounded-lg border border-stone-800 bg-[#1b1711] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 size={15} className="text-amber-300" />
                <p className="text-sm font-semibold text-stone-100">{question}</p>
              </div>
              <p className="text-xs leading-5 text-stone-400">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
