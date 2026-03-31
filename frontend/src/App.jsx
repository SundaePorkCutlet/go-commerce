import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PostgresPage from './pages/PostgresPage'
import RedisPage from './pages/RedisPage'
import KafkaPage from './pages/KafkaPage'
import MongoPage from './pages/MongoPage'
import MetricsPage from './pages/MetricsPage'
import ApiTestPage from './pages/ApiTestPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="postgres" element={<PostgresPage />} />
        <Route path="redis" element={<RedisPage />} />
        <Route path="kafka" element={<KafkaPage />} />
        <Route path="mongo" element={<MongoPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="api-test" element={<ApiTestPage />} />
      </Route>
    </Routes>
  )
}
