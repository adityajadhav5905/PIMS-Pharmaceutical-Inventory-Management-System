import { X } from 'lucide-react';

/**
 * Modal overlay with blurred backdrop (not solid black).
 * Renders above the full page including sidebar.
 */
export default function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm dark:bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl dark:bg-gray-800`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
