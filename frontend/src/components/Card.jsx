export default function Card({ title, children, className = '', actions }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
