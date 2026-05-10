import { Activity, AlertTriangle } from 'lucide-react'

export default function ServiceCard({ name, health, color }) {
  const isHealthy = health?.status === 'healthy'

  return (
    <div className="rounded-lg border border-stone-800 bg-[#171410] p-5 transition-colors hover:border-stone-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-semibold text-sm">{name}</h3>
        </div>
        {isHealthy ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Activity size={14} /> Healthy
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle size={14} /> Down
          </span>
        )}
      </div>

      <div className="space-y-2 text-xs text-stone-400">
        <div className="flex justify-between">
          <span>Status</span>
          <span className={isHealthy ? 'text-emerald-400' : 'text-red-400'}>
            {health?.status || 'checking...'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Latency</span>
          <span className="text-stone-300">
            {health?.latency != null ? `${health.latency}ms` : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Endpoint</span>
          <span className="text-stone-300">{health?.endpoint || '-'}</span>
        </div>
      </div>
    </div>
  )
}
