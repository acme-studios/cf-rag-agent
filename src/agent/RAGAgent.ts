/**
 * RAG Agent - Session-based AI Agent with Document Management
 * 
 * This agent handles:
 * - Session management with 24-hour persistence
 * - Document upload and processing
 * - Semantic search over documents
 * - Conversation history storage
 * - Automatic cleanup of expired sessions
 */

import { AIChatAgent } from 'agents/ai-chat-agent';
import type { Connection, ConnectionContext } from 'agents';

/**
 * Document metadata stored in agent state
 */
interface DocumentMetadata {
  id: string;
  filename: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  uploadedAt: number;
  totalChunks?: number;
  currentStep?: 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';
}

/**
 * Conversation message with optional citations
 */
interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  citations?: Array<{
    filename: string;
    page?: number;
  }>;
}

/**
 * Agent state structure
 * This is automatically persisted by the Agents SDK
 */
interface RAGAgentState {
  sessionId: string;
  documents: DocumentMetadata[];
  conversationHistory: ConversationMessage[];
  lastActivity: number;
}

/**
 * RAG Agent Class
 * Extends AIChatAgent to add RAG-specific functionality
 */
export class RAGAgent extends AIChatAgent<Env, RAGAgentState> {
  /**
   * Initial state for new agent instances
   * This is the default state when an agent is first created
   */
  initialState: RAGAgentState = {
    sessionId: '',
    documents: [],
    conversationHistory: [],
    lastActivity: Date.now()
  };

  /**
   * Initialize database schema if it doesn't exist
   * This is called on first connection to ensure tables are created
   */
  async initializeDatabase(): Promise<void> {
    console.log('[AGENT] Initializing database schema...');
    
    try {
      // Create sessions table
      await this.sql`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          last_activity INTEGER NOT NULL,
          document_count INTEGER DEFAULT 0,
          message_count INTEGER DEFAULT 0
        )
      `;
      
      // Create documents table
      await this.sql`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          r2_key TEXT NOT NULL,
          upload_timestamp INTEGER NOT NULL,
          processing_status TEXT NOT NULL,
          file_size INTEGER,
          file_type TEXT,
          total_chunks INTEGER,
          metadata TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `;
      
      // Create document_chunks table
      await this.sql`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          text TEXT NOT NULL,
          page_number INTEGER,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
      `;
      
      // Create conversation_history table
      await this.sql`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          citations TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        )
      `;
      
      console.log('[AGENT] Database schema initialized successfully');
    } catch (error) {
      console.error('[AGENT] Error initializing database:', error);
      // Don't throw - tables might already exist
    }
  }

  /**
   * Called when a client connects via WebSocket
   * This is where we handle session initialization and validation
   * 
   * @param connection - WebSocket connection object
   * @param ctx - Connection context with request details
   */
  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    console.log('[AGENT] Client connecting...');
    
    // Initialize database schema on first connection
    await this.initializeDatabase();
    
    // Extract session ID from request headers
    // The frontend will send this in the x-session-id header
    const sessionId = ctx.request.headers.get('x-session-id') || 'default';
    console.log('[AGENT] Session ID:', sessionId);
    
    // Check if this is a new session or existing session
    const isNewSession = this.state.sessionId === '' || this.state.sessionId !== sessionId;
    
    if (isNewSession) {
      console.log('[AGENT] New session detected');
      
      // Check if previous session expired (24 hours = 86400000 ms)
      const SESSION_DURATION = 24 * 60 * 60 * 1000;
      const sessionAge = Date.now() - this.state.lastActivity;
      
      if (sessionAge > SESSION_DURATION && this.state.sessionId !== '') {
        console.log('[AGENT] Previous session expired, cleaning up...');
        await this.cleanupSession();
      }
      
      // Initialize new session
      this.setState({
        sessionId,
        documents: [],
        conversationHistory: [],
        lastActivity: Date.now()
      });
      
      // Create session record in database
      await this.sql`
        INSERT OR REPLACE INTO sessions (session_id, created_at, last_activity, document_count, message_count)
        VALUES (${sessionId}, ${Date.now()}, ${Date.now()}, 0, 0)
      `;
      
      console.log('[AGENT] New session initialized');
    } else {
      console.log('[AGENT] Existing session resumed');
      
      // Update last activity timestamp
      this.setState({
        ...this.state,
        lastActivity: Date.now()
      });
      
      await this.sql`
        UPDATE sessions 
        SET last_activity = ${Date.now()}
        WHERE session_id = ${sessionId}
      `;
    }
    
