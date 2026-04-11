import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Radio } from 'lucide-react'
import Card from '../components/Card'
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

  return (
    <div className="space-y-6">
      {!available && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium text-amber-200">Kafka 엔드포인트에 연결되지 않았습니다</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Phase 3는 구현된 상태입니다. USERFC·PRODUCTFC·ORDERFC·PAYMENTFC를 띄운 뒤(예:{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">docker compose</code>
            ) 위의 새로고침을 누르면 <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">/debug/kafka</code>{' '}
            통계가 채워집니다.
          </p>
        </div>
      )}

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
        {Object.keys(SERVICES).map((svcKey) => {
          const data = stats[svcKey]
          const offline = !data
          return (
            <Card key={svcKey} title={`${SERVICES[svcKey].name} - Kafka Stats`}>
              {offline && (
                <p className="mb-3 text-xs text-gray-500">
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-400">offline</span>
                  {' '}/debug/kafka 응답 없음
                </p>
              )}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-lg font-bold text-blue-400">{data?.messages_produced ?? 0}</p>
                  <p className="text-xs text-gray-500">Produced</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-lg font-bold text-emerald-400">{data?.messages_consumed ?? 0}</p>
                  <p className="text-xs text-gray-500">Consumed (ok+dup)</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-lg font-bold text-red-400">{data?.dlq_count ?? 0}</p>
                  <p className="text-xs text-gray-500">DLQ</p>
                </div>
              </div>
              {data?.consumer_stats && (
                <pre className="mt-3 text-[10px] text-gray-500 font-mono overflow-x-auto bg-gray-900/40 rounded p-2">
                  {JSON.stringify(data.consumer_stats, null, 2)}
                </pre>
              )}
            </Card>
          )
        })}
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
