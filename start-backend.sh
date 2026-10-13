#!/bin/bash

# TedBus Backend Startup Script

echo "================================================"
echo "       Starting TedBus Backend Server"
echo "================================================"
echo ""

cd "$(dirname "$0")/frontend/server"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found in frontend/server/"
    echo "Please create a .env file with required configuration"
    exit 1
fi

echo "✓ Configuration found"
echo "✓ Starting server on port ${PORT:-5001}..."
echo ""
echo "Server will be available at: http://localhost:${PORT:-5001}"
echo "Health check endpoint: http://localhost:${PORT:-5001}/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================================"
echo ""

npm start
