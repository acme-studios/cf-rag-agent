/**
 * Text Extraction Service
 * 
 * Extracts text content from various document formats:
 * - PDF files (using unpdf)
 * - DOCX files (using mammoth)
 * 
 * Returns extracted text along with metadata like page count
 */

import { extractText as extractPdfText } from 'unpdf';
import * as mammoth from 'mammoth';

/**
 * Result of text extraction
 */
export interface ExtractedText {
  text: string;           // The extracted text content
  pageCount?: number;     // Number of pages (for PDFs)
  metadata?: {
    title?: string;
    author?: string;
    [key: string]: unknown;
  };
}

/**
 * Extract text from a PDF or DOCX file
 * 
 * How it works:
 * 1. Check the file type (MIME type)
 * 2. Use appropriate parser (pdf-parse or mammoth)
 * 3. Extract text and metadata
 * 4. Return structured result
 * 
 * @param buffer - File content as ArrayBuffer
 * @param fileType - MIME type of the file
 * @returns Extracted text and metadata
 */
export async function extractText(
  buffer: ArrayBuffer,
  fileType: string
): Promise<ExtractedText> {
  console.log('[EXTRACT] Starting text extraction');
  console.log('[EXTRACT] File type:', fileType);
  console.log('[EXTRACT] Buffer size:', buffer.byteLength, 'bytes');
  
  try {
    // Handle PDF files
    if (fileType === 'application/pdf' || fileType.includes('pdf')) {
      console.log('[EXTRACT] Processing as PDF');
      
      // Extract text using unpdf (works in Workers)
      const { text, totalPages } = await extractPdfText(buffer, {
        mergePages: true
      });
      
      console.log('[EXTRACT] PDF parsed successfully');
      console.log('[EXTRACT] Pages:', totalPages);
      console.log('[EXTRACT] Text length:', text.length, 'characters');
      
      return {
        text,
        pageCount: totalPages,
        metadata: {}
      };
    }
    
    // Handle DOCX files
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType.includes('wordprocessingml') ||
      fileType.includes('docx')
    ) {
      console.log('[EXTRACT] Processing as DOCX');
      
      // Convert ArrayBuffer to Buffer
      const nodeBuffer = Buffer.from(buffer);
      
      // Extract raw text from DOCX
      // mammoth is a CommonJS module, need to access default export
      const mammothLib = (mammoth as any).default || mammoth;
      const result = await mammothLib.extractRawText({ buffer: nodeBuffer });
      
      console.log('[EXTRACT] DOCX parsed successfully');
      console.log('[EXTRACT] Text length:', result.value.length, 'characters');
      
      // Check for conversion warnings
      if (result.messages.length > 0) {
        console.log('[EXTRACT] Conversion warnings:', result.messages.length);
        result.messages.forEach((msg: any) => {
          console.log('[EXTRACT] Warning:', msg.message);
        });
      }
      
      return {
        text: result.value,
        metadata: {}
      };
    }
    
    // Unsupported file type
    console.error('[EXTRACT] Unsupported file type:', fileType);
    throw new Error(`Unsupported file type: ${fileType}. Only PDF and DOCX are supported.`);
    
  } catch (error) {
    console.error('[EXTRACT] Error during text extraction:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate if a file type is supported
 * 
 * @param fileType - MIME type to check
 * @returns true if supported, false otherwise
 */
export function isSupportedFileType(fileType: string): boolean {
  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  return supportedTypes.some(type => fileType.includes(type)) ||
         fileType.includes('pdf') ||
         fileType.includes('docx') ||
         fileType.includes('wordprocessingml');
}

/**
 * Get human-readable file type name
 * 
 * @param fileType - MIME type
 * @returns Human-readable name (e.g., "PDF", "DOCX")
 */
export function getFileTypeName(fileType: string): string {
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('docx') || fileType.includes('wordprocessingml')) return 'DOCX';
  return 'Unknown';
}
