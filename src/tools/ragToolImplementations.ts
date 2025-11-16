/**
 * RAG Tool Implementations
 * 
 * Direct implementations without Vercel AI SDK wrappers
 * These are called manually after the model decides which tool to use
 */

import type { Chat } from '../server';

// Type definitions for tool arguments and results
export type SearchDocumentsArgs = {
  query: string;
  topK?: number;
};

export type ListDocumentsResult = {
  success: boolean;
  documents: Array<{
    id: string;
    filename: string;
    status: string;
    uploadedAt: number;
    totalChunks?: number;
  }>;
};

export type DeleteDocumentArgs = {
  documentId: string;
};

/**
 * Search through uploaded documents using semantic search
 */
export async function searchDocuments(
  args: SearchDocumentsArgs,
  agent: Chat
): Promise<string> {
  console.log('[TOOL] ========================================');
  console.log('[TOOL] search_documents called');
  console.log('[TOOL] Query:', args.query);
  console.log('[TOOL] topK:', args.topK || 5);

  try {
    const env = agent.getEnv();
    const sessionId = agent.state.sessionId;
    // Ensure topK is a number (LLM might pass it as string)
    const topK = typeof args.topK === 'string' ? parseInt(args.topK, 10) : (args.topK || 5);

    console.log('[TOOL] Session ID:', sessionId);

    if (!sessionId) {
      console.error('[TOOL] No active session');
      return 'Error: No active session. Please refresh the page.';
    }

    // Step 1: Generate embedding for the query
    console.log('[TOOL] Generating query embedding...');
    const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [args.query]
    }) as { data: number[][] };

    if (!queryEmbedding?.data?.[0]) {
      throw new Error('Failed to generate query embedding');
    }

    console.log('[TOOL] Query embedding generated successfully');
    console.log('[TOOL] Embedding dimensions:', queryEmbedding.data[0].length);

    // Step 2: Search Vectorize for similar chunks
    // Using namespace for session isolation (more reliable than metadata filtering)
    console.log('[TOOL] Searching Vectorize with namespace...');
    console.log('[TOOL] Namespace (sessionId):', sessionId);

    const searchResults = await env.VECTOR_INDEX.query(queryEmbedding.data[0], {
      topK,
      namespace: sessionId,
      returnMetadata: true
    });

    console.log('[TOOL] Vectorize search complete');
    console.log('[TOOL] Found', searchResults.matches.length, 'matches');

    if (searchResults.matches.length > 0) {
      console.log('[TOOL] First match ID:', searchResults.matches[0].id);
      console.log('[TOOL] First match score:', searchResults.matches[0].score);
    }

    if (searchResults.matches.length === 0) {
      return 'No relevant information found in your documents.';
    }

    // Step 3: Retrieve full chunk data from D1
    const chunkIds = searchResults.matches.map(m => m.id);
    console.log('[TOOL] Retrieving chunks from D1...');
    console.log('[TOOL] Chunk IDs to retrieve:', chunkIds);

    const chunks = await env.DB.prepare(`
      SELECT 
        dc.id,
        dc.text,
        dc.chunk_index,
        dc.page_number,
        d.filename,
        d.id as document_id
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.id IN (${chunkIds.map(() => '?').join(',')})
        AND dc.session_id = ?
      ORDER BY dc.id
    `).bind(...chunkIds, sessionId).all();

    console.log('[TOOL] D1 query complete');
    console.log('[TOOL] Retrieved', chunks.results.length, 'chunks from D1');

    if (chunks.results.length === 0) {
      console.warn('[TOOL] No chunks found in D1 for the given IDs');
      return 'No relevant information found in your documents.';
    }

    // Step 4: Format results with citations
    const results = searchResults.matches.map((match) => {
      const chunk = chunks.results.find((c: any) => c.id.toString() === match.id.toString());

      if (!chunk) {
        console.warn('[TOOL] No chunk found for match ID:', match.id);
      }

      return {
        text: chunk?.text || '',
        score: match.score,
        citation: {
          filename: chunk?.filename || 'Unknown',
          page: chunk?.page_number || undefined,
          chunkIndex: chunk?.chunk_index || 0
        }
      };
    });

    console.log('[TOOL] Formatting results...');

    // Format response for the LLM
    const formattedResults = results.map((r, idx) => {
      const preview = typeof r.text === 'string' ? r.text.substring(0, 100) : '';
      console.log(`[TOOL] Result ${idx + 1}: ${preview}...`);
      return `[${r.citation.filename}${r.citation.page ? `, p.${r.citation.page}` : ''}]: ${r.text}`;
    }).join('\n\n');

    console.log('[TOOL] Search complete successfully');
    console.log('[TOOL] Returning', results.length, 'results');
    console.log('[TOOL] ========================================');

    return formattedResults;
  } catch (error) {
    console.error('[TOOL] Error in search_documents:', error);
    console.error('[TOOL] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return `Error searching documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * List all documents uploaded by the user
 */
export async function listDocuments(agent: Chat): Promise<ListDocumentsResult> {
  console.log('[TOOL] list_documents called');

  try {
    const env = agent.getEnv();
    const sessionId = agent.state.sessionId;

    console.log('[TOOL] Session ID:', sessionId);

    if (!sessionId) {
      return { success: false, documents: [] };
    }

    const result = await env.DB.prepare(`
      SELECT id, filename, processing_status as status, upload_timestamp as uploadedAt, total_chunks as totalChunks
      FROM documents
      WHERE session_id = ?
      ORDER BY upload_timestamp DESC
    `).bind(sessionId).all();

    console.log('[TOOL] Found', result.results.length, 'documents');

    return {
      success: true,
      documents: result.results.map((row: any) => ({
        id: row.id,
        filename: row.filename,
        status: row.status,
        uploadedAt: row.uploadedAt,
        totalChunks: row.totalChunks
      }))
    };
  } catch (error) {
    console.error('[TOOL] Error in list_documents:', error);
    return { success: false, documents: [] };
  }
}

/**
 * Delete a specific document
 */
export async function deleteDocument(
  args: DeleteDocumentArgs,
  agent: Chat
): Promise<string> {
  console.log('[TOOL] delete_document called');
  console.log('[TOOL] Document ID:', args.documentId);

  try {
    const env = agent.getEnv();
    const sessionId = agent.state.sessionId;

    if (!sessionId) {
      return 'Error: No active session.';
    }

    // Get document info first
    const doc = await env.DB.prepare(`
      SELECT filename FROM documents
      WHERE id = ? AND session_id = ?
    `).bind(args.documentId, sessionId).first();

    if (!doc) {
      return 'Document not found.';
    }

    // Get chunk IDs for Vectorize deletion
    const chunks = await env.DB.prepare(`
      SELECT id FROM document_chunks
      WHERE document_id = ? AND session_id = ?
    `).bind(args.documentId, sessionId).all();

    console.log('[TOOL] Found', chunks.results.length, 'chunks to delete');

    // Delete from Vectorize
    if (chunks.results.length > 0) {
      const vectorIds = chunks.results.map((row: any) => row.id.toString());
      await env.VECTOR_INDEX.deleteByIds(vectorIds);
      console.log('[TOOL] Vectors deleted from Vectorize');
    }

    // Delete from D1 (cascades to chunks)
    await env.DB.prepare(`
      DELETE FROM documents
      WHERE id = ? AND session_id = ?
    `).bind(args.documentId, sessionId).run();

    console.log('[TOOL] Document deleted successfully');

    return `Document "${doc.filename}" has been successfully deleted.`;
  } catch (error) {
    console.error('[TOOL] Error in delete_document:', error);
    return `Error deleting document: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
