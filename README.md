# Agentic RAG Application

A production-ready **Retrieval Augmented Generation (RAG)** application built on Cloudflare's infrastructure. Upload documents, ask questions, and get accurate answers with source citations.

## Features

- 📄 **Document Management** - Upload PDF/DOCX files with drag-and-drop
- 🔍 **Semantic Search** - Vector-based search using Cloudflare Vectorize
- 💬 **Intelligent Chat** - AI-powered responses with source citations
- 🔄 **Durable Processing** - Reliable document processing with automatic retries
- 📊 **Real-time Progress** - Live updates during document processing
- 🎨 **Modern UI** - Clean slate/charcoal design with dark mode
- 🔐 **Session Isolation** - Each user's data is completely isolated

## Tech Stack

- **AI Model**: Llama 4 Scout (17B, 16 experts) via Workers AI
- **Function Calling**: Native tool use for RAG operations
- **Storage**: R2 (files), D1 (metadata), Vectorize (embeddings)
- **Workflows**: Durable execution for document processing
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers + Durable Objects

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Configure Cloudflare resources:**
```bash
# Create D1 database
wrangler d1 create rag-database

# Create Vectorize index
wrangler vectorize create rag-vector-index --dimensions=768 --metric=cosine

# Create R2 bucket
wrangler r2 bucket create rag-documents
```

3. **Update `wrangler.jsonc`** with your resource IDs

4. **Run locally:**
```bash
npm start
```

5. **Deploy:**
```bash
npm run deploy
```

## Project Structure

```
src/
├── agent/
│   └── RAGAgent.ts              # Core agent with session management
├── api/
│   └── uploadDocument.ts        # Document upload & status endpoints
├── components/
│   ├── ui/                      # Reusable UI components (Button, Badge, etc.)
│   ├── layout/                  # Layout components (Navbar, TwoColumnLayout)
│   ├── docs/                    # Document management components
│   └── chat/                    # Chat interface components
├── services/
│   ├── textExtractor.ts         # PDF/DOCX text extraction
│   ├── textChunker.ts           # Text chunking with overlap
│   ├── embeddings.ts            # Embedding generation
│   └── storage.ts               # D1 & Vectorize operations
├── tools/
│   └── ragTools.ts              # RAG tools (search, list, delete)
├── workflows/
│   └── DocumentProcessing.ts   # Durable document processing workflow
├── app.tsx                      # Main application
└── server.ts                    # Worker entry point
```

## Architecture

### Document Processing Flow
1. **Upload** → File sent to `/api/upload`, stored in R2
2. **Extract** → Text extracted from PDF/DOCX
3. **Chunk** → Text split into 1000-char chunks with 200-char overlap
4. **Embed** → Each chunk converted to 768-dim vector (BGE model)
5. **Store** → Chunks saved to D1, vectors to Vectorize

### RAG Query Flow
1. **User asks question** → Sent to chat agent
2. **Llama 4 Scout decides** → Uses `search_documents` tool
3. **Generate query embedding** → Convert question to vector
4. **Search Vectorize** → Find top-K similar chunks
5. **Retrieve context** → Get full text from D1
6. **Generate answer** → LLM responds with citations

### RAG Tools

Three tools available to the AI agent:

**1. `search_documents`** - Semantic search with citations
```typescript
// Automatically called when user asks questions about documents
// Returns relevant chunks with filename and page number
```

**2. `list_documents`** - List all uploaded documents
```typescript
// Shows document names, status, upload dates, chunk counts
```

**3. `delete_document`** - Remove documents
```typescript
// Deletes from R2, D1, and Vectorize
// Requires explicit user confirmation
```

## Testing

The project uses **Vitest** with Cloudflare Workers support for testing:

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

**Test Types Supported:**
- **Unit Tests** - Test individual functions and components
- **Integration Tests** - Test service interactions (D1, R2, Vectorize)
- **E2E Tests** - Test full workflows with `@cloudflare/vitest-pool-workers`

**When to Add Tests:**
- ✅ **Now**: Add tests for critical business logic (text extraction, chunking, embeddings)
- ✅ **Before Production**: Add integration tests for RAG tools
- ✅ **For Reliability**: Add E2E tests for document processing workflow

**Example Test Structure:**
```typescript
// test/services/textChunker.test.ts
import { describe, it, expect } from 'vitest';
import { chunkText } from '../src/services/textChunker';

describe('Text Chunker', () => {
  it('should split text into chunks with overlap', () => {
    const text = 'A'.repeat(2000);
    const chunks = chunkText(text, 1000, 200);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1000);
  });
});
```

## Key Technologies

- **[Cloudflare Agents](https://developers.cloudflare.com/agents/)** - Stateful AI agents with WebSocket support
- **[Workers AI](https://developers.cloudflare.com/workers-ai/)** - Llama 4 Scout for function calling
- **[Vectorize](https://developers.cloudflare.com/vectorize/)** - Vector database for semantic search
- **[D1](https://developers.cloudflare.com/d1/)** - SQL database for metadata
- **[R2](https://developers.cloudflare.com/r2/)** - Object storage for documents
- **[Durable Workflows](https://developers.cloudflare.com/workflows/)** - Reliable multi-step processing

## Performance

- **Upload**: < 1s for 10MB files
- **Processing**: ~30s for 50-page PDF
- **Search**: < 500ms with citations
- **Chat**: Real-time streaming responses

## Learn More

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Llama 4 Scout Model](https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/)
- [Building RAG Applications](https://developers.cloudflare.com/agents/api-reference/rag/)

## License

MIT
