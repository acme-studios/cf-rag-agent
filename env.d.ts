/* eslint-disable */
// Environment type definitions for RAG Agent
// Includes all Cloudflare bindings: AI, R2, D1, Vectorize, Workflows, Durable Objects
declare namespace Cloudflare {
	interface Env {
		// Durable Object binding for Chat agent
		Chat: DurableObjectNamespace<import("./src/server").Chat>;
		
		// Workers AI binding for embeddings and LLM
		AI: Ai;
		
		// R2 bucket for document storage
		DOCUMENTS_BUCKET: R2Bucket;
		
		// D1 database for metadata and text storage
		DB: D1Database;
		
		// Vectorize index for vector embeddings
		VECTOR_INDEX: VectorizeIndex;
		
		// Workflow binding for document processing
		DOCUMENT_WORKFLOW: Workflow;
		
		// Browser Rendering API (optional, for browse_web tool)
		BROWSER?: Fetcher;
	}
}
interface Env extends Cloudflare.Env {}
