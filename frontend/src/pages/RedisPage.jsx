import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { SERVICES, fetchRedisStats } from '../api/services'

export default function RedisPage() {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const results = {}
    let found = false
    await Promise.all(
      Object.keys(SERVICES).map(async (key) => {
        const data = await fetchRedisStats(key)
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

  useEffect(() => { refresh() }, [])

  if (!available) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Redis Monitor</h1>
        <EmptyState
          phase={2}
          title="Redis Patterns"
          description="각 서비스에 /debug/redis 엔드포인트를 구현하면 캐시 hit/miss, 키 분포, 랭킹 등을 실시간으로 확인할 수 있습니다."
          items={[
            '캐시 무효화 전략 (상품 수정/삭제 시 즉시 삭제)',
            'Redlock 분산 락 (재고 동시성 제어)',
            'Sorted Set 기반 슬라이딩 윈도우 Rate Limiter',
            '실시간 인기 상품 랭킹 (ZINCRBY, ZREVRANGE)',
            'JWT 토큰 블랙리스트',
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Redis Monitor</h1>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {Object.entries(stats).map(([svcKey, data]) => (
        <Card key={svcKey} title={`${SERVICES[svcKey].name} - Redis`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Cache Hits" value={data.hits ?? '-'} color="text-emerald-400" />
            <Stat label="Cache Misses" value={data.misses ?? '-'} color="text-red-400" />
            <Stat label="Hit Ratio" value={data.hit_ratio ? `${(data.hit_ratio * 100).toFixed(1)}%` : '-'} color="text-blue-400" />
            <Stat label="Keys" value={data.total_keys ?? '-'} color="text-gray-300" />
          </div>
          {data.ranking && data.ranking.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Top Products</p>
              <div className="space-y-1">
                {data.ranking.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-3 py-1.5">
                    <span className="text-gray-300">#{i + 1} {item.name}</span>
                    <span className="text-amber-400">{item.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
