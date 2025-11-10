/**
 * Footer Component
 * 
 * Bottom footer with links and attribution.
 */

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <span className="font-semibold text-orange-500">Cloudflare</span>
          </div>
          
          <div className="flex gap-4">
            <a 
              href="https://developers.cloudflare.com/agents" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Docs
            </a>
            <a 
              href="https://github.com/cloudflare" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
