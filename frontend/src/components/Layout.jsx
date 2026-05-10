import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  HardDrive,
  MessageSquare,
  FileText,
  BarChart3,
  FlaskConical,
  Network,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/api-test', icon: FlaskConical, label: 'API Test' },
  { to: '/postgres', icon: Database, label: 'PostgreSQL' },
  { to: '/redis', icon: HardDrive, label: 'Redis' },
  { to: '/kafka', icon: MessageSquare, label: 'Kafka' },
  { to: '/mongo', icon: FileText, label: 'MongoDB' },
  { to: '/metrics', icon: BarChart3, label: 'Metrics' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#11100d] text-stone-100 lg:flex">
      <aside className="border-b border-stone-800 bg-[#15130f] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 border-b border-stone-800 p-4 lg:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200">
            <Network size={20} />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">
              Go Commerce
            </h1>
            <p className="mt-0.5 text-xs text-stone-500">Operations Console</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:flex-1 lg:space-y-1 lg:overflow-visible">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border border-amber-400/30 bg-amber-400/10 font-medium text-amber-200'
                    : 'border border-transparent text-stone-400 hover:border-stone-800 hover:bg-stone-900 hover:text-stone-200'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-stone-800 p-4 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            portfolio mode
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            MSA, Saga, Outbox, Kubernetes, Observability
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
