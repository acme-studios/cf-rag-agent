/**
 * Alert Component
 * 
 * Display error messages, warnings, and informational messages.
 * Beautiful, accessible, and dismissible.
 */

import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import { X, Info, CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Alert component for messages
 * 
 * Variants:
 * - info: Blue (informational messages)
 * - success: Green (success messages)
 * - warning: Yellow (warnings)
 * - error: Red (errors)
 * 
 * Usage:
 * <Alert variant="error" title="Upload Failed">
 *   The file could not be processed. Please try again.
 * </Alert>
 */
export function Alert({ 
  variant = 'info', 
  title, 
  children, 
  onDismiss,
  className 
}: AlertProps) {
  const baseStyles = 'rounded-lg p-4 border';
  
  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
    success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
    error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
  };
  
  const icons = {
    info: Info,
    success: CheckCircle,
    warning: WarningCircle,
    error: XCircle
  };
  
  const Icon = icons[variant];
  
  return (
    <div className={clsx(baseStyles, variantStyles[variant], className)}>
      <div className="flex items-start gap-3">
        <Icon size={20} weight="fill" className="shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-semibold mb-1">{title}</h4>
          )}
          <div className="text-sm">{children}</div>
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
