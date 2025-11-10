/**
 * RAG Tools
 * 
 * AI tools for document management and semantic search.
 * These tools allow the agent to search, list, and delete documents.
 */

import { tool } from 'ai';
import { z } from 'zod/v3';
import { getCurrentAgent } from 'agents';
import type { Chat } from '../server';

/**
 * Search Documents Tool
 * 
 * Performs semantic search across user's documents using Vectorize.
 * Returns relevant chunks with citations (filename, page number).
 */
export const searchDocuments = tool({
  description: `Search through the user's uploaded documents using semantic search. 
Use this when the user asks questions about their documents or wants to find specific information.
Returns relevant text chunks with citations (document name and page number).`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query or question to find relevant information'),
    topK: z.number().optional().default(5).describe('Number of results to return (default: 5)')
  }),
  
  execute: async ({ query, topK }) => {
    console.log('[TOOL] search_documents called');
    console.log('[TOOL] Query:', query);
    
    try {
      // Get agent context to access env and state
      const { agent } = getCurrentAgent<Chat>();
      if (!agent) {
        return 'Agent not available';
      }
      const env = agent.getEnv();
      const sessionId = agent.state.sessionId;
      
      if (!sessionId) {
        return {
          success: false,
          error: 'No active session'
        };
      }
      
      console.log('[TOOL] Session ID:', sessionId);
      
      // Step 1: Generate embedding for the query
      console.log('[TOOL] Generating query embedding...');
      const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [query]
      }) as { data: number[][] };
      
      if (!queryEmbedding?.data?.[0]) {
        throw new Error('Failed to generate query embedding');
      }
      
      console.log('[TOOL] Query embedding generated');
      
      // Step 2: Search Vectorize for similar chunks
      console.log('[TOOL] Searching Vectorize...');
      const searchResults = await env.VECTOR_INDEX.query(queryEmbedding.data[0], {
        topK,
        filter: { sessionId } // Only search user's documents
      });
      
      console.log('[TOOL] Found', searchResults.matches.length, 'matches');
      
      if (searchResults.matches.length === 0) {
        return {
          success: true,
          results: [],
          message: 'No relevant information found in your documents.'
        };
      }
      
      // Step 3: Retrieve full chunk data from D1
      const chunkIds = searchResults.matches.map(m => m.id);
      console.log('[TOOL] Retrieving chunks from D1...');
      
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
      
      console.log('[TOOL] Retrieved', chunks.results.length, 'chunks');
      
      // Step 4: Format results with citations
      const results = searchResults.matches.map((match, index) => {
        const chunk = chunks.results.find((c: any) => c.id.toString() === match.id);
        
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
      
      console.log('[TOOL] Search complete');
      
      // Format response for the LLM
      const formattedResults = results.map(r => 
        `[${r.citation.filename}${r.citation.page ? `, p.${r.citation.page}` : ''}]: ${r.text}`
      ).join('\n\n');
      
      return `Found ${results.length} relevant passages:\n\n${formattedResults}`;
      
    } catch (error) {
      console.error('[TOOL] Error in search_documents:', error);
      return `Error searching documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

/**
 * List Documents Tool
 * 
 * Lists all documents for the current user session.
 */
export const listDocuments = tool({
  description: `List all documents that the user has uploaded. 
Shows document names, processing status, upload dates, and number of chunks.
Use this when the user asks "what documents do I have?" or wants to see their uploads.`,
  
  inputSchema: z.object({}).optional(),
  
  execute: async () => {
    console.log('[TOOL] list_documents called');
    
    try {
      const { agent } = getCurrentAgent<Chat>();
      if (!agent) {
        return 'Agent not available';
      }
      const env = agent.getEnv();
      const sessionId = agent.state.sessionId;
      
      if (!sessionId) {
        return 'No active session';
      }
      
      console.log('[TOOL] Session ID:', sessionId);
      
      // Query all documents for this session
      const documents = await env.DB.prepare(`
        SELECT 
          id,
          filename,
          processing_status,
          upload_timestamp,
          file_size,
          total_chunks
        FROM documents
        WHERE session_id = ?
        ORDER BY upload_timestamp DESC
      `).bind(sessionId).all();
      
      console.log('[TOOL] Found', documents.results.length, 'documents');
      
      if (documents.results.length === 0) {
        return 'You have not uploaded any documents yet.';
      }
      
      // Format results
      const formattedDocs = documents.results.map((doc: any) => {
        const size = doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Unknown size';
        const chunks = doc.total_chunks || 0;
        const date = new Date(doc.upload_timestamp).toLocaleDateString();
        
        return `- **${doc.filename}** (${doc.processing_status}) - ${size}, ${chunks} chunks, uploaded ${date}`;
      }).join('\n');
      
      return `You have ${documents.results.length} document(s):\n\n${formattedDocs}`;
      
    } catch (error) {
      console.error('[TOOL] Error in list_documents:', error);
      return `Error listing documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

/**
 * Delete Document Tool
 * 
 * Deletes a document and all its chunks from R2, D1, and Vectorize.
 */
export const deleteDocument = tool({
  description: `Delete a document and all its associated data. 
This removes the document from storage, deletes all text chunks from the database, 
and removes embeddings from the vector index. This action cannot be undone.
Use this when the user explicitly asks to delete or remove a document.`,
  
  inputSchema: z.object({
    documentId: z.string().describe('The ID of the document to delete')
  }),
  
  execute: async ({ documentId }) => {
    console.log('[TOOL] delete_document called');
    console.log('[TOOL] Document ID:', documentId);
    
    try {
      const { agent } = getCurrentAgent<Chat>();
      if (!agent) {
        return 'Agent not available';
      }
      const env = agent.getEnv();
      const sessionId = agent.state.sessionId;
      
      if (!sessionId) {
        return 'No active session';
      }
      
      console.log('[TOOL] Session ID:', sessionId);
      
      // Step 1: Get document info
      const doc = await env.DB.prepare(`
        SELECT id, filename, r2_key
        FROM documents
        WHERE id = ? AND session_id = ?
      `).bind(documentId, sessionId).first();
      
      if (!doc) {
        return 'Document not found';
      }
      
      console.log('[TOOL] Deleting document:', doc.filename);
      
      // Step 2: Get all chunk IDs for Vectorize deletion
      const chunks = await env.DB.prepare(`
        SELECT id FROM document_chunks
        WHERE document_id = ? AND session_id = ?
      `).bind(documentId, sessionId).all();
      
      console.log('[TOOL] Found', chunks.results.length, 'chunks to delete');
      
      // Step 3: Delete from Vectorize
      if (chunks.results.length > 0) {
        const vectorIds = chunks.results.map((c: any) => c.id.toString());
        console.log('[TOOL] Deleting vectors from Vectorize...');
        await env.VECTOR_INDEX.deleteByIds(vectorIds);
        console.log('[TOOL] Vectors deleted');
      }
      
      // Step 4: Delete from R2
      if (doc.r2_key) {
        console.log('[TOOL] Deleting from R2...');
        await env.DOCUMENTS_BUCKET.delete(doc.r2_key as string);
        console.log('[TOOL] R2 object deleted');
      }
      
      // Step 5: Delete from D1 (cascades to chunks)
      console.log('[TOOL] Deleting from D1...');
      await env.DB.prepare(`
        DELETE FROM documents
        WHERE id = ? AND session_id = ?
      `).bind(documentId, sessionId).run();
      
      console.log('[TOOL] Document deleted successfully');
      
      return `Document "${doc.filename}" has been successfully deleted.`;
      
    } catch (error) {
      console.error('[TOOL] Error in delete_document:', error);
      return `Error deleting document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

/**
 * Export all RAG tools
 */
export const ragTools = {
  search_documents: searchDocuments,
  list_documents: listDocuments,
  delete_document: deleteDocument
};
