/**
 * Document Item Component
 * 
 * Individual document card showing status, progress, and actions.
 */

import { File, Trash } from '@phosphor-icons/react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressLoader } from './ProgressLoader';

type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'error';
type ProcessingStep = 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';

interface DocumentItemProps {
  id: string;
  filename: string;
  status: ProcessingStatus;
  currentStep?: ProcessingStep;
  progress?: number;
  totalChunks?: number;
  errorMessage?: string;
  onDelete: (id: string) => void;
}

/**
 * Document item card
 * 
 * Shows:
 * - Filename with icon
 * - Status badge
 * - Progress loader (if processing)
 * - Error message (if failed)
 * - Delete button (if ready)
 * 
 * Usage:
 * <DocumentItem
 *   id="doc-123"
 *   filename="report.pdf"
 *   status="processing"
 *   currentStep="extracting"
 *   progress={30}
 *   onDelete={handleDelete}
 * />
 */
export function DocumentItem({
  id,
  filename,
  status,
  currentStep,
  progress,
  totalChunks,
  errorMessage,
  onDelete
}: DocumentItemProps) {
  const getStatusBadge = () => {
    switch (status) {
      case 'uploading':
        return <Badge variant="info">Uploading</Badge>;
      case 'processing':
        return <Badge variant="warning">Processing</Badge>;
      case 'ready':
        return <Badge variant="success">Ready</Badge>;
      case 'error':
        return <Badge variant="error">Failed</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <Card padding="md" hover={status === 'ready'} className="transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <File size={20} className="shrink-0 text-blue-500" weight="fill" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
              {filename}
            </h3>
            {totalChunks !== undefined && status === 'ready' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {totalChunks} chunks indexed
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {getStatusBadge()}
          {status === 'ready' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(id)}
              leftIcon={<Trash size={16} />}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label="Delete document"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
      
      {/* Progress Loader */}
      {status === 'processing' && currentStep && (
        <ProgressLoader currentStep={currentStep} progress={progress} />
      )}
      
      {/* Error Message */}
      {status === 'error' && errorMessage && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          <p className="font-medium mb-1">Processing failed</p>
          <p className="text-xs">{errorMessage}</p>
        </div>
      )}
    </Card>
  );
}
