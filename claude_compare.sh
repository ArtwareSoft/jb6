#!/bin/bash

# Claude Comparison CLI - Compare streaming vs separate calls
# Usage: ./claude_compare.sh

set -e

echo "=== Claude Code Comparison: Streaming vs Separate Calls ==="
echo

# Test messages
MESSAGE1='{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Hello"}]}}'
MESSAGE2='{"type":"user","message":{"role":"user","content":[{"type":"text","text":"how large is USA?"}]}}'

echo "Testing with messages:"
echo "1. Hello"
echo "2. how large is USA?"
echo
echo "----------------------------------------"

# Method 1: Streaming approach (single call, multiple messages)
echo "🔄 METHOD 1: Streaming approach (single call, multiple messages)"
echo "Command: echo -e 'msg1\\nmsg2' | claude -p --input-format=stream-json --output-format=stream-json"
echo

cd /tmp
echo -e "${MESSAGE1}\n${MESSAGE2}" | claude -p --input-format=stream-json --output-format=stream-json > /tmp/streaming_output.json
echo "✅ Streaming output saved to /tmp/streaming_output.json"
echo

echo "----------------------------------------"

# Method 2: Separate calls
echo "🔄 METHOD 2: Two separate Claude calls"
echo "Command 1: echo 'msg1' | claude -p --input-format=stream-json --output-format=stream-json"
echo "Command 2: echo 'msg2' | claude -p --input-format=stream-json --output-format=stream-json"
echo

echo "${MESSAGE1}" | claude -p --input-format=stream-json --output-format=stream-json > /tmp/separate_call1.json
echo "✅ First call output saved to /tmp/separate_call1.json"

echo "${MESSAGE2}" | claude -p --input-format=stream-json --output-format=stream-json > /tmp/separate_call2.json
echo "✅ Second call output saved to /tmp/separate_call2.json"

echo

echo "----------------------------------------"
echo "📊 ANALYSIS & COMPARISON"
echo "----------------------------------------"

# Count sessions in streaming approach
STREAMING_SESSIONS=$(grep -o '"session_id":"[^"]*"' /tmp/streaming_output.json | sort -u | wc -l)
echo "Streaming approach sessions: ${STREAMING_SESSIONS}"

# Count sessions in separate calls
SEPARATE_SESSION1=$(grep -o '"session_id":"[^"]*"' /tmp/separate_call1.json | head -1)
SEPARATE_SESSION2=$(grep -o '"session_id":"[^"]*"' /tmp/separate_call2.json | head -1)
echo "Separate calls sessions: 2 (each call gets its own session)"

echo
echo "Session IDs found:"
echo "- Streaming: $(grep -o '"session_id":"[^"]*"' /tmp/streaming_output.json | sort -u)"
echo "- Call 1: ${SEPARATE_SESSION1}"
echo "- Call 2: ${SEPARATE_SESSION2}"

echo
echo "🔍 Key Differences:"
echo "1. CONTEXT: Streaming maintains context between messages in same session"
echo "2. SESSIONS: Streaming reuses sessions, separate calls create new sessions"
echo "3. COST: Separate calls may have higher initialization overhead"
echo "4. SPEED: Streaming avoids Claude startup time for subsequent messages"

echo
echo "📁 Output files for detailed inspection:"
echo "- /tmp/streaming_output.json (streaming approach)"
echo "- /tmp/separate_call1.json (first separate call)"
echo "- /tmp/separate_call2.json (second separate call)"

echo
echo "🧮 Response extraction (assistant messages only):"
echo "Streaming responses:"
jq -r 'select(.type=="assistant") | .message.content[0].text' /tmp/streaming_output.json | nl

echo
echo "Separate call responses:"
echo "Call 1:"
jq -r 'select(.type=="assistant") | .message.content[0].text' /tmp/separate_call1.json | nl
echo "Call 2:"
jq -r 'select(.type=="assistant") | .message.content[0].text' /tmp/separate_call2.json | nl

echo
echo "✨ Analysis complete! Check the output files for full details."
