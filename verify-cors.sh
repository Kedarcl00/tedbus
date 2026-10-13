#!/bin/bash

# CORS Configuration Verification Script
# Tests if CORS is properly configured

echo "========================================"
echo "CORS Configuration Verification"
echo "========================================"
echo ""

# Check if CORS middleware file exists
echo "✓ Checking CORS middleware file..."
if [ -f "src/middleware/cors.middleware.js" ]; then
    echo "  ✓ Found: src/middleware/cors.middleware.js"
else
    echo "  ✗ Missing: src/middleware/cors.middleware.js"
    exit 1
fi

# Check if server.js imports CORS middleware
echo ""
echo "✓ Checking server.js imports..."
if grep -q "createCorsMiddleware" src/server.js; then
    echo "  ✓ server.js imports CORS middleware"
else
    echo "  ✗ server.js does not import CORS middleware"
    exit 1
fi

# Check if CORS is used in server.js
echo ""
echo "✓ Checking CORS middleware registration..."
if grep -q "app.use(createCorsMiddleware())" src/server.js; then
    echo "  ✓ CORS middleware is registered"
else
    echo "  ✗ CORS middleware is not registered"
    exit 1
fi

# Check if documentation exists
echo ""
echo "✓ Checking documentation..."
if [ -f "docs/CORS_CONFIGURATION.md" ]; then
    echo "  ✓ Found: docs/CORS_CONFIGURATION.md"
else
    echo "  ✗ Missing: docs/CORS_CONFIGURATION.md"
    exit 1
fi

# Check if test file exists
echo ""
echo "✓ Checking test file..."
if [ -f "src/middleware/cors.middleware.test.js" ]; then
    echo "  ✓ Found: src/middleware/cors.middleware.test.js"
else
    echo "  ✗ Missing: src/middleware/cors.middleware.test.js"
    exit 1
fi

# Validate JavaScript syntax
echo ""
echo "✓ Validating JavaScript syntax..."
node -c src/middleware/cors.middleware.js > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✓ src/middleware/cors.middleware.js syntax is valid"
else
    echo "  ✗ src/middleware/cors.middleware.js has syntax errors"
    exit 1
fi

node -c src/server.js > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✓ src/server.js syntax is valid"
else
    echo "  ✗ src/server.js has syntax errors"
    exit 1
fi

# Check .env for FRONTEND_URL
echo ""
echo "✓ Checking environment configuration..."
if grep -q "FRONTEND_URL" .env; then
    FRONTEND_URL=$(grep "FRONTEND_URL" .env | cut -d'=' -f2)
    echo "  ✓ FRONTEND_URL configured: $FRONTEND_URL"
else
    echo "  ⚠ FRONTEND_URL not in .env (will use default: http://localhost:4200)"
fi

# Summary
echo ""
echo "========================================"
echo "✓ CORS Configuration Verification: PASSED"
echo "========================================"
echo ""
echo "Configuration Summary:"
echo "  - CORS Middleware: src/middleware/cors.middleware.js"
echo "  - Server Integration: src/server.js"
echo "  - Documentation: docs/CORS_CONFIGURATION.md"
echo "  - Tests: src/middleware/cors.middleware.test.js"
echo ""
echo "To test CORS with curl:"
echo "  curl -X OPTIONS http://localhost:3001/auth/login \\"
echo "    -H 'Origin: http://localhost:4200' \\"
echo "    -H 'Access-Control-Request-Method: POST' \\"
echo "    -H 'Access-Control-Request-Headers: Content-Type, Authorization' \\"
echo "    -v"
echo ""
