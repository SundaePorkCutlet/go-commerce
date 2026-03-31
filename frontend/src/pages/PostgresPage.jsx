import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { SERVICES, fetchDebugQueries } from '../api/services'

export default function PostgresPage() {
  const [queries, setQueries] = useState({})
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const results = {}
    let found = false
    await Promise.all(
      Object.keys(SERVICES).map(async (key) => {
        const data = await fetchDebugQueries(key)
        if (data) {
          results[key] = data
          found = true
        }
      })
    )
    setQueries(results)
    setAvailable(found)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  if (!available) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">PostgreSQL Monitor</h1>
        <EmptyState
          phase={1}
          title="PostgreSQL Deep Dive"
          description="각 서비스에 /debug/queries 엔드포인트를 구현하면 여기서 실시간 쿼리 성능을 관측할 수 있습니다."
          items={[
            'GORM Callback으로 쿼리 로깅 & 수집',
            '인덱스 전략 수립 (복합, GIN, 부분 인덱스)',
            'FOR UPDATE 비관적 락으로 재고 race condition 해결',
            'CTE + Window Function 리포트',
            'golang-migrate 마이그레이션 도구 도입',
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">PostgreSQL Monitor</h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {Object.entries(queries).map(([svcKey, data]) => (
        <Card key={svcKey} title={`${SERVICES[svcKey].name} - Queries`}>
          {data.slow_queries?.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 pr-4">Query</th>
                    <th className="text-right py-2 pr-4">Duration</th>
                    <th className="text-right py-2">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slow_queries.map((q, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 text-gray-300 font-mono truncate max-w-md">{q.query}</td>
                      <td className="py-2 pr-4 text-right text-amber-400">{q.duration}</td>
                      <td className="py-2 text-right text-gray-400">{q.rows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No slow queries recorded</p>
          )}

          {data.stats && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gray-200">{data.stats.total_queries || 0}</p>
                <p className="text-xs text-gray-500">Total Queries</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-400">{data.stats.avg_duration || '-'}</p>
                <p className="text-xs text-gray-500">Avg Duration</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{data.stats.connections || 0}</p>
                <p className="text-xs text-gray-500">Active Conns</p>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
