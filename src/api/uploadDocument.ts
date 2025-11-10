/**
 * Document Upload API
 * 
 * Handles file uploads to R2 and triggers the document processing workflow.
 * 
 * Flow:
 * 1. Receive file from client
 * 2. Validate file type and size
 * 3. Upload to R2
 * 4. Create document record in D1
 * 5. Trigger workflow for processing
 * 6. Return document ID to client
 */

import { createDocumentRecord } from '../services/storage';

/**
 * Handle document upload
 * 
 * @param request - HTTP request with multipart/form-data
 * @param env - Environment bindings
 * @param sessionId - User session ID
 * @returns Response with document ID or error
 */
export async function handleDocumentUpload(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  console.log('[UPLOAD] Starting document upload');
  console.log('[UPLOAD] Session ID:', sessionId);
  
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return Response.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }
    
    console.log('[UPLOAD] File received:', file.name, file.type, file.size);
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return Response.json({
        success: false,
        error: 'Invalid file type. Only PDF and DOCX files are supported.'
      }, { status: 400 });
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return Response.json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      }, { status: 400 });
    }
    
    // Generate document ID
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const r2Key = `documents/${sessionId}/${documentId}/${file.name}`;
    
    console.log('[UPLOAD] Document ID:', documentId);
    console.log('[UPLOAD] R2 key:', r2Key);
    
    // Upload to R2
    console.log('[UPLOAD] Uploading to R2...');
    const fileBuffer = await file.arrayBuffer();
    await env.DOCUMENTS_BUCKET.put(r2Key, fileBuffer, {
      httpMetadata: {
        contentType: file.type
      }
    });
    
    console.log('[UPLOAD] File uploaded to R2');
    
    // Create document record in D1
    console.log('[UPLOAD] Creating document record in D1...');
    await createDocumentRecord(
      documentId,
      sessionId,
      file.name,
      r2Key,
      file.size,
      file.type,
      env.DB
    );
    
    console.log('[UPLOAD] Document record created');
    
    // Trigger workflow for processing
    console.log('[UPLOAD] Triggering workflow...');
    await env.DOCUMENT_WORKFLOW.create({
      params: {
        documentId,
        sessionId,
        filename: file.name,
        r2Key,
        fileType: file.type
      }
    });
    
    console.log('[UPLOAD] Workflow triggered');
    console.log('[UPLOAD] Upload complete');
    
    // Return success response
    return Response.json({
      success: true,
      documentId,
      filename: file.name,
      message: 'Document uploaded successfully. Processing started.'
    });
    
  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }, { status: 500 });
  }
}

/**
 * Get document status
 * 
 * @param documentId - Document ID to check
 * @param sessionId - User session ID
 * @param env - Environment bindings
 * @returns Response with document status
 */
export async function getDocumentStatus(
  documentId: string,
  sessionId: string,
  env: Env
): Promise<Response> {
  console.log('[STATUS] Checking document status');
  console.log('[STATUS] Document ID:', documentId);
  console.log('[STATUS] Session ID:', sessionId);
  
  try {
    const doc = await env.DB.prepare(`
      SELECT 
        id,
        filename,
        processing_status,
        total_chunks,
        metadata
      FROM documents
      WHERE id = ? AND session_id = ?
    `).bind(documentId, sessionId).first();
    
    if (!doc) {
      return Response.json({
        success: false,
        error: 'Document not found'
      }, { status: 404 });
    }
    
    // Parse metadata if it exists
    let progress = null;
    if (doc.metadata) {
      try {
        progress = JSON.parse(doc.metadata as string);
      } catch (e) {
        console.warn('[STATUS] Failed to parse metadata');
      }
    }
    
    return Response.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        status: doc.processing_status,
        totalChunks: doc.total_chunks,
        progress
      }
    });
    
  } catch (error) {
    console.error('[STATUS] Error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    }, { status: 500 });
  }
}
