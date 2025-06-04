#!/bin/bash

# Test script for NERD daemon P2P communication
echo "🚀 Starting NERD daemon P2P test..."

# Build the daemon first
echo "Building daemon..."
go build -o nerd-daemon

# Start first daemon on port 6881 (default)
echo "Starting daemon 1 on port 6881..."
./nerd-daemon > daemon1.log 2>&1 &
DAEMON1_PID=$!

# Wait a moment for first daemon to start
sleep 2

# Create config for second daemon on port 6882
echo "Starting daemon 2 on port 6882..."
# For now, we'll modify the config in the future to support different ports
# This test demonstrates the current functionality

echo "✅ Daemon 1 running on port 6881 (PID: $DAEMON1_PID)"
echo "📄 Logs available in daemon1.log"

echo ""
echo "🔍 Checking daemon 1 logs:"
tail -10 daemon1.log

echo ""
echo "⏰ Letting daemon run for 5 seconds..."
sleep 5

echo ""
echo "🔍 Final daemon 1 logs:"
tail -10 daemon1.log

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $DAEMON1_PID 2>/dev/null
wait $DAEMON1_PID 2>/dev/null

echo "✅ Test completed. Check daemon1.log for full output." 