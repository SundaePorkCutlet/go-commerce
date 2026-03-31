const SERVICES = {
  userfc: { name: 'USERFC', port: 28080, prefix: '/api/userfc', color: '#3b82f6' },
  productfc: { name: 'PRODUCTFC', port: 28081, prefix: '/api/productfc', color: '#10b981' },
  orderfc: { name: 'ORDERFC', port: 28082, prefix: '/api/orderfc', color: '#f59e0b' },
  paymentfc: { name: 'PAYMENTFC', port: 28083, prefix: '/api/paymentfc', color: '#ef4444' },
}

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

export async function checkHealth(serviceKey) {
  const svc = SERVICES[serviceKey]
  const endpoints = ['/ping', '/health']
  for (const ep of endpoints) {
    try {
      const res = await fetchWithTimeout(`${svc.prefix}${ep}`)
      if (res.ok) {
        const data = await res.json()
        return { status: 'healthy', endpoint: ep, data, latency: null }
      }
    } catch {
      // try next
    }
  }
  return { status: 'unreachable', endpoint: null, data: null }
}

export async function checkAllHealth() {
  const results = {}
  await Promise.all(
    Object.keys(SERVICES).map(async (key) => {
      const start = performance.now()
      const result = await checkHealth(key)
      result.latency = Math.round(performance.now() - start)
      results[key] = result
    })
  )
  return results
}

export async function apiCall(serviceKey, path, options = {}) {
  const svc = SERVICES[serviceKey]
  const url = `${svc.prefix}${path}`
  const res = await fetchWithTimeout(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

export async function fetchMetrics(serviceKey) {
  const svc = SERVICES[serviceKey]
  try {
    const res = await fetchWithTimeout(`${svc.prefix}/metrics`)
    if (res.ok) return await res.text()
  } catch {
    // ignore
  }
  return null
}

export async function fetchDebugQueries(serviceKey) {
  const svc = SERVICES[serviceKey]
  try {
    const res = await fetchWithTimeout(`${svc.prefix}/debug/queries`)
    if (res.ok) return await res.json()
  } catch {
    // ignore
  }
  return null
}

export async function fetchRedisStats(serviceKey) {
  const svc = SERVICES[serviceKey]
  try {
    const res = await fetchWithTimeout(`${svc.prefix}/debug/redis`)
    if (res.ok) return await res.json()
  } catch {
    // ignore
  }
  return null
}

export async function fetchKafkaStats(serviceKey) {
  const svc = SERVICES[serviceKey]
  try {
    const res = await fetchWithTimeout(`${svc.prefix}/debug/kafka`)
    if (res.ok) return await res.json()
  } catch {
    // ignore
  }
  return null
}

export { SERVICES }
