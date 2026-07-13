export default function Help() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Help & Support</h1>
        <p className="text-gray-600 dark:text-gray-400">Find answers and get support</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* FAQ */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'How to add new medicine?', a: 'Go to Inventory page and click "Add Medicine" button' },
              { q: 'How to check alerts?', a: 'Navigate to Alerts page to view all active alerts' },
              { q: 'How to add staff?', a: 'Use Staff page and click "Add Staff" to add new members' },
              { q: 'How to record a sale?', a: 'Go to Sell Stock page, select batch and quantity' },
              { q: 'How to export data?', a: 'Use Export Data page to download CSV files' },
            ].map((item, idx) => (
              <details key={idx} className="border border-gray-200 rounded-lg p-4 dark:border-gray-700">
                <summary className="font-medium text-gray-900 cursor-pointer dark:text-gray-200">{item.q}</summary>
                <p className="text-gray-600 mt-2 text-sm dark:text-gray-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Contact Support</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Subject</label>
              <input
                type="text"
                placeholder="How can we help?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Message</label>
              <textarea
                rows="4"
                placeholder="Describe your issue..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 dark:bg-blue-950/20 dark:border-blue-900">
        <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Documentation</h2>
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {[
            'Getting Started',
            'Inventory Management',
            'Alert System',
            'Staff Management',
            'Financial Reports',
            'CSV Export',
          ].map((doc) => (
            <li key={doc}>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300">
                {doc} →
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
