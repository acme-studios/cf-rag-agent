/**
 * Documents Panel Component
 * 
 * Complete left panel with upload area and document list.
 */

import { UploadArea } from './UploadArea';
import { DocumentList } from './DocumentList';

type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'error';
type ProcessingStep = 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';

interface Document {
  id: string;
  filename: string;
  status: ProcessingStatus;
  currentStep?: ProcessingStep;
  progress?: number;
  totalChunks?: number;
  errorMessage?: string;
}

interface DocumentsPanelProps {
  documents: Document[];
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  isUploading?: boolean;
}

/**
 * Documents management panel
 * 
 * Contains:
 * - Upload area (drag & drop)
 * - Document list with status
 * 
 * Usage:
 * <DocumentsPanel
 *   documents={documents}
 *   onUpload={handleUpload}
 *   onDelete={handleDelete}
 *   isUploading={uploading}
 * />
 */
export function DocumentsPanel({
  documents,
  onUpload,
  onDelete,
  isUploading
}: DocumentsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Documents
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Upload and manage your documents
        </p>
      </div>
      
      {/* Upload Area */}
      <UploadArea 
        onUpload={onUpload} 
        isUploading={isUploading}
        maxSizeMB={10}
      />
      
      {/* Document List */}
      {documents.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Your Documents ({documents.length})
          </h3>
          <DocumentList documents={documents} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
