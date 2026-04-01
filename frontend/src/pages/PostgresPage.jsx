import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Database, Clock, Zap, Activity, AlertTriangle, Server, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import Card from '../components/Card'
import { SERVICES, fetchDebugQueries, apiCall } from '../api/services'

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

function PoolBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
          {value} / {max}
        </span>
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
    </div>
  )
}

function QueryTable({ queries, title, emptyMsg, highlight = false }) {
  const [expanded, setExpanded] = useState(true)
  if (!queries || queries.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-gray-500">{emptyMsg}</p>
      </div>
    )
  }
  return (
    <div>
      <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-xs text-gray-400 mb-2 hover:text-gray-200 transition-colors">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title} ({queries.length})
      </button>
      {expanded && (
        <div className="overflow-auto max-h-80">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 w-14">Time</th>
                <th className="text-left py-2 pr-3">Query</th>
                <th className="text-right py-2 pr-3 w-24">Duration</th>
                <th className="text-right py-2 pr-3 w-14">Rows</th>
                <th className="text-right py-2 w-14">Error</th>
              </tr>
            </thead>
            <tbody>
              {queries.slice(0, 50).map((q, i) => (
                <tr key={i} className={`border-b border-gray-800/50 ${highlight && q.duration_ms > 100 ? 'bg-red-950/20' : ''}`}>
                  <td className="py-1.5 pr-3 text-gray-500 font-mono whitespace-nowrap">{q.time}</td>
                  <td className="py-1.5 pr-3 text-gray-300 font-mono">
                    <div className="truncate max-w-lg" title={q.query}>{q.query}</div>
                  </td>
                  <td className={`py-1.5 pr-3 text-right font-mono whitespace-nowrap ${
                    q.duration_ms > 100 ? 'text-red-400' : q.duration_ms > 50 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>{q.duration}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-400">{q.rows}</td>
                  <td className="py-1.5 text-right">
                    {q.error ? <span className="text-red-400" title={q.error}>ERR</span> : <span className="text-gray-700">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ServiceSection({ serviceKey, data }) {
  const svc = SERVICES[serviceKey]
  const { stats, pool, slow_queries, recent } = data

  const poolData = pool ? [
    { name: 'In Use', value: pool.in_use, color: '#3b82f6' },
    { name: 'Idle', value: pool.idle, color: '#6b7280' },
    { name: 'Available', value: Math.max(0, pool.max_open_conns - pool.open_conns), color: '#1f2937' },
  ].filter(d => d.value > 0) : []

  const durationBuckets = (recent || []).reduce((acc, q) => {
    if (q.duration_ms < 1) acc[0].count++
    else if (q.duration_ms < 5) acc[1].count++
    else if (q.duration_ms < 20) acc[2].count++
    else if (q.duration_ms < 100) acc[3].count++
    else acc[4].count++
    return acc
  }, [
    { range: '<1ms', count: 0, color: '#10b981' },
    { range: '1-5ms', count: 0, color: '#22c55e' },
    { range: '5-20ms', count: 0, color: '#eab308' },
    { range: '20-100ms', count: 0, color: '#f97316' },
    { range: '>100ms', count: 0, color: '#ef4444' },
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: svc.color }} />
        <h2 className="text-lg font-semibold text-gray-200">{svc.name}</h2>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Database} label="Total Queries" value={stats?.total_queries || 0} />
        <StatCard
          icon={AlertTriangle}
          label="Slow Queries"
          value={stats?.slow_queries || 0}
          color={stats?.slow_queries > 0 ? 'text-amber-400' : 'text-gray-200'}
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={`${(stats?.avg_duration_ms || 0).toFixed(2)}ms`}
          color={stats?.avg_duration_ms > 50 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <StatCard
          icon={Zap}
          label="Max Duration"
          value={`${(stats?.max_duration_ms || 0).toFixed(2)}ms`}
          color={stats?.max_duration_ms > 100 ? 'text-red-400' : 'text-gray-200'}
        />
        <StatCard
          icon={Activity}
          label="Total Time"
          value={`${(stats?.total_duration_ms || 0).toFixed(1)}ms`}
        />
      </div>

      {/* Connection Pool + Duration Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connection Pool */}
        <Card title="Connection Pool">
          {pool ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={poolData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2}>
                        {poolData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#d1d5db' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Max Open</span><span className="text-gray-200 font-mono">{pool.max_open_conns}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Open</span><span className="text-gray-200 font-mono">{pool.open_conns}</span></div>
                  <div className="flex justify-between"><span className="text-blue-400">In Use</span><span className="text-blue-400 font-mono">{pool.in_use}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Idle</span><span className="text-gray-200 font-mono">{pool.idle}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Wait Count</span><span className={`font-mono ${pool.wait_count > 0 ? 'text-amber-400' : 'text-gray-200'}`}>{pool.wait_count}</span></div>
                </div>
              </div>
              <PoolBar label="Usage" value={pool.in_use} max={pool.max_open_conns} color="#3b82f6" />
            </div>
          ) : (
            <p className="text-xs text-gray-500">Pool stats unavailable</p>
          )}
        </Card>

        {/* Duration Distribution */}
        <Card title="Query Duration Distribution">
          {recent && recent.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={durationBuckets} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#d1d5db' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {durationBuckets.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-500">No query data yet</p>
          )}
        </Card>
      </div>

      {/* Slow Queries */}
      <Card title={
        <span className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          Slow Queries (threshold: 100ms)
        </span>
      }>
        <QueryTable queries={slow_queries} title="Slow Queries" emptyMsg="No slow queries detected — great performance!" highlight />
      </Card>

      {/* Recent Queries */}
      <Card title="Recent Queries">
        <QueryTable queries={recent} title="Recent Queries" emptyMsg="No queries recorded yet" />
      </Card>
    </div>
  )
}

function SalesReportSection({ token }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)

  const fetchReport = useCallback(async () => {
    if (!token) {
      setError('JWT 토큰이 필요합니다. 아래에서 로그인 후 토큰을 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiCall('orderfc', `/api/v1/orders/sales-report?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setReport(res.data)
      } else {
        setError(res.data?.error || `Error ${res.status}`)
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [token, days])

  return (
    <Card title={
      <span className="flex items-center gap-2">
        <BarChart3 size={14} className="text-blue-400" />
        Daily Sales Report (CTE + Window Function)
      </span>
    }>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value={7}>최근 7일</option>
            <option value={14}>최근 14일</option>
            <option value={30}>최근 30일</option>
            <option value={90}>최근 90일</option>
          </select>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            조회
          </button>
        </div>

        {!token && (
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-xs text-amber-300">
            이 API는 인증이 필요합니다. API Test 페이지에서 로그인 후 토큰을 아래에 입력하거나, ORDERFC에 주문 데이터가 있어야 합니다.
          </div>
        )}

        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-xs text-red-300">{error}</div>
        )}

        {report && Array.isArray(report) && report.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[...report].reverse()} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <XAxis dataKey="sale_date" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#d1d5db' }}
                />
                <Bar dataKey="total_revenue" name="매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 pr-3">날짜</th>
                    <th className="text-right py-2 pr-3">주문 수</th>
                    <th className="text-right py-2 pr-3">매출</th>
                    <th className="text-right py-2 pr-3">평균 주문</th>
                    <th className="text-right py-2 pr-3">판매 수량</th>
                    <th className="text-right py-2 pr-3">누적 매출</th>
                    <th className="text-right py-2">순위</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((row, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 pr-3 text-gray-300 font-mono">{row.sale_date}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">{row.order_count}</td>
                      <td className="py-1.5 pr-3 text-right text-blue-400 font-mono">{Number(row.total_revenue).toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-300 font-mono">{Number(row.avg_order_value).toLocaleString()}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-400">{row.total_items}</td>
                      <td className="py-1.5 pr-3 text-right text-emerald-400 font-mono">{Number(row.cumulative_revenue).toLocaleString()}</td>
                      <td className="py-1.5 text-right">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                          row.revenue_rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                          row.revenue_rank <= 3 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'
                        }`}>{row.revenue_rank}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {report && Array.isArray(report) && report.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">해당 기간의 주문 데이터가 없습니다.</p>
        )}

        <div className="bg-gray-800/40 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-400">SQL 기법 설명</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-500">
            <div>
              <span className="text-blue-400 font-medium">WITH ... AS (CTE)</span>
              <p>임시 테이블을 만들어 복잡한 쿼리를 단계적으로 분리</p>
            </div>
            <div>
              <span className="text-emerald-400 font-medium">SUM() OVER (ORDER BY)</span>
              <p>Window Function으로 누적 매출을 계산</p>
            </div>
            <div>
              <span className="text-amber-400 font-medium">ROW_NUMBER() OVER</span>
              <p>매출 기준으로 일별 순위를 부여</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function IndexInfoSection() {
  const indexes = [
    {
      service: 'ORDERFC',
      table: 'orders',
      indexes: [
        { name: 'idx_orders_user_status', columns: '(user_id, status)', reason: 'WHERE user_id=? AND status=? 패턴' },
        { name: 'idx_orders_status_time', columns: '(status, create_time)', reason: '상태별 + 시간순 정렬/필터' },
      ],
    },
    {
      service: 'PRODUCTFC',
      table: 'products',
      indexes: [
        { name: 'idx_products_name', columns: '(name)', reason: 'ILIKE 이름 검색' },
        { name: 'idx_products_price', columns: '(price)', reason: '가격 범위 필터 (>=, <=)' },
        { name: 'idx_products_category', columns: '(category_id)', reason: 'JOIN product_categories' },
      ],
    },
    {
      service: 'PAYMENTFC',
      table: 'payments',
      indexes: [
        { name: 'idx_payments_order', columns: '(order_id)', reason: '주문별 결제 조회' },
        { name: 'idx_payments_user', columns: '(user_id)', reason: '유저별 결제 내역' },
        { name: 'idx_payments_status_time', columns: '(status, create_time)', reason: '상태별 최신순 관리 쿼리' },
      ],
    },
  ]

  return (
    <Card title={
      <span className="flex items-center gap-2">
        <Zap size={14} className="text-emerald-400" />
        Index Strategy
      </span>
    }>
      <div className="space-y-4">
        {indexes.map((svc) => (
          <div key={svc.service}>
            <p className="text-xs font-medium text-gray-300 mb-2">{svc.service} — <span className="text-gray-500">{svc.table}</span></p>
            <div className="space-y-1.5">
              {svc.indexes.map((idx) => (
                <div key={idx.name} className="flex items-start gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                  <code className="text-[11px] text-blue-400 font-mono shrink-0">{idx.name}</code>
                  <code className="text-[11px] text-gray-400 font-mono shrink-0">{idx.columns}</code>
                  <span className="text-[11px] text-gray-500 ml-auto">{idx.reason}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="bg-gray-800/40 rounded-lg p-3 text-[11px] text-gray-500">
          <span className="text-amber-400 font-medium">원칙:</span> WHERE, JOIN, ORDER BY에 자주 등장하는 컬럼만 인덱스를 생성. 복합 인덱스는 하나의 B-Tree 탐색으로 여러 조건을 동시에 만족.
        </div>
      </div>
    </Card>
  )
}

function LockInfoSection() {
  return (
    <Card title={
      <span className="flex items-center gap-2">
        <Server size={14} className="text-purple-400" />
        FOR UPDATE — Pessimistic Lock
      </span>
    }>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-red-400 mb-2">Before: Race Condition</p>
            <div className="space-y-1 text-[11px] font-mono text-gray-400">
              <p><span className="text-blue-400">A:</span> SELECT stock → <span className="text-emerald-400">1</span></p>
              <p><span className="text-amber-400">B:</span> SELECT stock → <span className="text-emerald-400">1</span></p>
              <p><span className="text-blue-400">A:</span> UPDATE stock = 0 ✓</p>
              <p><span className="text-amber-400">B:</span> UPDATE stock = <span className="text-red-400">-1</span> ✗</p>
            </div>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
            <p className="text-xs font-medium text-emerald-400 mb-2">After: FOR UPDATE</p>
            <div className="space-y-1 text-[11px] font-mono text-gray-400">
              <p><span className="text-blue-400">A:</span> SELECT ... FOR UPDATE → lock ✅</p>
              <p><span className="text-amber-400">B:</span> SELECT ... FOR UPDATE → <span className="text-gray-500">waiting ⏳</span></p>
              <p><span className="text-blue-400">A:</span> UPDATE stock = 0, COMMIT 🔓</p>
              <p><span className="text-amber-400">B:</span> stock=0, qty=1 → <span className="text-red-400">reject</span> ❌</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-3 text-[11px] text-gray-500">
          <span className="text-purple-400 font-medium">PRODUCTFC</span>의 <code className="text-gray-400">UpdateProductStockByProductID</code>에서 사용. 
          트랜잭션 내에서 <code className="text-gray-400">SELECT ... FOR UPDATE</code>로 행을 잠그고, 재고 확인 후 차감합니다.
          충돌이 빈번한 재고 차감에는 비관적 락이 적합합니다.
        </div>
      </div>
    </Card>
  )
}

export default function PostgresPage() {
  const [queries, setQueries] = useState({})
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState(false)
  const [token, setToken] = useState('')
  const [activeTab, setActiveTab] = useState('monitor')

  const refresh = useCallback(async () => {
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
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const tabs = [
    { id: 'monitor', label: 'Live Monitor', icon: Activity },
    { id: 'report', label: 'Sales Report', icon: BarChart3 },
    { id: 'indexes', label: 'Index Strategy', icon: Zap },
    { id: 'locks', label: 'Pessimistic Lock', icon: Server },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">PostgreSQL Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">Phase 1 — 쿼리 관측, 커넥션 풀, 인덱스, 비관적 락, CTE 리포트</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-800 text-gray-100'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'monitor' && (
        available ? (
          <div className="space-y-8">
            {Object.entries(queries).map(([key, data]) => (
              <ServiceSection key={key} serviceKey={key} data={data} />
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-12">
              <Database size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 mb-1">백엔드 서비스가 실행 중이 아닙니다</p>
              <p className="text-xs text-gray-500">서비스를 시작하면 실시간 쿼리 모니터링 데이터가 표시됩니다.</p>
              <p className="text-xs text-gray-600 mt-3 font-mono">docker compose up -d</p>
            </div>
          </Card>
        )
      )}

      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <label className="text-xs text-gray-400 block mb-1.5">JWT Token (ORDERFC 인증)</label>
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <SalesReportSection token={token} />
        </div>
      )}

      {activeTab === 'indexes' && <IndexInfoSection />}

      {activeTab === 'locks' && <LockInfoSection />}
    </div>
  )
}
