import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import ServiceCard from '../components/ServiceCard'
import Card from '../components/Card'
import { checkAllHealth, SERVICES } from '../api/services'

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

  const healthyCount = Object.values(health).filter(h => h.status === 'healthy').length
  const totalCount = Object.keys(SERVICES).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            {healthyCount}/{totalCount} services healthy
            {lastChecked && (
              <span className="ml-2">
                · last checked {lastChecked.toLocaleTimeString('ko-KR')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(SERVICES).map(([key, svc]) => (
          <ServiceCard
            key={key}
            name={svc.name}
            health={health[key]}
            color={svc.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Architecture">
          <div className="text-xs text-gray-400 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-300 font-medium mb-1">Data Stores</p>
                <p>PostgreSQL x4 (service-per-db)</p>
                <p>MongoDB (audit logs)</p>
                <p>Redis (cache)</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-300 font-medium mb-1">Communication</p>
                <p>Kafka (async events)</p>
                <p>gRPC (sync calls)</p>
                <p>REST API (external)</p>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-300 font-medium mb-1">Event Flow</p>
              <p>ORDER ─[order.created]─&gt; PAYMENT ─[payment.success/failed]─&gt; ORDER</p>
              <p>ORDER ─[stock.updated/rollback]─&gt; PRODUCT</p>
            </div>
          </div>
        </Card>

        <Card title="Learning Progress">
          <div className="space-y-3">
            {[
              { phase: 0, label: 'Dashboard', status: 'done', pct: 100 },
              { phase: 1, label: 'PostgreSQL Deep Dive', status: 'done', pct: 100 },
              { phase: 2, label: 'Redis Patterns', status: 'active', pct: 0 },
              { phase: 3, label: 'Kafka Architecture', status: 'pending', pct: 0 },
              { phase: 4, label: 'MongoDB Analytics', status: 'pending', pct: 0 },
              { phase: 5, label: 'Observability', status: 'pending', pct: 0 },
            ].map((p) => (
              <div key={p.phase} className="flex items-center gap-3">
                <span
                  className={`text-xs font-mono w-6 text-center ${
                    p.status === 'done' ? 'text-emerald-400' : p.status === 'active' ? 'text-blue-400' : 'text-gray-600'
                  }`}
                >
                  {p.phase}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300">{p.label}</span>
                    <span className="text-xs text-gray-500">{p.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
