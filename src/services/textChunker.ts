/**
 * Text Chunking Service
 * 
 * Splits large text documents into smaller, manageable chunks for:
 * - Better embedding quality (embeddings work best on focused text)
 * - Efficient vector search (retrieve only relevant sections)
 * - Token limit compliance (LLMs have context limits)
 * 
 * Uses LangChain's RecursiveCharacterTextSplitter which:
 * - Tries to keep paragraphs together
 * - Falls back to sentences, then words if needed
 * - Maintains context with overlapping chunks
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * A single text chunk with metadata
 */
export interface TextChunk {
  text: string;           // The chunk text content
  index: number;          // Position in the document (0, 1, 2, ...)
  startChar?: number;     // Character position where chunk starts
  endChar?: number;       // Character position where chunk ends
}

/**
 * Configuration for text chunking
 */
export interface ChunkingConfig {
  chunkSize: number;      // Maximum characters per chunk
  chunkOverlap: number;   // Characters to overlap between chunks
}

/**
 * Default chunking configuration
 * 
 * chunkSize: 1000 characters
 * - Good balance between context and specificity
 * - Works well with most embedding models
 * - Fits within typical token limits
 * 
 * chunkOverlap: 200 characters
 * - Ensures context continuity between chunks
 * - Helps with queries that span chunk boundaries
 * - About 20% overlap is a good rule of thumb
 */
const DEFAULT_CONFIG: ChunkingConfig = {
  chunkSize: 1000,
  chunkOverlap: 200
};

/**
 * Split text into chunks using LangChain's RecursiveCharacterTextSplitter
 * 
 * How it works:
 * 1. Create splitter with configured chunk size and overlap
 * 2. Split text recursively (tries paragraphs, then sentences, then words)
 * 3. Add metadata to each chunk (index, position)
 * 4. Return array of chunks
 * 
 * Example:
 * Input: "This is a long document..." (5000 chars)
 * Output: [
 *   { text: "This is a long...", index: 0, startChar: 0, endChar: 1000 },
 *   { text: "...document continues...", index: 1, startChar: 800, endChar: 1800 },
 *   ...
 * ]
 * 
 * @param text - The text to chunk
 * @param config - Optional chunking configuration
 * @returns Array of text chunks with metadata
 */
export async function chunkText(
  text: string,
  config: Partial<ChunkingConfig> = {}
): Promise<TextChunk[]> {
  console.log('[CHUNK] Starting text chunking');
  console.log('[CHUNK] Input text length:', text.length, 'characters');
  
  // Merge config with defaults
  const finalConfig: ChunkingConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  console.log('[CHUNK] Chunk size:', finalConfig.chunkSize);
  console.log('[CHUNK] Chunk overlap:', finalConfig.chunkOverlap);
  
  try {
    // Create the text splitter
    // RecursiveCharacterTextSplitter tries to split on:
    // 1. Double newlines (paragraphs)
    // 2. Single newlines (lines)
    // 3. Spaces (words)
    // 4. Characters (as last resort)
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: finalConfig.chunkSize,
      chunkOverlap: finalConfig.chunkOverlap,
      lengthFunction: (text: string) => text.length,
      separators: ['\n\n', '\n', ' ', '']
    });
    
    // Split the text into documents
    // LangChain returns Document objects with pageContent
    const documents = await splitter.createDocuments([text]);
    
    console.log('[CHUNK] Created', documents.length, 'chunks');
    
    // Convert LangChain documents to our TextChunk format
    // Track character positions for reference
    let currentPosition = 0;
    const chunks: TextChunk[] = documents.map((doc, index) => {
      const chunkText = doc.pageContent;
      const startChar = currentPosition;
      const endChar = currentPosition + chunkText.length;
      
      // Move position forward, accounting for overlap
      // We subtract overlap to get approximate position
      currentPosition = endChar - finalConfig.chunkOverlap;
      
      console.log(`[CHUNK] Chunk ${index}: ${chunkText.length} chars (${startChar}-${endChar})`);
      
      return {
        text: chunkText,
        index,
        startChar,
        endChar
      };
    });
    
    console.log('[CHUNK] Chunking complete');
    console.log('[CHUNK] Total chunks:', chunks.length);
    console.log('[CHUNK] Average chunk size:', Math.round(text.length / chunks.length), 'chars');
    
    return chunks;
    
  } catch (error) {
    console.error('[CHUNK] Error during text chunking:', error);
    throw new Error(`Failed to chunk text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate estimated number of chunks for a given text
 * Useful for progress estimation
 * 
 * @param textLength - Length of text in characters
 * @param config - Optional chunking configuration
 * @returns Estimated number of chunks
 */
export function estimateChunkCount(
  textLength: number,
  config: Partial<ChunkingConfig> = {}
): number {
  const finalConfig: ChunkingConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  // Formula: (textLength / (chunkSize - overlap)) rounded up
  // We subtract overlap because chunks overlap
  const effectiveChunkSize = finalConfig.chunkSize - finalConfig.chunkOverlap;
  return Math.ceil(textLength / effectiveChunkSize);
}

/**
 * Validate chunking configuration
 * Ensures chunk size and overlap are reasonable
 * 
 * @param config - Configuration to validate
 * @returns true if valid, throws error if invalid
 */
export function validateChunkingConfig(config: ChunkingConfig): boolean {
  if (config.chunkSize <= 0) {
    throw new Error('Chunk size must be greater than 0');
  }
  
  if (config.chunkOverlap < 0) {
    throw new Error('Chunk overlap cannot be negative');
  }
  
  if (config.chunkOverlap >= config.chunkSize) {
    throw new Error('Chunk overlap must be less than chunk size');
  }
  
  if (config.chunkSize < 100) {
    console.warn('[CHUNK] Warning: Very small chunk size may result in poor context');
  }
  
  if (config.chunkSize > 5000) {
    console.warn('[CHUNK] Warning: Very large chunk size may exceed embedding model limits');
  }
  
  return true;
}
