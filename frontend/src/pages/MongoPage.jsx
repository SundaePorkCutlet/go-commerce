import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/Card'
import { RefreshCw, Radio } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { apiCall } from '../api/services'

export default function MongoPage() {
  const [logs, setLogs] = useState([])
  const [nextCursor, setNextCursor] = useState('')
  const [report, setReport] = useState([])
  const [events, setEvents] = useState([])
  const [streamOn, setStreamOn] = useState(false)
  const [loading, setLoading] = useState(false)
  const eventSourceRef = useRef(null)
  const [filters, setFilters] = useState({ event: '', actor: '', order_id: '', user_id: '', limit: 20 })

  const fetchLogs = async (cursor = '') => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.event) params.set('event', filters.event)
    if (filters.actor) params.set('actor', filters.actor)
    if (filters.order_id) params.set('order_id', filters.order_id)
    if (filters.user_id) params.set('user_id', filters.user_id)
    params.set('limit', filters.limit)
    if (cursor) params.set('cursor', cursor)
    try {
      const res = await apiCall('paymentfc', `/debug/mongo/audit-logs?${params}`)
      if (res.ok) {
        const incoming = Array.isArray(res.data.logs) ? res.data.logs : []
        setLogs(prev => cursor ? [...prev, ...incoming] : incoming)
        setNextCursor(res.data.next_cursor || '')
      } else if (!cursor) {
        setLogs([])
        setNextCursor('')
      }
    } catch {
      if (!cursor) {
        setLogs([])
        setNextCursor('')
      }
    }
    setLoading(false)
  }

  const fetchReport = async () => {
    try {
      const res = await apiCall('paymentfc', '/debug/mongo/audit-report/daily')
      if (res.ok && Array.isArray(res.data.items)) setReport(res.data.items)
      else setReport([])
    } catch {
      setReport([])
    }
  }

  const connectStream = () => {
    if (eventSourceRef.current) eventSourceRef.current.close()
    const es = new EventSource('/api/paymentfc/debug/mongo/stream')
    es.onopen = () => setStreamOn(true)
    es.onerror = () => setStreamOn(false)
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data)
        setEvents(prev => [parsed, ...prev].slice(0, 100))
      } catch {}
    }
    eventSourceRef.current = es
  }

  useEffect(() => {
    fetchLogs()
    fetchReport()
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chartData = useMemo(() => {
    const perDay = {}
    report.forEach((r) => {
      perDay[r.date] = (perDay[r.date] || 0) + (r.count || 0)
    })
    return Object.entries(perDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  }, [report])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">MongoDB - Audit Logs</h1>

      <Card title="Audit Log Query">
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
          <input
            type="text" placeholder="Actor"
            value={filters.actor}
            onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button onClick={fetchLogs} disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white disabled:opacity-50">
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>
        {logs.length > 0 ? (
          <div className="max-h-80 overflow-auto space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 text-xs bg-gray-800/30 rounded px-3 py-2">
                <span className="text-gray-600 font-mono w-28 shrink-0">{log.create_time || ''}</span>
                <span className="text-blue-400 w-20 shrink-0">{log.event || ''}</span>
                <span className="text-emerald-400 w-24 shrink-0">{log.actor || ''}</span>
                <span className="text-gray-400 truncate">{JSON.stringify(log.metadata || {})}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600">로그가 없습니다. 결제 플로우를 호출해 이벤트를 만들고 다시 조회해보세요.</p>
        )}
        {nextCursor && (
          <button
            onClick={() => fetchLogs(nextCursor)}
            className="mt-3 px-3 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            Load more
          </button>
        )}
      </Card>

      <Card title="Aggregation Pipeline - Daily Volume">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
              <Bar dataKey="count" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <button
          onClick={fetchReport}
          className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
        >
          <RefreshCw size={12} /> Refresh report
        </button>
      </Card>

      <Card title={`Change Stream (SSE) ${streamOn ? '(live)' : '(disconnected)'}`}>
        <div className="mb-3">
          <button
            onClick={connectStream}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white"
          >
            <Radio size={12} /> Connect stream
          </button>
        </div>
        <div className="max-h-72 overflow-auto space-y-1">
          {events.length === 0 ? (
            <p className="text-xs text-gray-600">Connect를 누르면 Mongo Change Stream insert 이벤트를 표시합니다.</p>
          ) : (
            events.map((evt, i) => (
              <div key={i} className="text-xs bg-gray-800/30 rounded px-3 py-2">
                <span className="text-gray-500 mr-2">{evt.time}</span>
                <span className="text-purple-400 mr-2">{evt.topic}</span>
                <span className="text-gray-300">{JSON.stringify(evt.payload)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
