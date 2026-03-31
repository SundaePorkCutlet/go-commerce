import { useState } from 'react'
import { Send, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import Card from '../components/Card'
import { SERVICES } from '../api/services'

const PRESET_REQUESTS = [
  {
    group: 'USERFC',
    requests: [
      { method: 'GET', path: '/ping', service: 'userfc', body: null, auth: false },
      {
        method: 'POST',
        path: '/v1/register',
        service: 'userfc',
        body: JSON.stringify({ name: 'test', email: 'test@test.com', password: 'password123' }, null, 2),
        auth: false,
      },
      {
        method: 'POST',
        path: '/v1/login',
        service: 'userfc',
        body: JSON.stringify({ email: 'test@test.com', password: 'password123' }, null, 2),
        auth: false,
      },
      { method: 'GET', path: '/api/v1/user-info', service: 'userfc', body: null, auth: true },
    ],
  },
  {
    group: 'PRODUCTFC',
    requests: [
      { method: 'GET', path: '/ping', service: 'productfc', body: null, auth: false },
      { method: 'GET', path: '/v1/products/search?name=', service: 'productfc', body: null, auth: false },
      { method: 'GET', path: '/v1/products/1', service: 'productfc', body: null, auth: false },
      {
        method: 'POST',
        path: '/api/v1/products',
        service: 'productfc',
        body: JSON.stringify({ name: 'Test Product', category_id: 1, price: 10000, stock: 100, description: 'A test product' }, null, 2),
        auth: true,
      },
    ],
  },
  {
    group: 'ORDERFC',
    requests: [
      { method: 'GET', path: '/ping', service: 'orderfc', body: null, auth: false },
      { method: 'GET', path: '/health', service: 'orderfc', body: null, auth: false },
      {
        method: 'POST',
        path: '/api/v1/orders',
        service: 'orderfc',
        body: JSON.stringify({
          products: [{ product_id: 1, quantity: 2 }],
          payment_method: 'BANK_TRANSFER',
          shipping_address: 'Seoul, Korea',
        }, null, 2),
        auth: true,
      },
      { method: 'GET', path: '/api/v1/orders/history', service: 'orderfc', body: null, auth: true },
    ],
  },
  {
    group: 'PAYMENTFC',
    requests: [
      { method: 'GET', path: '/ping', service: 'paymentfc', body: null, auth: false },
      { method: 'GET', path: '/health', service: 'paymentfc', body: null, auth: false },
      { method: 'GET', path: '/api/v1/failed_payments', service: 'paymentfc', body: null, auth: true },
    ],
  },
]

export default function ApiTestPage() {
  const [token, setToken] = useState('')
  const [selectedReq, setSelectedReq] = useState(null)
  const [customBody, setCustomBody] = useState('')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(
    PRESET_REQUESTS.reduce((acc, g) => ({ ...acc, [g.group]: true }), {})
  )

  const toggleGroup = (group) =>
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))

  const selectRequest = (req) => {
    setSelectedReq(req)
    setCustomBody(req.body || '')
    setResponse(null)
  }

  const sendRequest = async () => {
    if (!selectedReq) return
    setLoading(true)
    const svc = SERVICES[selectedReq.service]
    const url = `${svc.prefix}${selectedReq.path}`
    const headers = { 'Content-Type': 'application/json' }
    if (selectedReq.auth && token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const options = { method: selectedReq.method, headers }
    if (customBody && selectedReq.method !== 'GET') {
      options.body = customBody
    }

    const start = performance.now()
    try {
      const res = await fetch(url, options)
      const elapsed = Math.round(performance.now() - start)
      let data
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('json')) {
        data = await res.json()
      } else {
        data = await res.text()
      }
      setResponse({ status: res.status, elapsed, data, error: null })
    } catch (err) {
      setResponse({ status: 0, elapsed: 0, data: null, error: err.message })
    }
    setLoading(false)
  }

  const methodColor = {
    GET: 'text-emerald-400',
    POST: 'text-blue-400',
    PUT: 'text-amber-400',
    DELETE: 'text-red-400',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">API Test Panel</h1>

      <Card title="JWT Token">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste JWT token from /v1/login response"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Endpoints" className="lg:col-span-1">
          <div className="space-y-2 max-h-96 overflow-auto">
            {PRESET_REQUESTS.map((group) => (
              <div key={group.group}>
                <button
                  onClick={() => toggleGroup(group.group)}
                  className="flex items-center gap-1 w-full text-left text-xs font-semibold text-gray-400 py-1 hover:text-gray-200"
                >
                  {expandedGroups[group.group] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {group.group}
                </button>
                {expandedGroups[group.group] &&
                  group.requests.map((req, i) => (
                    <button
                      key={i}
                      onClick={() => selectRequest(req)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        selectedReq === req
                          ? 'bg-gray-800 text-gray-200'
                          : 'hover:bg-gray-800/50 text-gray-500'
                      }`}
                    >
                      <span className={`font-mono font-bold w-10 ${methodColor[req.method]}`}>
                        {req.method}
                      </span>
                      <span className="truncate">{req.path}</span>
                      {req.auth && <span className="text-amber-500 ml-auto text-[10px]">AUTH</span>}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {selectedReq && (
            <Card
              title={`${selectedReq.method} ${selectedReq.path}`}
              actions={
                <button
                  onClick={sendRequest}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white transition-colors disabled:opacity-50"
                >
                  <Send size={12} />
                  {loading ? 'Sending...' : 'Send'}
                </button>
              }
            >
              {selectedReq.method !== 'GET' && (
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-1 block">Request Body</label>
                  <textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={6}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              )}
            </Card>
          )}

          {response && (
            <Card
              title="Response"
              actions={
                <div className="flex items-center gap-3 text-xs">
                  <span className={response.status < 400 ? 'text-emerald-400' : 'text-red-400'}>
                    {response.status || 'ERR'}
                  </span>
                  <span className="text-gray-500">{response.elapsed}ms</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              }
            >
              {response.error ? (
                <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap">{response.error}</pre>
              ) : (
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-80 overflow-auto">
                  {typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data, null, 2)}
                </pre>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
