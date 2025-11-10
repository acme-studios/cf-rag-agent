/**
 * Card Component
 * 
 * Container component for grouping related content.
 */

import { type ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

/**
 * Card component for content containers
 * 
 * Usage:
 * <Card padding="md" hover>
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </Card>
 */
export function Card({ 
  children, 
  className,
  padding = 'md',
  hover = false
}: CardProps) {
  const baseStyles = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg';
  
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
  
  const hoverStyles = hover ? 'transition-shadow hover:shadow-md' : '';
  
  return (
    <div className={clsx(baseStyles, paddingStyles[padding], hoverStyles, className)}>
      {children}
    </div>
  );
}