    // Send welcome message to client
    connection.send(JSON.stringify({
      type: 'connected',
      sessionId: this.state.sessionId,
      documentCount: this.state.documents.length,
      message: 'Connected to RAG Agent'
    }));
    
    console.log('[AGENT] Connection established');
  }

  /**
   * Cleanup expired session data
   * Removes all documents, chunks, and conversation history for the session
   * This is called automatically when a session expires (>24 hours old)
   */
  async cleanupSession(): Promise<void> {
    const sessionId = this.state.sessionId;
    console.log('[AGENT] Starting cleanup for session:', sessionId);
    
    try {
      // Get all document IDs for this session
      const documents = await this.sql`
        SELECT id, r2_key FROM documents WHERE session_id = ${sessionId}
      `;
      
      console.log('[AGENT] Found', documents.length, 'documents to clean up');
      
      // Delete from R2 storage
      for (const doc of documents) {
        try {
          await this.env.DOCUMENTS_BUCKET.delete(doc.r2_key as string);
          console.log('[AGENT] Deleted from R2:', doc.r2_key);
        } catch (error) {
          console.error('[AGENT] Error deleting from R2:', error);
        }
      }
      
      // Delete from database (cascades to document_chunks via foreign key)
      await this.sql`DELETE FROM documents WHERE session_id = ${sessionId}`;
      console.log('[AGENT] Deleted documents from database');
      
      // Delete conversation history
      await this.sql`DELETE FROM conversation_history WHERE session_id = ${sessionId}`;
      console.log('[AGENT] Deleted conversation history');
      
      // Delete session record
      await this.sql`DELETE FROM sessions WHERE session_id = ${sessionId}`;
      console.log('[AGENT] Deleted session record');
      
      // Note: Vectorize cleanup is more complex as it requires chunk IDs
      // We'll handle this separately in the storage service
      
      console.log('[AGENT] Cleanup complete');
    } catch (error) {
      console.error('[AGENT] Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Store a message in conversation history
   * This is called for both user messages and AI responses
   * 
   * @param role - Message role (user, assistant, system)
   * @param content - Message content
   * @param citations - Optional source citations for AI responses
   */
  async storeMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    citations?: Array<{ filename: string; page?: number }>
  ): Promise<void> {
    const message: ConversationMessage = {
      role,
      content,
      timestamp: Date.now(),
      citations
    };
    
    // Add to agent state
    this.setState({
      ...this.state,
      conversationHistory: [...this.state.conversationHistory, message],
      lastActivity: Date.now()
    });
    
    // Store in database for persistence
    await this.sql`
      INSERT INTO conversation_history (session_id, role, content, timestamp, citations)
      VALUES (
        ${this.state.sessionId},
        ${role},
        ${content},
        ${Date.now()},
        ${citations ? JSON.stringify(citations) : null}
      )
    `;
    
    // Update session message count
    await this.sql`
      UPDATE sessions 
      SET message_count = message_count + 1, last_activity = ${Date.now()}
      WHERE session_id = ${this.state.sessionId}
    `;
    
    console.log('[AGENT] Message stored:', role, content.substring(0, 50) + '...');
  }

  /**
   * Update document status in agent state
   * Called during document processing to track progress
   * 
   * @param documentId - Document ID to update
   * @param updates - Partial document metadata to update
   */
  updateDocumentStatus(documentId: string, updates: Partial<DocumentMetadata>): void {
    const documents = this.state.documents.map(doc =>
      doc.id === documentId ? { ...doc, ...updates } : doc
    );
    
    this.setState({
      ...this.state,
      documents
    });
    
    console.log('[AGENT] Document status updated:', documentId, updates);
  }

  /**
   * Add a new document to agent state
   * Called when a document upload begins
   * 
   * @param document - Document metadata
   */
  addDocument(document: DocumentMetadata): void {
    this.setState({
      ...this.state,
      documents: [...this.state.documents, document]
    });
    
    console.log('[AGENT] Document added:', document.filename);
  }

  /**
   * Remove a document from agent state
   * Called when a document is deleted
   * 
   * @param documentId - Document ID to remove
   */
  removeDocument(documentId: string): void {
    const documents = this.state.documents.filter(doc => doc.id !== documentId);
    
    this.setState({
      ...this.state,
      documents
    });
    
    console.log('[AGENT] Document removed:', documentId);
  }

  /**
   * Get environment bindings
   * Public method to access env from tools
   */
  getEnv(): Env {
    return this.env;
  }
}
