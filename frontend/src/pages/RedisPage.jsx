import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Database, TrendingUp, Shield, Clock, AlertTriangle, Zap, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import Card from '../components/Card'
import { SERVICES, fetchRedisStats, apiCall } from '../api/services'

function StatCard({ icon: Icon, label, value, sub, color = 'text-gray-200' }) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon size={14} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function CacheMonitorTab({ stats }) {
  const hasData = Object.keys(stats).length > 0

  if (!hasData) {
    return (
      <Card>
        <div className="text-center py-12">
          <Database size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400 mb-1">백엔드 서비스가 실행 중이 아닙니다</p>
          <p className="text-xs text-gray-600 mt-3 font-mono">docker compose up -d</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(stats).map(([svcKey, data]) => {
        const svc = SERVICES[svcKey]
        const hitRate = data.hit_rate_pct || 0
        const pieData = [
          { name: 'Hits', value: data.hits || 0, color: '#10b981' },
          { name: 'Misses', value: data.misses || 0, color: '#ef4444' },
        ].filter(d => d.value > 0)

        return (
          <div key={svcKey} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: svc.color }} />
              <h2 className="text-lg font-semibold text-gray-200">{svc.name}</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard icon={TrendingUp} label="Hit Rate" value={`${hitRate.toFixed(1)}%`}
                color={hitRate > 80 ? 'text-emerald-400' : hitRate > 50 ? 'text-amber-400' : 'text-red-400'} />
              <StatCard icon={Database} label="Hits" value={data.hits || 0} color="text-emerald-400" />
              <StatCard icon={AlertTriangle} label="Misses" value={data.misses || 0} color="text-red-400" />
              <StatCard icon={Activity} label="Total Ops" value={data.total_ops || 0} />
              <StatCard icon={Zap} label="Errors" value={data.errors || 0}
                color={data.errors > 0 ? 'text-red-400' : 'text-gray-200'} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Hit / Miss Ratio">
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="w-28 h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2}>
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-gray-400">Cache Hit</span>
                        <span className="text-gray-200 font-mono ml-auto">{data.hits || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-gray-400">Cache Miss</span>
                        <span className="text-gray-200 font-mono ml-auto">{data.misses || 0}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No cache operations yet</p>
                )}
              </Card>

              <Card title="DB Size">
                <div className="flex items-center justify-center py-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-400">{data.db_size ?? '?'}</p>
                    <p className="text-xs text-gray-500 mt-1">total keys in Redis</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RankingTab() {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(10)

  const fetchRanking = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiCall('productfc', `/v1/products/ranking?limit=${limit}`)
      if (res.ok && Array.isArray(res.data)) {
        setRanking(res.data)
      }
    } catch {}
    setLoading(false)
  }, [limit])

  useEffect(() => { fetchRanking() }, [fetchRanking])

  const chartData = ranking.map((item, i) => ({
    name: item.product_name || `#${item.product_id}`,
    views: item.view_count,
    color: i === 0 ? '#f59e0b' : i <= 2 ? '#3b82f6' : '#6b7280',
  }))

  return (
    <div className="space-y-4">
      <Card title={
        <span className="flex items-center gap-2">
          <TrendingUp size={14} className="text-amber-400" />
          Real-time Product Ranking (Sorted Set)
        </span>
      }>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={limit} onChange={e => setLimit(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500">
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
            <button onClick={fetchRanking} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {ranking.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="views" name="조회수" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="space-y-1.5">
                {ranking.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-4 py-2.5">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i <= 2 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'
                    }`}>{i + 1}</span>
                    <span className="text-sm text-gray-300">{item.product_name || `Product #${item.product_id}`}</span>
                    <span className="ml-auto text-sm font-mono text-amber-400">{item.view_count} views</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 text-center py-8">상품 조회가 발생하면 랭킹이 표시됩니다. GET /v1/products/:id를 호출해보세요.</p>
          )}

          <div className="bg-gray-800/40 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-400">Redis 자료구조</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-gray-500">
              <div>
                <span className="text-amber-400 font-medium">ZINCRBY ranking:product_views 1 {'{product_id}'}</span>
                <p>상품 조회 시 해당 상품의 점수를 +1</p>
              </div>
              <div>
                <span className="text-blue-400 font-medium">ZREVRANGE ranking:product_views 0 N WITHSCORES</span>
                <p>점수가 높은 순으로 상위 N개 반환</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function RateLimiterTab() {
  return (
    <Card title={
      <span className="flex items-center gap-2">
        <Shield size={14} className="text-blue-400" />
        Sliding Window Rate Limiter (Sorted Set)
      </span>
    }>
      <div className="space-y-4">
        <div className="bg-gray-800/40 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-300 mb-3">동작 원리</p>
          <div className="space-y-3 text-[11px] text-gray-400 font-mono">
            <div className="bg-gray-900/60 rounded-lg p-3">
              <p className="text-blue-400 mb-1">1. 오래된 요청 제거</p>
              <p>ZREMRANGEBYSCORE rate_limit:{'{ip}'} 0 {'{now - window}'}</p>
              <p className="text-gray-600 mt-1">→ 60초 윈도우 밖의 요청 기록 삭제</p>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-3">
              <p className="text-emerald-400 mb-1">2. 현재 요청 수 확인</p>
              <p>ZCARD rate_limit:{'{ip}'}</p>
              <p className="text-gray-600 mt-1">→ 윈도우 내 요청 수 카운트</p>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-3">
              <p className="text-amber-400 mb-1">3. 허용 시 요청 기록</p>
              <p>ZADD rate_limit:{'{ip}'} {'{timestamp}'} {'{unique_id}'}</p>
              <p className="text-gray-600 mt-1">→ 타임스탬프를 score로 저장</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-emerald-400 mb-2">고정 윈도우 (Fixed Window)</p>
            <div className="text-[11px] text-gray-400">
              <p>문제: 윈도우 경계에서 2배 트래픽 허용</p>
              <p className="font-mono text-gray-500 mt-1">
                59초: 10 req ✓ → 61초: 10 req ✓<br />
                → 2초 사이에 20 req 허용됨
              </p>
            </div>
          </div>
          <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-400 mb-2">슬라이딩 윈도우 (Sliding Window)</p>
            <div className="text-[11px] text-gray-400">
              <p>해결: 현재 시점 기준 60초를 항상 체크</p>
              <p className="font-mono text-gray-500 mt-1">
                어떤 시점에서든 60초 내 최대 10 req<br />
                → 경계 문제 없음
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-3 text-[11px] text-gray-500">
          <span className="text-blue-400 font-medium">적용 위치:</span> USERFC의 <code className="text-gray-400">/v1/login</code>, <code className="text-gray-400">/v1/register</code> — 60초당 10회 제한. 
          초과 시 <code className="text-gray-400">429 Too Many Requests</code> + <code className="text-gray-400">X-RateLimit-Remaining</code> 헤더 반환.
        </div>
      </div>
    </Card>
  )
}

function BlacklistTab() {
  return (
    <Card title={
      <span className="flex items-center gap-2">
        <Clock size={14} className="text-purple-400" />
        JWT Token Blacklist
      </span>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-red-400 mb-2">Before: 로그아웃 불가</p>
            <div className="space-y-1 text-[11px] font-mono text-gray-400">
              <p>POST /v1/login → token (exp: 1h)</p>
              <p>사용자가 로그아웃 원함</p>
              <p className="text-red-400">→ 토큰은 1시간 후까지 계속 유효</p>
              <p className="text-red-400">→ 탈취 시 대응 불가</p>
            </div>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-emerald-400 mb-2">After: Redis Blacklist</p>
            <div className="space-y-1 text-[11px] font-mono text-gray-400">
              <p>POST /v1/logout</p>
              <p>→ SHA256(token) → Redis SET (TTL: 남은 만료시간)</p>
              <p className="text-emerald-400">→ 이후 요청: middleware에서 체크</p>
              <p className="text-emerald-400">→ blacklist에 있으면 401 거부</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-300 mb-3">흐름</p>
          <div className="text-[11px] font-mono text-gray-400 space-y-1">
            <p>1. 로그아웃: <span className="text-purple-400">SET blacklist:sha256(token) "1" EX remaining_ttl</span></p>
            <p>2. API 호출: middleware → <span className="text-blue-400">EXISTS blacklist:sha256(token)</span></p>
            <p>3. 존재하면 → <span className="text-red-400">401 "token has been revoked"</span></p>
            <p>4. 토큰 만료 시 → Redis TTL로 <span className="text-emerald-400">자동 삭제 (메모리 절약)</span></p>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-3 text-[11px] text-gray-500">
          <span className="text-purple-400 font-medium">왜 SHA256?</span> JWT 토큰은 수백 바이트로 길어서, 
          Redis 키로 직접 쓰면 메모리 낭비입니다. 32바이트 해시로 줄이면서 충돌 확률은 무시 가능 수준입니다.
        </div>
      </div>
    </Card>
  )
}

function CacheInvalidationTab() {
  return (
    <Card title={
      <span className="flex items-center gap-2">
        <Zap size={14} className="text-emerald-400" />
        Cache Invalidation
      </span>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-red-400 mb-2">Before: Stale Data</p>
            <div className="space-y-1 text-[11px] font-mono text-gray-400">
              <p>1. GET /products/1 → cache SET (TTL: 5m)</p>
              <p>2. PUT /products/1 (가격 변경)</p>
              <p className="text-red-400">3. GET /products/1 → 옛날 가격 반환 (최대 5분)</p>
            </div>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-emerald-400 mb-2">After: Immediate Invalidation</p>
            <div className="space-y-1 text-[11px] font-mono text-gray-400">
              <p>1. GET /products/1 → cache SET (TTL: 5m)</p>
              <p>2. PUT /products/1 → <span className="text-emerald-400">DEL product:1</span></p>
              <p className="text-emerald-400">3. GET /products/1 → DB 조회 → 새 가격</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-400 mb-2">캐시가 무효화되는 시점</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="text-gray-500"><code className="text-blue-400">EditProduct</code> → DEL product:{'{id}'}</div>
            <div className="text-gray-500"><code className="text-blue-400">DeleteProduct</code> → DEL product:{'{id}'}</div>
            <div className="text-gray-500"><code className="text-blue-400">UpdateStock</code> → DEL product:{'{id}'}</div>
            <div className="text-gray-500"><code className="text-blue-400">AddStock</code> → DEL product:{'{id}'}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function RedisPage() {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('monitor')

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = {}
    await Promise.all(
      Object.keys(SERVICES).map(async (key) => {
        const data = await fetchRedisStats(key)
        if (data) results[key] = data
      })
    )
    setStats(results)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const tabs = [
    { id: 'monitor', label: 'Cache Monitor', icon: Activity },
    { id: 'ranking', label: 'Product Ranking', icon: TrendingUp },
    { id: 'invalidation', label: 'Cache Invalidation', icon: Zap },
    { id: 'ratelimit', label: 'Rate Limiter', icon: Shield },
    { id: 'blacklist', label: 'Token Blacklist', icon: Clock },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Redis Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">Phase 2 — 캐시 무효화, 랭킹(Sorted Set), Rate Limiting, 토큰 블랙리스트</p>
        </div>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}>
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'monitor' && <CacheMonitorTab stats={stats} />}
      {activeTab === 'ranking' && <RankingTab />}
      {activeTab === 'invalidation' && <CacheInvalidationTab />}
      {activeTab === 'ratelimit' && <RateLimiterTab />}
      {activeTab === 'blacklist' && <BlacklistTab />}
    </div>
  )
}
