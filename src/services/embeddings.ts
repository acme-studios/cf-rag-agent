/**
 * Embeddings Service
 * 
 * Generates vector embeddings for text using Cloudflare Workers AI.
 * 
 * Embeddings are numerical representations of text that capture semantic meaning.
 * Similar texts have similar embeddings, enabling semantic search.
 * 
 * Model: @cf/baai/bge-base-en-v1.5
 * - Dimensions: 768
 * - Max input: 512 tokens (~2000 characters)
 * - Optimized for English text
 * - Good balance of speed and quality
 */

/**
 * Embedding model configuration
 */
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const EMBEDDING_DIMENSIONS = 768;
const MAX_BATCH_SIZE = 100; // Maximum texts to embed in one API call

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  embeddings: number[][];     // Array of embedding vectors
  model: string;              // Model used for generation
  dimensions: number;         // Dimension of each vector
}

/**
 * Generate embeddings for an array of texts
 * 
 * How it works:
 * 1. Split texts into batches (API has limits)
 * 2. Call Workers AI for each batch
 * 3. Collect all embeddings
 * 4. Return as array of vectors
 * 
 * Each embedding is a 768-dimensional vector of numbers.
 * Example: [0.123, -0.456, 0.789, ...]
 * 
 * @param texts - Array of text strings to embed
 * @param ai - Cloudflare AI binding
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(
  texts: string[],
  ai: Ai
): Promise<number[][]> {
  console.log('[EMBED] Starting embedding generation');
  console.log('[EMBED] Number of texts:', texts.length);
  console.log('[EMBED] Model:', EMBEDDING_MODEL);
  
  if (texts.length === 0) {
    console.warn('[EMBED] No texts provided, returning empty array');
    return [];
  }
  
  try {
    // Split into batches to avoid API limits
    const batches = splitIntoBatches(texts, MAX_BATCH_SIZE);
    console.log('[EMBED] Split into', batches.length, 'batches');
    
    const allEmbeddings: number[][] = [];
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[EMBED] Processing batch ${i + 1}/${batches.length} (${batch.length} texts)`);
      
      // Call Workers AI
      // The model expects an object with a 'text' property
      const result = await ai.run(EMBEDDING_MODEL, {
        text: batch
      }) as { data: number[][] };
      
      // Validate result
      if (!result || !result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid response from AI model');
      }
      
      console.log(`[EMBED] Batch ${i + 1} complete: ${result.data.length} embeddings generated`);
      
      // Validate embedding dimensions
      for (const embedding of result.data) {
        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          console.warn(`[EMBED] Warning: Unexpected embedding dimension: ${embedding.length} (expected ${EMBEDDING_DIMENSIONS})`);
        }
      }
      
      // Add to results
      allEmbeddings.push(...result.data);
    }
    
    console.log('[EMBED] All embeddings generated successfully');
    console.log('[EMBED] Total embeddings:', allEmbeddings.length);
    console.log('[EMBED] Dimensions per embedding:', EMBEDDING_DIMENSIONS);
    
    return allEmbeddings;
    
  } catch (error) {
    console.error('[EMBED] Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a single embedding for one text
 * Convenience function for single-text embedding
 * 
 * @param text - Text to embed
 * @param ai - Cloudflare AI binding
 * @returns Single embedding vector
 */
export async function generateEmbedding(
  text: string,
  ai: Ai
): Promise<number[]> {
  console.log('[EMBED] Generating single embedding');
  const embeddings = await generateEmbeddings([text], ai);
  return embeddings[0];
}

/**
 * Split an array into batches of specified size
 * 
 * Example:
 * Input: [1, 2, 3, 4, 5], batchSize: 2
 * Output: [[1, 2], [3, 4], [5]]
 * 
 * @param array - Array to split
 * @param batchSize - Maximum size of each batch
 * @returns Array of batches
 */
function splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  
  return batches;
}

/**
 * Calculate cosine similarity between two embeddings
 * 
 * Cosine similarity measures how similar two vectors are:
 * - 1.0 = identical
 * - 0.0 = orthogonal (unrelated)
 * - -1.0 = opposite
 * 
 * Used for manual similarity checks and debugging
 * 
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Similarity score between -1 and 1
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimensions');
  }
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }
  
  // Calculate magnitudes
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  // Return cosine similarity
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Truncate text to fit within model's token limit
 * 
 * The embedding model has a max input of ~512 tokens (~2000 characters).
 * This function truncates text to ensure it fits.
 * 
 * @param text - Text to truncate
 * @param maxChars - Maximum characters (default: 2000)
 * @returns Truncated text
 */
export function truncateText(text: string, maxChars: number = 2000): string {
  if (text.length <= maxChars) {
    return text;
  }
  
  console.warn(`[EMBED] Truncating text from ${text.length} to ${maxChars} characters`);
  return text.substring(0, maxChars);
}

/**
 * Get embedding model information
 * 
 * @returns Model configuration
 */
export function getEmbeddingModelInfo() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    maxBatchSize: MAX_BATCH_SIZE,
    maxInputChars: 2000
  };
}
