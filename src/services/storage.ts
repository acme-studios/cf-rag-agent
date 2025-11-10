/**
 * Storage Service
 * 
 * Handles storage of document chunks and embeddings across:
 * - D1 Database: Text content and metadata
 * - Vectorize: Vector embeddings for semantic search
 * 
 * This service ensures data consistency between both storage systems.
 */

import type { TextChunk } from './textChunker';

/**
 * Store document chunks and embeddings
 * 
 * How it works:
 * 1. Insert each chunk into D1 database (get auto-generated ID)
 * 2. Insert corresponding embedding into Vectorize (using same ID)
 * 3. Update document status to 'ready'
 * 
 * This ensures:
 * - Text and embeddings are linked by ID
 * - We can retrieve full text after vector search
 * - Metadata is preserved (document ID, session ID, etc.)
 * 
 * @param documentId - Unique document identifier
 * @param sessionId - Session identifier for isolation
 * @param filename - Original filename
 * @param chunks - Array of text chunks
 * @param embeddings - Array of embedding vectors (must match chunks length)
 * @param db - D1 database binding
 * @param vectorIndex - Vectorize index binding
 */
export async function storeDocumentChunks(
  documentId: string,
  sessionId: string,
  filename: string,
  chunks: TextChunk[],
  embeddings: number[][],
  db: D1Database,
  vectorIndex: VectorizeIndex
): Promise<void> {
  console.log('[STORAGE] Starting storage process');
  console.log('[STORAGE] Document ID:', documentId);
  console.log('[STORAGE] Session ID:', sessionId);
  console.log('[STORAGE] Chunks to store:', chunks.length);
  
  // Validate inputs
  if (chunks.length !== embeddings.length) {
    throw new Error(`Chunk count (${chunks.length}) does not match embedding count (${embeddings.length})`);
  }
  
  if (chunks.length === 0) {
    console.warn('[STORAGE] No chunks to store');
    return;
  }
  
  try {
    // Prepare Vectorize vectors
    // Each vector needs: id, values (embedding), metadata
    const vectorizeVectors: VectorizeVector[] = [];
    
    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      
      console.log(`[STORAGE] Processing chunk ${i + 1}/${chunks.length}`);
      
      // Insert chunk into D1 database
      // This returns the auto-generated chunk ID
      const result = await db.prepare(`
        INSERT INTO document_chunks (
          session_id,
          document_id,
          chunk_index,
          text,
          page_number,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        sessionId,
        documentId,
        chunk.index,
        chunk.text,
        null, // page_number (we'll add this later if needed)
        Date.now()
      ).run();
      
      // Get the auto-generated chunk ID
      // This is crucial for linking D1 and Vectorize
      const chunkId = result.meta.last_row_id;
      
      if (!chunkId) {
        throw new Error(`Failed to get chunk ID for chunk ${i}`);
      }
      
      console.log(`[STORAGE] Chunk ${i + 1} stored in D1 with ID:`, chunkId);
      
      // Prepare vector for Vectorize
      // Metadata includes document info for filtering
      vectorizeVectors.push({
        id: chunkId.toString(),
        values: embedding,
        metadata: {
          documentId,
          sessionId,
          filename,
          chunkIndex: chunk.index,
          text: chunk.text.substring(0, 200) // Store preview for debugging
        }
      });
    }
    
    // Batch insert into Vectorize
    // This is more efficient than inserting one at a time
    console.log('[STORAGE] Inserting', vectorizeVectors.length, 'vectors into Vectorize');
    
    const vectorizeResult = await vectorIndex.upsert(vectorizeVectors);
    
    console.log('[STORAGE] Vectorize insert complete');
    console.log('[STORAGE] Vectors inserted:', vectorizeResult.count);
    
    // Update document status to 'ready'
    await db.prepare(`
      UPDATE documents
      SET processing_status = 'ready',
          total_chunks = ?
      WHERE id = ? AND session_id = ?
    `).bind(chunks.length, documentId, sessionId).run();
    
    console.log('[STORAGE] Document status updated to ready');
    console.log('[STORAGE] Storage complete');
    
  } catch (error) {
    console.error('[STORAGE] Error during storage:', error);
    
    // Update document status to 'error'
    try {
      await db.prepare(`
        UPDATE documents
        SET processing_status = 'error',
            metadata = ?
        WHERE id = ? AND session_id = ?
      `).bind(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        documentId,
        sessionId
      ).run();
    } catch (updateError) {
      console.error('[STORAGE] Failed to update error status:', updateError);
    }
    
    throw new Error(`Failed to store document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete document chunks from both D1 and Vectorize
 * 
 * How it works:
 * 1. Get all chunk IDs for the document from D1
 * 2. Delete from Vectorize using those IDs
 * 3. Delete from D1 (cascades to chunks via foreign key)
 * 
 * @param documentId - Document to delete
 * @param sessionId - Session identifier for security
 * @param db - D1 database binding
 * @param vectorIndex - Vectorize index binding
 */
export async function deleteDocumentChunks(
  documentId: string,
  sessionId: string,
  db: D1Database,
  vectorIndex: VectorizeIndex
): Promise<void> {
  console.log('[STORAGE] Starting deletion process');
  console.log('[STORAGE] Document ID:', documentId);
  console.log('[STORAGE] Session ID:', sessionId);
  
  try {
    // Get all chunk IDs for this document
    const chunks = await db.prepare(`
      SELECT id FROM document_chunks
      WHERE document_id = ? AND session_id = ?
    `).bind(documentId, sessionId).all();
    
    console.log('[STORAGE] Found', chunks.results.length, 'chunks to delete');
    
    if (chunks.results.length > 0) {
      // Delete from Vectorize
      // Convert chunk IDs to strings (Vectorize uses string IDs)
      const vectorIds = chunks.results.map((row: any) => row.id.toString());
      
      console.log('[STORAGE] Deleting vectors from Vectorize');
      await vectorIndex.deleteByIds(vectorIds);
      console.log('[STORAGE] Vectors deleted from Vectorize');
    }
    
    // Delete from D1
    // This will cascade delete chunks due to foreign key constraint
    await db.prepare(`
      DELETE FROM documents
      WHERE id = ? AND session_id = ?
    `).bind(documentId, sessionId).run();
    
    console.log('[STORAGE] Document deleted from D1');
    console.log('[STORAGE] Deletion complete');
    
  } catch (error) {
    console.error('[STORAGE] Error during deletion:', error);
    throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create initial document record in D1
 * Called when upload begins, before processing
 * 
 * @param documentId - Unique document identifier
 * @param sessionId - Session identifier
 * @param filename - Original filename
 * @param r2Key - R2 storage key
 * @param fileSize - File size in bytes
 * @param fileType - MIME type
 * @param db - D1 database binding
 */
export async function createDocumentRecord(
  documentId: string,
  sessionId: string,
  filename: string,
  r2Key: string,
  fileSize: number,
  fileType: string,
  db: D1Database
): Promise<void> {
  console.log('[STORAGE] Creating document record');
  console.log('[STORAGE] Document ID:', documentId);
  console.log('[STORAGE] Filename:', filename);
  
  try {
    await db.prepare(`
      INSERT INTO documents (
        id,
        session_id,
        filename,
        r2_key,
        upload_timestamp,
        processing_status,
        file_size,
        file_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      documentId,
      sessionId,
      filename,
      r2Key,
      Date.now(),
      'processing',
      fileSize,
      fileType
    ).run();
    
    console.log('[STORAGE] Document record created');
    
  } catch (error) {
    console.error('[STORAGE] Error creating document record:', error);
    throw new Error(`Failed to create document record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update document processing status
 * Used to track progress during workflow execution
 * 
 * @param documentId - Document identifier
 * @param sessionId - Session identifier
 * @param status - New status
 * @param metadata - Optional metadata (progress, errors, etc.)
 * @param db - D1 database binding
 */
export async function updateDocumentStatus(
  documentId: string,
  sessionId: string,
  status: 'pending' | 'processing' | 'ready' | 'error',
  metadata: Record<string, unknown> | null,
  db: D1Database
): Promise<void> {
  console.log('[STORAGE] Updating document status');
  console.log('[STORAGE] Document ID:', documentId);
  console.log('[STORAGE] New status:', status);
  
  try {
    await db.prepare(`
      UPDATE documents
      SET processing_status = ?,
          metadata = ?
      WHERE id = ? AND session_id = ?
    `).bind(
      status,
      metadata ? JSON.stringify(metadata) : null,
      documentId,
      sessionId
    ).run();
    
    console.log('[STORAGE] Document status updated');
    
  } catch (error) {
    console.error('[STORAGE] Error updating document status:', error);
    throw new Error(`Failed to update document status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get document by ID
 * 
 * @param documentId - Document identifier
 * @param sessionId - Session identifier
 * @param db - D1 database binding
 * @returns Document record or null if not found
 */
export async function getDocument(
  documentId: string,
  sessionId: string,
  db: D1Database
): Promise<any | null> {
  const result = await db.prepare(`
    SELECT * FROM documents
    WHERE id = ? AND session_id = ?
  `).bind(documentId, sessionId).first();
  
  return result;
}

/**
 * List all documents for a session
 * 
 * @param sessionId - Session identifier
 * @param db - D1 database binding
 * @returns Array of document records
 */
export async function listDocuments(
  sessionId: string,
  db: D1Database
): Promise<any[]> {
  const result = await db.prepare(`
    SELECT * FROM documents
    WHERE session_id = ?
    ORDER BY upload_timestamp DESC
  `).bind(sessionId).all();
  
  return result.results;
}
