/**
 * Navbar Component
 * 
 * Top navigation bar with branding, session info, and theme toggle.
 */

import { Moon, Sun } from '@phosphor-icons/react';
import { Badge } from '../ui/Badge';

interface NavbarProps {
  sessionId: string;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

/**
 * Navigation bar component
 * 
 * Displays:
 * - App branding
 * - Session ID (truncated)
 * - Theme toggle button
 * 
 * Usage:
 * <Navbar 
 *   sessionId={sessionId} 
 *   theme={theme} 
 *   onThemeToggle={toggleTheme}
 * />
 */
export function Navbar({ sessionId, theme, onThemeToggle }: NavbarProps) {
  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-full mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Left: Branding */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-linear-to-r from-slate-700 to-slate-900 dark:from-slate-300 dark:to-slate-100 bg-clip-text text-transparent">
              RAG Agent
            </h1>
            <Badge variant="info" size="sm">Beta</Badge>
          </div>
          
          {/* Right: Session + Theme */}
          <div className="flex items-center gap-4">
            {/* Session ID */}
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Session:</span>
              <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                {sessionId.slice(0, 12)}...
              </code>
            </div>
            
            {/* Theme Toggle */}
            <button
              onClick={onThemeToggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun size={20} weight="fill" className="text-yellow-500" />
              ) : (
                <Moon size={20} weight="fill" className="text-gray-700" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
