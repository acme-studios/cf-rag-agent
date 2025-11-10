/**
 * Upload Area Component
 * 
 * Drag-and-drop file upload zone with file validation.
 * Beautiful, accessible, and user-friendly.
 */

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { UploadSimple, FilePdf, FileDoc } from '@phosphor-icons/react';
import { clsx } from 'clsx';
import { Alert } from '../ui/Alert';

interface UploadAreaProps {
  onUpload: (file: File) => void;
  isUploading?: boolean;
  maxSizeMB?: number;
}

/**
 * Drag-and-drop upload area
 * 
 * Features:
 * - Drag and drop support
 * - Click to browse
 * - File type validation (PDF, DOCX)
 * - File size validation
 * - Beautiful hover states
 * - Error messages
 * 
 * Usage:
 * <UploadArea 
 *   onUpload={handleFileUpload} 
 *   isUploading={uploading}
 *   maxSizeMB={10}
 * />
 */
export function UploadArea({ 
  onUpload, 
  isUploading = false,
  maxSizeMB = 10
}: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const MAX_SIZE_BYTES = maxSizeMB * 1024 * 1024;
  
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PDF and DOCX files are supported';
    }
    
    // Check file size
    if (file.size > MAX_SIZE_BYTES) {
      return `File size must be less than ${maxSizeMB}MB`;
    }
    
    return null;
  };
  
  const handleFile = (file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    onUpload(file);
  };
  
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isUploading) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isUploading) {
      setIsDragging(true);
    }
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };
  
  return (
    <div className="space-y-3">
      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={clsx(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer',
          isDragging && !isUploading && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105',
          !isDragging && !isUploading && 'border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
          isUploading && 'border-gray-300 dark:border-gray-700 opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileInput}
          disabled={isUploading}
          className="hidden"
          aria-label="Upload file"
        />
        
        <div className="flex flex-col items-center gap-3">
          {/* Icon */}
          <div className={clsx(
            'p-3 rounded-full transition-colors',
            isDragging ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
          )}>
            <UploadSimple 
              size={32} 
              weight="bold"
              className={clsx(
                'transition-colors',
                isDragging ? 'text-blue-600' : 'text-gray-400'
              )}
            />
          </div>
          
          {/* Text */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              {isDragging ? 'Drop file here' : 'Drop file or click to browse'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PDF or DOCX • Max {maxSizeMB}MB
            </p>
          </div>
          
          {/* Supported Files */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <FilePdf size={16} weight="fill" className="text-red-500" />
              <span>PDF</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <FileDoc size={16} weight="fill" className="text-blue-500" />
              <span>DOCX</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
    </div>
  );
}
