/**
 * Two Column Layout Component
 * 
 * Main layout with documents panel (left) and chat panel (right).
 * Responsive design with mobile support.
 */

import { type ReactNode } from 'react';

interface TwoColumnLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
}

/**
 * Two-column layout for docs + chat
 * 
 * Layout:
 * - Left: 20% width (documents management)
 * - Right: 80% width (chat interface)
 * - Mobile: Stacked layout
 * 
 * Usage:
 * <TwoColumnLayout
 *   leftColumn={<DocumentsPanel />}
 *   rightColumn={<ChatPanel />}
 * />
 */
export function TwoColumnLayout({ leftColumn, rightColumn }: TwoColumnLayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Left Column - Documents (20%) */}
      <div className="w-full lg:w-1/5 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
        <div className="p-4 lg:p-6">
          {leftColumn}
        </div>
      </div>
      
      {/* Right Column - Chat (80%) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        {rightColumn}
      </div>
    </div>
  );
}
