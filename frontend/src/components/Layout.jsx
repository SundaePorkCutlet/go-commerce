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
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/api-test', icon: FlaskConical, label: 'API Test' },
  { to: '/postgres', icon: Database, label: 'PostgreSQL' },
  { to: '/redis', icon: HardDrive, label: 'Redis' },
  { to: '/kafka', icon: MessageSquare, label: 'Kafka' },
  { to: '/mongo', icon: FileText, label: 'MongoDB' },
  { to: '/metrics', icon: BarChart3, label: 'Metrics' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#080a0a] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080a0a]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <NavLink to="/" end className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
            <Network size={20} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-white">Go Commerce</h1>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-zinc-500">engineering portfolio</p>
            </div>
          </NavLink>

          <nav className="flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-cyan-300/30 bg-cyan-300/10 font-medium text-cyan-100'
                      : 'border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-zinc-100'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
