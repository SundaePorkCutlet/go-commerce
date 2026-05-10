export default function Card({ title, children, className = '', actions }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/[0.035] ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
