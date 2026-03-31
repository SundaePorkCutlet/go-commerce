import { Construction } from 'lucide-react'

export default function EmptyState({ phase, title, description, items = [] }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
        <Construction size={24} className="text-gray-500" />
      </div>
      <p className="text-xs text-blue-400 font-medium mb-1">Phase {phase}</p>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>
      {items.length > 0 && (
        <div className="text-left bg-gray-800/50 rounded-lg p-4 max-w-sm w-full">
          <p className="text-xs text-gray-400 mb-2 font-medium">구현 예정:</p>
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                <span className="text-gray-600 mt-0.5">&#9679;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
