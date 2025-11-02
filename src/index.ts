// Load environment variables first - must be before any process.env usage
import dotenv from 'dotenv';
const envResult = dotenv.config();

if (envResult.error) {
  console.warn('⚠️  Warning: .env file not found or error loading:', envResult.error.message);
} else {
  console.log('✅ Environment variables loaded from .env file');
}

import express, { Express, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import * as path from 'path';
import { scanRoutes, createRouteHandler } from './utils/routeLoader';
import { watchDirectory } from './utils/fileWatcher';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Base route for API
const API_BASE_PATH = process.env.API_BASE_PATH || '';
const MOCK_DATA_DIR = path.join(__dirname, '../src/mocks');

// Debug: Log environment variables
console.log('🔍 Environment variables check:');
console.log('  PORT:', process.env.PORT || 'not set (using default: 3000)');
console.log('  API_BASE_PATH:', process.env.API_BASE_PATH || 'not set (using default: empty string)');
console.log('  MOCK_DATA_DIR:', process.env.MOCK_DATA_DIR || 'not set (using default)');

// Create a router for dynamic routes
let routesRouter = Router();
let registeredRoutes: string[] = [];

// Function to reload all routes
function reloadRoutes() {
  try {
    console.log('📂 Scanning routes from:', MOCK_DATA_DIR);
    const routes = scanRoutes(MOCK_DATA_DIR);

    // Create new router
    const newRouter = Router();
    const newRegisteredRoutes: string[] = [];

    // Register all routes to new router
    routes.forEach(route => {
      const handler = createRouteHandler(route);
      const fullPath = `${API_BASE_PATH}${route.path}`;
      const routeKey = `${route.method} ${fullPath}`;
      
      newRegisteredRoutes.push(routeKey);

      switch (route.method) {
        case 'GET':
          newRouter.get(route.path, handler);
          break;
        case 'POST':
          newRouter.post(route.path, handler);
          break;
        case 'PUT':
          newRouter.put(route.path, handler);
          break;
        case 'PATCH':
          newRouter.patch(route.path, handler);
          break;
        case 'DELETE':
          newRouter.delete(route.path, handler);
          break;
        default:
          console.warn(`Unknown method: ${route.method} for path: ${route.path}`);
      }
    });

    // Replace old router with new one
    routesRouter = newRouter;
    registeredRoutes = newRegisteredRoutes;

    console.log(`✅ Reloaded ${routes.length} route(s):`);
    registeredRoutes.forEach(route => {
      console.log(`  ${route}`);
    });
    console.log(''); // Empty line for readability
  } catch (error) {
    console.error('❌ Error reloading routes:', error);
  }
}

// Initial route loading
reloadRoutes();

// Middleware to handle dynamic routes (always use the latest router)
// This middleware will be called on every request and use the current routesRouter
app.use((req, res, next) => {
  // Skip health check
  if (req.path === '/health') {
    return next();
  }

  // Handle API base path
  if (API_BASE_PATH && req.path.startsWith(API_BASE_PATH)) {
    const originalUrl = req.url;
    // Create new path without API_BASE_PATH
    const newPath = req.path.slice(API_BASE_PATH.length) || '/';
    const queryString = originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '';
    req.url = newPath + queryString;
    
    routesRouter(req, res, (err: any) => {
      // Restore original url
      req.url = originalUrl;
      if (err) {
        next(err);
      } else if (!res.headersSent) {
        next();
      }
    });
  } else if (!API_BASE_PATH) {
    // No base path, route everything through router
    routesRouter(req, res, next);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Setup file watcher for auto-reload (only in development)
const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment || process.env.ENABLE_FILE_WATCHER === 'true') {
  console.log('👀 Setting up file watcher for auto-reload...');
  const stopWatching = watchDirectory(MOCK_DATA_DIR, reloadRoutes, 500);
  
  // Cleanup on process exit
  process.on('SIGINT', () => {
    stopWatching();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    stopWatching();
    process.exit(0);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Mock Server running on http://localhost:${PORT}`);
  console.log(`📁 Mock data directory: ${MOCK_DATA_DIR}`);
  console.log(`🌐 API base path: ${API_BASE_PATH || '(root)'}`);
  if (isDevelopment || process.env.ENABLE_FILE_WATCHER === 'true') {
    console.log(`🔄 Auto-reload: ENABLED\n`);
  } else {
    console.log(`🔄 Auto-reload: DISABLED (set ENABLE_FILE_WATCHER=true to enable)\n`);
  }
});