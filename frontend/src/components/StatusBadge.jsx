export default function StatusBadge({ status }) {
  const styles = {
    healthy: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    unreachable: 'bg-red-400/10 text-red-400 border-red-400/20',
    checking: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
        styles[status] || styles.checking
      }`}
    >
      {status}
    </span>
  )
}
