#!/bin/bash

# TedBus Frontend Startup Script

echo "================================================"
echo "       Starting TedBus Frontend Server"
echo "================================================"
echo ""

cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
    echo ""
fi

echo "✓ Configuration found"
echo "✓ Starting Angular development server..."
echo ""
echo "Frontend will be available at: http://localhost:4200"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================================"
echo ""

npm start
