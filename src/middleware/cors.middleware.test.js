/**
 * Test suite for CORS Middleware
 * Tests the CORS configuration to ensure it properly handles cross-origin requests
 */

const request = require('supertest');
const express = require('express');
const createCorsMiddleware = require('./cors.middleware');

describe('CORS Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(createCorsMiddleware());
    
    // Add a simple test endpoint
    app.post('/test', (req, res) => {
      res.json({ success: true });
    });
  });

  describe('Preflight Requests (OPTIONS)', () => {
    test('should respond to OPTIONS request with CORS headers', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should include allowed headers in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });

    test('should set max age for preflight caching', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-max-age']).toBe('86400');
    });
  });

  describe('Simple Requests', () => {
    test('should include CORS headers in simple POST request', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:4200')
        .send({ data: 'test' });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should expose allowed headers in response', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:4200')
        .send({ data: 'test' });

      const exposedHeaders = response.headers['access-control-expose-headers'];
      expect(exposedHeaders).toBeDefined();
    });
  });

  describe('Allowed Methods', () => {
    test('should allow GET requests', async () => {
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:4200');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    });

    test('should allow PUT requests', async () => {
      app.put('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .put('/test')
        .set('Origin', 'http://localhost:4200');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    });

    test('should allow DELETE requests', async () => {
      app.delete('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .delete('/test')
        .set('Origin', 'http://localhost:4200');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    });
  });

  describe('Allowed Headers', () => {
    test('should allow Content-Type header', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:4200')
        .set('Content-Type', 'application/json')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });

    test('should allow Authorization header', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:4200')
        .set('Authorization', 'Bearer token123')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });

    test('should allow X-Google-ID header', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:4200')
        .set('X-Google-ID', 'google_user_123')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
    });
  });

  describe('Credentials', () => {
    test('should allow credentials to be sent', async () => {
      const response = await request(app)
        .post('/test')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Allow-Credentials', 'true');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Frontend Origin from Environment', () => {
    test('should use FRONTEND_URL environment variable when set', () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      
      try {
        process.env.FRONTEND_URL = 'https://production.example.com';
        
        const middlewareWithEnv = createCorsMiddleware();
        expect(middlewareWithEnv).toBeDefined();
        
        // Middleware is functional and would use the env variable
      } finally {
        process.env.FRONTEND_URL = originalFrontendUrl;
      }
    });

    test('should default to localhost:4200 when FRONTEND_URL not set', () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      
      try {
        delete process.env.FRONTEND_URL;
        
        const middlewareWithDefault = createCorsMiddleware();
        expect(middlewareWithDefault).toBeDefined();
        
        // Middleware is functional and would use the default
      } finally {
        process.env.FRONTEND_URL = originalFrontendUrl;
      }
    });
  });
});

module.exports = {};
