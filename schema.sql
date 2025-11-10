-- RAG Agent Database Schema
-- All tables are session-scoped to ensure data isolation between users

-- Documents table
-- Stores metadata about uploaded documents
-- Each document is tied to a session_id for isolation
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,                    -- Unique document ID (UUID)
  session_id TEXT NOT NULL,               -- Session ID for isolation
  filename TEXT NOT NULL,                 -- Original filename
  r2_key TEXT NOT NULL,                   -- R2 storage key
  upload_timestamp INTEGER NOT NULL,      -- Unix timestamp of upload
  processing_status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, ready, error
  total_chunks INTEGER DEFAULT 0,         -- Number of chunks created
  file_size INTEGER,                      -- File size in bytes
  file_type TEXT,                         -- MIME type (application/pdf, etc)
  metadata TEXT                           -- JSON metadata (progress, errors, etc)
);

-- Index for fast session-based queries
CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);

-- Index for filtering by status within a session
CREATE INDEX IF NOT EXISTS idx_documents_session_status ON documents(session_id, processing_status);

-- Document chunks table
-- Stores the actual text chunks extracted from documents
-- Each chunk is tied to both a document and a session
CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,   -- Auto-incrementing chunk ID
  session_id TEXT NOT NULL,               -- Session ID for isolation
  document_id TEXT NOT NULL,              -- Parent document ID
  chunk_index INTEGER NOT NULL,           -- Order of chunk in document (0, 1, 2, ...)
  text TEXT NOT NULL,                     -- The actual text content
  page_number INTEGER,                    -- Page number (if available from PDF)
  created_at INTEGER NOT NULL,            -- Unix timestamp of creation
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Index for fast session-based queries
CREATE INDEX IF NOT EXISTS idx_chunks_session ON document_chunks(session_id);

-- Index for retrieving all chunks of a document
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);

-- Composite index for efficient chunk retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_session_document ON document_chunks(session_id, document_id);

-- Conversation history table
-- Stores all user messages and AI responses for context
-- Used for maintaining conversation memory within a session
CREATE TABLE IF NOT EXISTS conversation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,   -- Auto-incrementing message ID
  session_id TEXT NOT NULL,               -- Session ID for isolation
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),  -- Message role
  content TEXT NOT NULL,                  -- Message content
  timestamp INTEGER NOT NULL,             -- Unix timestamp of message
  citations TEXT,                         -- JSON array of citations (for AI responses)
  metadata TEXT                           -- JSON metadata (tool calls, etc)
);

-- Index for fast session-based queries
CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_history(session_id);

-- Index for chronological retrieval within a session
CREATE INDEX IF NOT EXISTS idx_conversation_session_timestamp ON conversation_history(session_id, timestamp);

-- Session metadata table (optional)
-- Tracks session-level information like creation time, last activity
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,            -- Unique session ID
  created_at INTEGER NOT NULL,            -- Unix timestamp of creation
  last_activity INTEGER NOT NULL,         -- Unix timestamp of last activity
  document_count INTEGER DEFAULT 0,       -- Number of documents uploaded
  message_count INTEGER DEFAULT 0         -- Number of messages exchanged
);

-- Index for finding expired sessions
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
