#!/usr/bin/env node
/**
 * TedBus Comprehensive Connection & Feature Test
 * Tests all features listed in your project requirements
 */

require('dotenv').config({ path: './frontend/server/.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bright}${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  separator: () => console.log(`${colors.cyan}${'-'.repeat(80)}${colors.reset}`),
};

// Test results storage
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

/**
 * Test 1: Environment Configuration
 */
async function testEnvironmentConfig() {
  log.header();
  log.title('TEST 1: Environment Configuration');
  log.separator();

  const requiredVars = [
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
  ];

  const optionalVars = [
    'MAP_BOX_API_KEY',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ];

  // Check required variables
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      log.success(`${varName} is set`);
      results.passed.push(`Env: ${varName}`);
    } else {
      log.error(`${varName} is MISSING (required)`);
      results.failed.push(`Env: ${varName} missing`);
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    if (process.env[varName] && process.env[varName] !== 'your_mapbox_api_key_here' && !process.env[varName].includes('your_')) {
      log.success(`${varName} is configured`);
      results.passed.push(`Env: ${varName}`);
    } else {
      log.warning(`${varName} is not configured (optional)`);
      results.warnings.push(`Env: ${varName} not configured`);
    }
  }
}

/**
 * Test 2: MongoDB Connection
 */
async function testMongoDBConnection() {
  log.header();
  log.title('TEST 2: MongoDB Connection');
  log.separator();

  try {
    const mongoUri = process.env.MONGODB_URI;
    log.info(`Connecting to: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}`);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });

    log.success('MongoDB connection established');
    log.info(`Database: ${mongoose.connection.name}`);
    log.info(`Host: ${mongoose.connection.host}`);
    log.info(`Port: ${mongoose.connection.port}`);
    
    results.passed.push('MongoDB connection');
    return true;
  } catch (error) {
    log.error(`MongoDB connection failed: ${error.message}`);
    results.failed.push(`MongoDB connection: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Database Models
 */
async function testDatabaseModels() {
  log.header();
  log.title('TEST 3: Database Models & Schemas');
  log.separator();

  const modelPaths = [
    './frontend/server/models/User.js',
    './frontend/server/models/bus.js',
    './frontend/server/models/route.js',
    './frontend/server/models/booking.js',
  ];

  const modelNames = ['User', 'Bus', 'Route', 'Booking'];

  for (let i = 0; i < modelPaths.length; i++) {
    const modelPath = path.resolve(modelPaths[i]);
    const modelName = modelNames[i];

    try {
      if (fs.existsSync(modelPath)) {
        require(modelPath);
        if (mongoose.models[modelName]) {
          log.success(`${modelName} model loaded and registered`);
          results.passed.push(`Model: ${modelName}`);
        } else {
          log.error(`${modelName} model exists but not registered`);
          results.failed.push(`Model: ${modelName} not registered`);
        }
      } else {
        log.error(`${modelName} model file not found at ${modelPath}`);
        results.failed.push(`Model: ${modelName} file missing`);
      }
    } catch (error) {
      log.error(`${modelName} model failed to load: ${error.message}`);
      results.failed.push(`Model: ${modelName} load error`);
    }
  }
}

/**
 * Test 4: Backend Routes
 */
async function testBackendRoutes() {
  log.header();
  log.title('TEST 4: Backend Routes');
  log.separator();

  const routePaths = [
    './frontend/server/routes/customer.js',
    './frontend/server/routes/route.js',
    './frontend/server/routes/booking.js',
  ];

  const routeNames = ['Customer Routes', 'Route Routes', 'Booking Routes'];

  for (let i = 0; i < routePaths.length; i++) {
    const routePath = path.resolve(routePaths[i]);
    const routeName = routeNames[i];

    try {
      if (fs.existsSync(routePath)) {
        require(routePath);
        log.success(`${routeName} loaded successfully`);
        results.passed.push(`Routes: ${routeName}`);
      } else {
        log.error(`${routeName} file not found at ${routePath}`);
        results.failed.push(`Routes: ${routeName} file missing`);
      }
    } catch (error) {
      log.error(`${routeName} failed to load: ${error.message}`);
      results.failed.push(`Routes: ${routeName} load error - ${error.message}`);
    }
  }
}

/**
 * Test 5: Frontend Files
 */
async function testFrontendFiles() {
  log.header();
  log.title('TEST 5: Frontend Components & Configuration');
  log.separator();

  const frontendFiles = [
    { path: './frontend/src/app/app.component.ts', name: 'App Component' },
    { path: './frontend/src/app/app.routes.ts', name: 'App Routes' },
    { path: './frontend/src/app/app.config.ts', name: 'App Config' },
    { path: './frontend/package.json', name: 'Frontend Package.json' },
    { path: './frontend/tsconfig.json', name: 'TypeScript Config' },
  ];

  for (const file of frontendFiles) {
    const filePath = path.resolve(file.path);
    if (fs.existsSync(filePath)) {
      log.success(`${file.name} exists`);
      results.passed.push(`Frontend: ${file.name}`);
    } else {
      log.error(`${file.name} not found at ${file.path}`);
      results.failed.push(`Frontend: ${file.name} missing`);
    }
  }

  // Check for key Angular components based on your requirements
  const components = [
    './frontend/src/app/navbar',
    './frontend/src/app/footer',
    './frontend/src/app/landing',
    './frontend/src/app/selectbus',
    './frontend/src/app/booking',
    './frontend/src/app/payment',
    './frontend/src/app/profile',
  ];

  log.separator();
  log.info('Checking for key components from requirements...');

  for (const comp of components) {
    const compPath = path.resolve(comp);
    const compName = path.basename(comp);
    if (fs.existsSync(compPath)) {
      log.success(`${compName} component directory exists`);
      results.passed.push(`Component: ${compName}`);
    } else {
      log.warning(`${compName} component not found (may need to be created)`);
      results.warnings.push(`Component: ${compName} missing`);
    }
  }
}

/**
 * Test 6: Backend Dependencies
 */
async function testBackendDependencies() {
  log.header();
  log.title('TEST 6: Backend Dependencies');
  log.separator();

  const packageJsonPath = path.resolve('./frontend/server/package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredDeps = [
      'express',
      'mongoose',
      'mongodb',
      'cors',
      'body-parser',
      'dotenv',
    ];

    const optionalDeps = [
      'nodemailer',
      'web-push',
    ];

    for (const dep of requiredDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        log.success(`${dep} ${packageJson.dependencies[dep]} installed`);
        results.passed.push(`Dependency: ${dep}`);
      } else {
        log.error(`${dep} is MISSING (required)`);
        results.failed.push(`Dependency: ${dep} missing`);
      }
    }

    for (const dep of optionalDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        log.success(`${dep} ${packageJson.dependencies[dep]} installed`);
        results.passed.push(`Dependency: ${dep}`);
      } else {
        log.warning(`${dep} is not installed (optional)`);
        results.warnings.push(`Dependency: ${dep} not installed`);
      }
    }
  } catch (error) {
    log.error(`Failed to read package.json: ${error.message}`);
    results.failed.push(`Backend package.json read error`);
  }
}

/**
 * Test 7: Frontend Dependencies
 */
async function testFrontendDependencies() {
  log.header();
  log.title('TEST 7: Frontend Dependencies');
  log.separator();

  const packageJsonPath = path.resolve('./frontend/package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredDeps = [
      '@angular/core',
      '@angular/common',
      '@angular/router',
      '@angular/forms',
      '@angular/material',
      'rxjs',
    ];

    for (const dep of requiredDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        log.success(`${dep} ${packageJson.dependencies[dep]} installed`);
        results.passed.push(`Frontend Dep: ${dep}`);
      } else {
        log.error(`${dep} is MISSING (required)`);
        results.failed.push(`Frontend Dep: ${dep} missing`);
      }
    }
  } catch (error) {
    log.error(`Failed to read frontend package.json: ${error.message}`);
    results.failed.push(`Frontend package.json read error`);
  }
}

/**
 * Test 8: Google OAuth Configuration
 */
async function testGoogleOAuth() {
  log.header();
  log.title('TEST 8: Google OAuth Configuration');
  log.separator();

  // Check root .env
  const rootEnvPath = path.resolve('./.env');
  if (fs.existsSync(rootEnvPath)) {
    const rootEnv = fs.readFileSync(rootEnvPath, 'utf8');
    if (rootEnv.includes('GOOGLE_CLIENT_ID')) {
      const match = rootEnv.match(/GOOGLE_CLIENT_ID=([^\n]+)/);
      if (match && match[1] && !match[1].includes('your_')) {
        log.success(`Google Client ID configured in root .env`);
        results.passed.push('Google OAuth: Client ID');
      } else {
        log.warning('Google Client ID placeholder found in root .env');
        results.warnings.push('Google OAuth: Client ID needs value');
      }
    } else {
      log.warning('Google Client ID not found in root .env');
      results.warnings.push('Google OAuth: Client ID missing');
    }
  }
}

/**
 * Test 9: Server Configuration
 */
async function testServerConfiguration() {
  log.header();
  log.title('TEST 9: Server Configuration Files');
  log.separator();

  const configFiles = [
    { path: './frontend/server/index.js', name: 'Server Entry Point' },
    { path: './frontend/server/config/database.js', name: 'Database Config' },
  ];

  for (const file of configFiles) {
    const filePath = path.resolve(file.path);
    if (fs.existsSync(filePath)) {
      log.success(`${file.name} exists`);
      results.passed.push(`Config: ${file.name}`);
    } else {
      log.error(`${file.name} not found`);
      results.failed.push(`Config: ${file.name} missing`);
    }
  }
}

/**
 * Test 10: Project Structure Validation
 */
async function testProjectStructure() {
  log.header();
  log.title('TEST 10: Project Structure Validation');
  log.separator();

  const requiredDirs = [
    './frontend',
    './frontend/src',
    './frontend/src/app',
    './frontend/server',
    './frontend/server/routes',
    './frontend/server/models',
    './frontend/server/controller',
  ];

  for (const dir of requiredDirs) {
    const dirPath = path.resolve(dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      log.success(`${dir} directory exists`);
      results.passed.push(`Structure: ${dir}`);
    } else {
      log.error(`${dir} directory not found`);
      results.failed.push(`Structure: ${dir} missing`);
    }
  }
}

/**
 * Generate Summary Report
 */
function generateSummary() {
  log.header();
  log.title('TEST SUMMARY REPORT');
  log.separator();

  console.log(`\n${colors.bright}Results:${colors.reset}`);
  console.log(`${colors.green}Passed: ${results.passed.length}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed.length}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${results.warnings.length}${colors.reset}`);

  if (results.failed.length > 0) {
    console.log(`\n${colors.bright}${colors.red}Failed Tests:${colors.reset}`);
    results.failed.forEach((test, idx) => {
      console.log(`  ${idx + 1}. ${test}`);
    });
  }

  if (results.warnings.length > 0) {
    console.log(`\n${colors.bright}${colors.yellow}Warnings:${colors.reset}`);
    results.warnings.forEach((warning, idx) => {
      console.log(`  ${idx + 1}. ${warning}`);
    });
  }

  console.log(`\n${colors.bright}Overall Status:${colors.reset}`);
  if (results.failed.length === 0) {
    log.success('All critical tests passed! ✓');
  } else {
    log.error(`${results.failed.length} critical issue(s) found that need attention`);
  }

  log.header();
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     TEDBUS COMPREHENSIVE CONNECTION TEST                   ║');
  console.log('║                           All Features Validation                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  try {
    await testEnvironmentConfig();
    const dbConnected = await testMongoDBConnection();
    
    if (dbConnected) {
      await testDatabaseModels();
    } else {
      log.warning('Skipping model tests due to database connection failure');
    }

    await testBackendRoutes();
    await testFrontendFiles();
    await testBackendDependencies();
    await testFrontendDependencies();
    await testGoogleOAuth();
    await testServerConfiguration();
    await testProjectStructure();

    generateSummary();

  } catch (error) {
    log.error(`Test runner encountered an error: ${error.message}`);
    console.error(error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      log.info('MongoDB connection closed');
    }
    process.exit(results.failed.length > 0 ? 1 : 0);
  }
}

// Run all tests
runAllTests();
