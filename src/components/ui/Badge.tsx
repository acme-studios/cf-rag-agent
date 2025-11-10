/**
 * Badge Component
 * 
 * Small label for status indicators, tags, and counts.
 */

import { type ReactNode } from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}

/**
 * Badge component for status indicators
 * 
 * Variants:
 * - default: Gray badge
 * - success: Green badge (ready, complete)
 * - warning: Yellow badge (processing, pending)
 * - error: Red badge (failed, error)
 * - info: Blue badge (information)
 * 
 * Usage:
 * <Badge variant="success">Ready</Badge>
 */
export function Badge({ 
  variant = 'default', 
  size = 'md',
  children, 
  className 
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full';
  
  const variantStyles = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  };
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  };
  
  return (
    <span className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}>
      {children}
    </span>
  );
}
