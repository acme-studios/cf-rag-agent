/**
 * RAG Tool Schemas for Workers AI
 * 
 * These schemas follow the OpenAI function calling format
 * that Workers AI expects. Each tool has a schema and implementation.
 */

// Tool schemas in Workers AI format (OpenAI function calling format)
export const searchDocumentsSchema = {
  type: "function",
  function: {
    name: "search_documents",
    description: "Semantically search through user's uploaded documents to find relevant information. Use when user asks about document content, summaries, or specific topics. Extract the core topic/question as the query parameter.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query - extract the main topic or question from user's message. Examples: 'security features', 'compliance requirements', 'document summary'"
        },
        topK: {
          type: "number",
          description: "Number of relevant chunks to return (default: 5, max: 10)"
        }
      },
      required: ["query"]
    }
  }
} as const;

export const listDocumentsSchema = {
  type: "function",
  function: {
    name: "list_documents",
    description: "List all documents uploaded by the user in their current session. Use when user asks 'what documents do you have?', 'show my files', 'list documents', or wants to know what's available. Returns filenames and status.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
} as const;

export const deleteDocumentSchema = {
  type: "function",
  function: {
    name: "delete_document",
    description: "Delete a specific document from the user's session. Use this when the user explicitly asks to delete or remove a document.",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The ID of the document to delete"
        }
      },
      required: ["documentId"]
    }
  }
} as const;

// Export all schemas as an array for tool planning
export const allRAGToolSchemas = [
  searchDocumentsSchema,
  listDocumentsSchema,
  deleteDocumentSchema
] as const;
