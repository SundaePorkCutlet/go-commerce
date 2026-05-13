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
    role: '인증 경계',
    detail: 'JWT 발급, Redis 토큰 블랙리스트, gRPC 사용자 정보 조회',
    icon: ShieldCheck,
    tone: 'cyan',
  },
  {
    name: 'PRODUCTFC',
    role: '재고 소유자',
    detail: '상품/카테고리 관리, 원자적 재고 예약, 재고 이벤트 발행',
    icon: PackageCheck,
    tone: 'emerald',
  },
  {
    name: 'ORDERFC',
    role: '주문 핵심 흐름',
    detail: '주문 트랜잭션, idempotency token 선점, outbox worker',
    icon: GitBranch,
    tone: 'amber',
  },
  {
    name: 'PAYMENTFC',
    role: '결제 경계',
    detail: '결제 요청, Xendit 연동 흐름, MongoDB 감사 로그',
    icon: Database,
    tone: 'rose',
  },
]

const sagaScenarios = {
  success: {
    label: 'Success path',
    eyebrow: 'happy path',
    railClass: 'saga-success',
    description: '재고 예약과 결제 성공이 각각 이벤트로 이어지고, ORDERFC가 최종 주문 완료 상태를 반영합니다.',
    steps: [
      ['ORDERFC', 'order.created', '주문과 outbox 이벤트를 같은 DB 트랜잭션에 저장', 'cyan'],
      ['PRODUCTFC', 'stock.reserved', '재고 도메인 소유자가 원자적으로 재고를 예약', 'emerald'],
      ['PAYMENTFC', 'payment.requested', '결제 요청과 감사 로그를 기록', 'cyan'],
      ['ORDERFC', 'payment.success', '주문 상태를 완료로 변경', 'emerald'],
    ],
  },
  paymentFailed: {
    label: 'Payment failed',
    eyebrow: 'compensation path',
    railClass: 'saga-failure',
    description: '결제 실패를 주문 실패로 뭉개지 않고, ORDERFC가 주문 취소와 재고 복구 이벤트를 분리해 처리합니다.',
    steps: [
      ['ORDERFC', 'order.created', '주문과 outbox 이벤트를 같은 DB 트랜잭션에 저장', 'cyan'],
      ['PRODUCTFC', 'stock.reserved', '결제 전에 재고 예약이 먼저 성공한 상태', 'emerald'],
      ['PAYMENTFC', 'payment.failed', '인보이스 생성 또는 웹훅 처리 실패', 'rose'],
      ['ORDERFC', 'stock.rollback', '주문 취소 후 재고 복구 이벤트 발행', 'amber'],
      ['PRODUCTFC', 'stock.restored', '재고 도메인 소유자가 예약 재고를 복구', 'emerald'],
    ],
  },
  stockRejected: {
    label: 'Stock rejected',
    eyebrow: 'early rejection',
    railClass: 'saga-rejected',
    description: '재고 예약이 불가능하면 결제를 시작하지 않고, ORDERFC가 주문을 조기에 취소합니다.',
    steps: [
      ['ORDERFC', 'order.created', '주문과 outbox 이벤트를 같은 DB 트랜잭션에 저장', 'cyan'],
      ['PRODUCTFC', 'stock.rejected', '재고 도메인 소유자가 예약 실패를 판단', 'rose'],
      ['ORDERFC', 'order.cancelled', '결제 생성 없이 주문을 취소', 'amber'],
    ],
  },
}

const reliabilityCards = [
  {
    title: 'Transactional Outbox',
    body: '주문 저장과 이벤트 저장을 같은 DB 트랜잭션에 묶고, Kafka 발행은 worker가 재시도합니다.',
    icon: GitBranch,
  },
  {
    title: 'Idempotency Token Reservation',
    body: '주문 생성 전에 token을 먼저 선점해 동일 요청의 중복 주문 생성을 막습니다.',
    icon: LockKeyhole,
  },
  {
    title: 'Consumer Idempotency Mindset',
    body: 'exactly-once를 가정하지 않고, at-least-once 발행과 consumer 멱등성을 전제로 설계했습니다.',
    icon: MessageSquare,
  },
  {
    title: 'Kubernetes Runtime Proof',
    body: 'kind 환경에서 Service DNS, readiness probe, Kafka listener, metric scrape를 검증했습니다.',
    icon: Server,
  },
]

