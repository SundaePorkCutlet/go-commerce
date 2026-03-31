import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { SERVICES, fetchMetrics } from '../api/services'

function parsePrometheusMetrics(text) {
  if (!text) return []
  const lines = text.split('\n')
  const metrics = []
  let currentHelp = ''
  for (const line of lines) {
    if (line.startsWith('# HELP')) {
      currentHelp = line.replace(/^# HELP\s+\S+\s*/, '')
    } else if (line.startsWith('# TYPE')) {
      continue
    } else if (line.trim() && !line.startsWith('#')) {
      const match = line.match(/^(\S+?)(\{.*?\})?\s+(.+)$/)
      if (match) {
        metrics.push({
          name: match[1],
          labels: match[2] || '',
          value: match[3],
          help: currentHelp,
        })
      }
    }
  }
  return metrics
}

export default function MetricsPage() {
  const [metricsData, setMetricsData] = useState({})
  const [loading, setLoading] = useState(false)
  const [selectedService, setSelectedService] = useState('userfc')
  const [filter, setFilter] = useState('')

  const refresh = async () => {
    setLoading(true)
    const results = {}
    await Promise.all(
      Object.keys(SERVICES).map(async (key) => {
        const text = await fetchMetrics(key)
        results[key] = text ? parsePrometheusMetrics(text) : null
      })
    )
    setMetricsData(results)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const currentMetrics = metricsData[selectedService]
  const hasCustomMetrics = currentMetrics?.some(
    (m) => !m.name.startsWith('go_') && !m.name.startsWith('process_') && !m.name.startsWith('promhttp_')
  )

  const filteredMetrics = currentMetrics?.filter(
    (m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Metrics Explorer</h1>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {Object.entries(SERVICES).map(([key, svc]) => (
          <button
            key={key}
            onClick={() => setSelectedService(key)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedService === key
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {svc.name}
            {metricsData[key] === null && <span className="ml-1 text-red-400 text-xs">offline</span>}
          </button>
        ))}
      </div>

      {!hasCustomMetrics && (
        <EmptyState
          phase={5}
          title="Observability"
          description="커스텀 Prometheus 메트릭을 등록하면 여기서 비즈니스 지표를 확인할 수 있습니다. 현재는 Go 런타임 기본 메트릭만 존재합니다."
          items={[
            'HTTP RED 메트릭 (requests_total, duration_seconds)',
            '비즈니스 메트릭 (orders_created, payments_processed)',
            'Grafana 대시보드 as Code',
            'Alertmanager 알림 규칙',
            'SLI/SLO 에러 버짓 대시보드',
          ]}
        />
      )}

      {currentMetrics && (
        <Card title={`${SERVICES[selectedService].name} Metrics`}>
          <input
            type="text"
            placeholder="Filter metrics..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 mb-4"
          />
          <div className="max-h-96 overflow-auto space-y-0.5">
            {filteredMetrics?.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono px-2 py-1 hover:bg-gray-800/50 rounded">
                <span className="text-blue-400 truncate flex-1">{m.name}{m.labels}</span>
                <span className="text-gray-300 shrink-0">{m.value}</span>
              </div>
            ))}
            {filteredMetrics?.length === 0 && (
              <p className="text-xs text-gray-600 py-4 text-center">No metrics found</p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
