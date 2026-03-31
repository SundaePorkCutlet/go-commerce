import { useState } from 'react'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { apiCall } from '../api/services'

export default function MongoPage() {
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ event: '', order_id: '', limit: 20 })

  const fetchLogs = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.event) params.set('event', filters.event)
    if (filters.order_id) params.set('order_id', filters.order_id)
    params.set('limit', filters.limit)
    try {
      const res = await apiCall('paymentfc', `/api/v1/audit-logs?${params}`)
      if (res.ok) setLogs(res.data)
      else setLogs(null)
    } catch {
      setLogs(null)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">MongoDB - Audit Logs</h1>

      <EmptyState
        phase={4}
        title="MongoDB Analytics"
        description="PAYMENTFC에 감사 로그 조회 API와 Aggregation Pipeline을 구현하면 여기서 실시간 감사 데이터를 분석할 수 있습니다."
        items={[
          '기간별/이벤트별/사용자별 감사 로그 조회 API',
          'Aggregation Pipeline 리포트 (일별 결제 통계)',
          'Change Stream → SSE 실시간 감사 로그 피드',
          'TTL 인덱스로 90일 이후 자동 정리',
        ]}
      />

      <Card title="Audit Log Query (Phase 4 구현 후 활성화)">
        <div className="flex gap-3 mb-4">
          <input
            type="text" placeholder="Event type"
            value={filters.event}
            onChange={(e) => setFilters({ ...filters, event: e.target.value })}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text" placeholder="Order ID"
            value={filters.order_id}
            onChange={(e) => setFilters({ ...filters, order_id: e.target.value })}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button onClick={fetchLogs} disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white disabled:opacity-50">
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>
        {logs && Array.isArray(logs.logs) ? (
          <div className="max-h-80 overflow-auto space-y-1">
            {logs.logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-xs bg-gray-800/30 rounded px-3 py-2">
                <span className="text-gray-600 font-mono w-28 shrink-0">{log.create_time || ''}</span>
                <span className="text-blue-400 w-20 shrink-0">{log.event || ''}</span>
                <span className="text-gray-400 truncate">{JSON.stringify(log.metadata || {})}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600">Phase 4 구현 후 감사 로그를 조회할 수 있습니다.</p>
        )}
      </Card>
    </div>
  )
}
