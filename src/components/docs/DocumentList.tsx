/**
 * Document List Component
 * 
 * List of all uploaded documents with their status.
 */

import { DocumentItem } from './DocumentItem';

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

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
}

/**
 * List of documents
 * 
 * Shows all uploaded documents with their current status.
 * Empty state when no documents.
 * 
 * Usage:
 * <DocumentList 
 *   documents={documents} 
 *   onDelete={handleDelete}
 * />
 */
export function DocumentList({ documents, onDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
          No documents yet
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Upload a document to get started
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <DocumentItem
          key={doc.id}
          id={doc.id}
          filename={doc.filename}
          status={doc.status}
          currentStep={doc.currentStep}
          progress={doc.progress}
          totalChunks={doc.totalChunks}
          errorMessage={doc.errorMessage}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
