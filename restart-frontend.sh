#!/bin/bash

echo "🔄 Restarting Angular Frontend..."
echo ""

cd "$(dirname "$0")/frontend"

# Kill any existing Angular processes on port 4200
echo "Stopping any existing Angular processes..."
lsof -ti:4200 | xargs kill -9 2>/dev/null || echo "No process on port 4200"

# Clear Angular cache
echo "Clearing Angular cache..."
rm -rf .angular/cache
rm -rf dist

echo ""
echo "✅ Cache cleared"
echo "🚀 Starting Angular dev server..."
echo ""
echo "The frontend will be available at: http://localhost:4200"
echo "Press Ctrl+C to stop"
echo ""

# Start Angular
ng serve
