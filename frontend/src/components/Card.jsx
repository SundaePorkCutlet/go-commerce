export default function Card({ title, children, className = '', actions }) {
  return (
    <div className={`rounded-lg border border-stone-800 bg-[#171410] ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-stone-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-200">{title}</h2>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
