import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Radio } from 'lucide-react'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { SERVICES, fetchKafkaStats } from '../api/services'

export default function KafkaPage() {
  const [stats, setStats] = useState({})
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)
  const eventSourceRef = useRef(null)

  const refresh = async () => {
    setLoading(true)
    const results = {}
    let found = false
    await Promise.all(
      Object.keys(SERVICES).map(async (key) => {
        const data = await fetchKafkaStats(key)
        if (data) {
          results[key] = data
          found = true
        }
      })
    )
    setStats(results)
    setAvailable(found)
    setLoading(false)
  }

  const connectSSE = (serviceKey) => {
    if (eventSourceRef.current) eventSourceRef.current.close()
    const svc = SERVICES[serviceKey]
    try {
      const es = new EventSource(`${svc.prefix}/debug/kafka/stream`)
      es.onmessage = (e) => {
        const event = JSON.parse(e.data)
        setEvents((prev) => [event, ...prev].slice(0, 100))
      }
      es.onopen = () => setSseConnected(true)
      es.onerror = () => setSseConnected(false)
      eventSourceRef.current = es
    } catch {
      setSseConnected(false)
    }
  }

  useEffect(() => {
    refresh()
    return () => { if (eventSourceRef.current) eventSourceRef.current.close() }
  }, [])

  if (!available) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Kafka Monitor</h1>
        <EmptyState
          phase={3}
          title="Kafka Event Architecture"
          description="각 서비스에 /debug/kafka 엔드포인트와 SSE 스트림을 구현하면 실시간 이벤트 흐름을 관측할 수 있습니다."
          items={[
            'PRODUCTFC stock.updated/rollback 컨슈머 완성',
            'Dead Letter Queue (DLQ) 구현',
            '멱등성(Idempotency) 보장 - Redis SET 활용',
            '파티션 키 전략 (user_id 기반 순서 보장)',
            '이벤트 스키마 버전 관리',
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kafka Monitor</h1>
        <div className="flex gap-2">
          {Object.keys(SERVICES).map((key) => (
            <button key={key} onClick={() => connectSSE(key)}
              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-400">
              <Radio size={10} className="inline mr-1" />{SERVICES[key].name}
            </button>
          ))}
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(stats).map(([svcKey, data]) => (
          <Card key={svcKey} title={`${SERVICES[svcKey].name} - Kafka Stats`}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-lg font-bold text-blue-400">{data.messages_produced ?? 0}</p>
                <p className="text-xs text-gray-500">Produced</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-lg font-bold text-emerald-400">{data.messages_consumed ?? 0}</p>
                <p className="text-xs text-gray-500">Consumed (ok+dup)</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-lg font-bold text-red-400">{data.dlq_count ?? 0}</p>
                <p className="text-xs text-gray-500">DLQ</p>
              </div>
            </div>
            {data.consumer_stats && (
              <pre className="mt-3 text-[10px] text-gray-500 font-mono overflow-x-auto bg-gray-900/40 rounded p-2">
                {JSON.stringify(data.consumer_stats, null, 2)}
              </pre>
            )}
          </Card>
        ))}
      </div>

      <Card title={`Event Stream ${sseConnected ? '(live)' : '(disconnected)'}`}>
        <div className="max-h-80 overflow-auto space-y-1">
          {events.length === 0 ? (
            <p className="text-xs text-gray-600">SSE 버튼을 눌러 서비스에 연결하세요</p>
          ) : (
            events.map((evt, i) => (
              <div key={i} className="flex items-start gap-3 text-xs bg-gray-800/30 rounded px-3 py-2">
                <span className="text-gray-600 font-mono w-16 shrink-0">{evt.time || ''}</span>
                <span className="text-blue-400 font-medium w-24 shrink-0">{evt.topic || ''}</span>
                <span className="text-gray-400 truncate">{JSON.stringify(evt.payload || evt)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
