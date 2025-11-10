/**
 * Document Processing Workflow
 * 
 * Durable workflow for processing uploaded documents:
 * 1. Fetch from R2
 * 2. Extract text (PDF/DOCX)
 * 3. Chunk text
 * 4. Generate embeddings
 * 5. Store in D1 + Vectorize
 * 
 * Benefits of using Workflows:
 * - Automatic retries on failure
 * - Persistent state across steps
 * - Can run for extended periods
 * - Survives worker restarts
 * - Progress tracking
 */

import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { extractText } from '../services/textExtractor';
import { chunkText } from '../services/textChunker';
import { generateEmbeddings } from '../services/embeddings';
import { storeDocumentChunks, updateDocumentStatus } from '../services/storage';

/**
 * Workflow input parameters
 * Passed when the workflow is triggered
 */
export interface DocumentProcessingParams {
  documentId: string;       // Unique document identifier
  sessionId: string;        // Session identifier for isolation
  filename: string;         // Original filename
  r2Key: string;           // R2 storage key
  fileType: string;        // MIME type (application/pdf, etc.)
}

/**
 * Progress information for UI updates
 * Stored in document metadata during processing
 */
export interface ProcessingProgress extends Record<string, unknown> {
  step: 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';
  progress: number;         // 0-100
  message: string;          // Human-readable status message
  error?: string;           // Error message if failed
}

/**
 * Document Processing Workflow
 * 
 * This workflow is triggered when a document is uploaded.
 * Each step is durable and will retry on failure.
 */
export class DocumentProcessingWorkflow extends WorkflowEntrypoint<Env, DocumentProcessingParams> {
  /**
   * Main workflow execution
   * 
   * The 'step' parameter is crucial:
   * - step.do() creates a durable step
   * - If a step fails, only that step retries (not the whole workflow)
   * - Steps are executed in order
   * - State is persisted between steps
   * 
   * @param event - Workflow event with parameters
   * @param step - Step executor for durable operations
   */
  async run(event: WorkflowEvent<DocumentProcessingParams>, step: WorkflowStep) {
    const { documentId, sessionId, filename, r2Key, fileType } = event.payload;
    
    console.log('[WORKFLOW] Starting document processing');
    console.log('[WORKFLOW] Document ID:', documentId);
    console.log('[WORKFLOW] Session ID:', sessionId);
    console.log('[WORKFLOW] Filename:', filename);
    console.log('[WORKFLOW] File type:', fileType);
    
    /**
     * Helper function to update progress in database
     * This allows the UI to show real-time progress
     */
    const updateProgress = async (progress: ProcessingProgress) => {
      console.log(`[WORKFLOW] Progress: ${progress.step} (${progress.progress}%)`);
      await updateDocumentStatus(
        documentId,
        sessionId,
        'processing',
        progress,
        this.env.DB
      );
    };
    
    try {
      // Step 1: Fetch file from R2
      // This step is durable - if it fails, it will retry
      const fileBuffer = await step.do('fetch-from-r2', async () => {
        console.log('[WORKFLOW] Step 1: Fetching from R2');
        await updateProgress({
          step: 'uploading',
          progress: 10,
          message: 'Fetching file from storage...'
        });
        
        const object = await this.env.DOCUMENTS_BUCKET.get(r2Key);
        
        if (!object) {
          throw new Error(`File not found in R2: ${r2Key}`);
        }
        
        const buffer = await object.arrayBuffer();
        console.log('[WORKFLOW] File fetched:', buffer.byteLength, 'bytes');
        
        return buffer;
      });
      
      // Step 2: Extract text from document
      // Durable step - retries on failure
      const extracted = await step.do('extract-text', async () => {
        console.log('[WORKFLOW] Step 2: Extracting text');
        await updateProgress({
          step: 'extracting',
          progress: 30,
          message: 'Extracting text from document...'
        });
        
        const result = await extractText(fileBuffer, fileType);
        console.log('[WORKFLOW] Text extracted:', result.text.length, 'characters');
        
        if (result.pageCount) {
          console.log('[WORKFLOW] Pages:', result.pageCount);
        }
        
        // Return only serializable data (text and pageCount)
        // Metadata may contain non-serializable values
        return {
          text: result.text,
          pageCount: result.pageCount
        };
      });
      
      // Step 3: Chunk text into smaller pieces
      // Durable step - retries on failure
      const chunks = await step.do('chunk-text', async () => {
        console.log('[WORKFLOW] Step 3: Chunking text');
        await updateProgress({
          step: 'chunking',
          progress: 50,
          message: 'Splitting text into chunks...'
        });
        
        // Extract text from the result (handle serialization)
        const textContent = typeof extracted === 'object' && extracted !== null && 'text' in extracted 
          ? (extracted as any).text 
          : String(extracted);
        
        const result = await chunkText(textContent);
        console.log('[WORKFLOW] Text chunked:', result.length, 'chunks');
        
        return result;
      });
      
      // Step 4: Generate embeddings for all chunks
      // Durable step - retries on failure
      const embeddings = await step.do('generate-embeddings', async () => {
        console.log('[WORKFLOW] Step 4: Generating embeddings');
        await updateProgress({
          step: 'embedding',
          progress: 70,
          message: `Generating embeddings for ${chunks.length} chunks...`
        });
        
        const texts = chunks.map(chunk => chunk.text);
        const result = await generateEmbeddings(texts, this.env.AI);
        console.log('[WORKFLOW] Embeddings generated:', result.length);
        
        return result;
      });
      
      // Step 5: Store chunks and embeddings
      // Durable step - retries on failure
      await step.do('store-chunks', async () => {
        console.log('[WORKFLOW] Step 5: Storing chunks and embeddings');
        await updateProgress({
          step: 'indexing',
          progress: 90,
          message: 'Indexing document...'
        });
        
        await storeDocumentChunks(
          documentId,
          sessionId,
          filename,
          chunks,
          embeddings,
          this.env.DB,
          this.env.VECTOR_INDEX
        );
        
        console.log('[WORKFLOW] Storage complete');
      });
      
      // Step 6: Mark as complete
      // Final step - update status to 'ready'
      await step.do('mark-complete', async () => {
        console.log('[WORKFLOW] Step 6: Marking as complete');
        await updateProgress({
          step: 'complete',
          progress: 100,
          message: 'Document ready!'
        });
        
        console.log('[WORKFLOW] Document processing complete');
      });
      
      console.log('[WORKFLOW] ✅ Workflow completed successfully');
      
    } catch (error) {
      // If any step fails after all retries, mark document as error
      console.error('[WORKFLOW] ❌ Workflow failed:', error);
      
      await updateDocumentStatus(
        documentId,
        sessionId,
        'error',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          step: 'unknown',
          progress: 0,
          message: 'Processing failed'
        },
        this.env.DB
      );
      
      // Re-throw to mark workflow as failed
      throw error;
    }
  }
}
