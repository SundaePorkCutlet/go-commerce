import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  HardDrive,
  MessageSquare,
  FileText,
  BarChart3,
  FlaskConical,
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
    <div className="flex h-screen">
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-lg font-bold tracking-tight text-white">
            Go Commerce
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Monitoring Dashboard</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800 text-xs text-gray-600">
          Phase 0 ~ 5 학습 대시보드
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
