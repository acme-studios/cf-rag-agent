#!/bin/bash

# Test script to verify document is searchable
# This simulates what the agent does when searching

WORKER_URL="https://rag-agent.acme-corp.workers.dev"
SESSION_ID="session_1762752857274_4f71f8ed-b45a-4783-868e-c4525b16fbd8"
DOC_ID="doc-1762825605257-3lrxc3ygy"

echo "=== Testing Document Status ==="
curl -s "${WORKER_URL}/api/documents/${DOC_ID}" | jq .

echo ""
echo "=== Testing Document Search ==="
echo "Query: What is this document about?"

# Note: This would require authentication/session handling
# For now, just check if the document exists and is ready