const evidenceCards = [
  {
    title: 'Prometheus scrape verification',
    label: '4개 서비스 scrape target up=1',
    image: heroEvidence,
  },
  {
    title: 'Kubernetes pods',
    label: 'kind 클러스터에서 MSA stack 실행',
    image: k8sPods,
  },
  {
    title: 'ORDERFC outbox',
    label: 'order.created 발행 성공',
    image: sagaOrderDb,
  },
  {
    title: 'PRODUCTFC stock',
    label: 'Saga 이후 재고 차감 확인',
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
            주문-재고-결제 흐름을 Kafka Saga로 분리하고, Outbox, Idempotency, Kubernetes 배포 검증, Observability까지 연결한 백엔드 포트폴리오입니다.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`${githubUrl}/blob/master/docs/PORTFOLIO_BRIEF.md`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
            >
              프로젝트 요약 <ExternalLink size={15} />
            </a>
            <a
              href={`${githubUrl}/blob/master/docs/improvements/README.md`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
            >
              개선 기록 <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 lg:px-16">
        <SectionTitle eyebrow="Architecture" title="Four bounded contexts, one checkout story">
          각 서비스가 자기 데이터를 소유하고, 공유 DB 대신 도메인 이벤트로 주문 흐름을 이어갑니다.
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
          주문, 재고, 결제 도메인이 Kafka 이벤트로 협력하고 실패 시 보상 흐름으로 복구됩니다.
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
              <p className="mt-2 text-sm font-semibold text-white">성공 흐름을 명시</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">재고 예약 이후 `payment.success`를 받아 주문을 완료합니다.</p>
            </div>
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-4">
              <Undo2 size={17} className="text-amber-300" />
              <p className="mt-2 text-sm font-semibold text-white">보상 흐름을 모델링</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">결제 실패는 재고 복구 이벤트로 연결해 상태 불일치를 줄입니다.</p>
            </div>
            <div className="rounded-lg border border-rose-300/20 bg-rose-300/5 p-4">
              <Ban size={17} className="text-rose-300" />
              <p className="mt-2 text-sm font-semibold text-white">재고 실패는 조기 종료</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">재고 예약 실패 시 결제를 만들지 않고 주문을 취소합니다.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 lg:px-16">
        <SectionTitle eyebrow="Reliability" title="Failure paths modeled as architecture">
          주문 흐름에서 발생할 수 있는 이벤트 유실, 중복 요청, 보상 처리 문제를 구조 안에 반영했습니다.
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
          kind 기반 Kubernetes 배포와 Saga 실행, Prometheus/Grafana 검증 결과를 증거 자료로 정리했습니다.
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Engineering summary</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              Failure-aware commerce backend
            </h2>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6">
            <p className="text-lg leading-8 text-zinc-200">
              주문이라는 하나의 비즈니스 흐름 안에서 이벤트 유실, 중복 주문, 비동기 보상,
              Kubernetes 배포, metric 기반 검증까지 하나의 case study로 구성했습니다.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                [Workflow, 'Saga', '주문 흐름'],
                [Gauge, 'RED', '운영 지표'],
                [Network, 'K8s', '배포 경계'],
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
              공개 포트폴리오 화면
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              첫 화면은 프로젝트 강점을 빠르게 보여주고, 상단 메뉴에서는 API 테스트와 디버깅 화면까지 확인할 수 있습니다.
            </p>
          </div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
          >
            GitHub <Code2 size={15} />
          </a>
        </div>
      </section>
    </div>
  )
}
