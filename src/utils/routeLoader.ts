import * as fs from 'fs';
import * as path from 'path';
import { Request, Response, NextFunction } from 'express';
import { validateRequestBody, validateRequestHeaders, validateRequestQuery } from './validation';

interface RouteConfig {
  method: string;
  path: string;
  requestSchema?: any;
  headerSchema?: any;
  querySchema?: any;
  responseData: any;
  isParameterized: boolean;
  paramNames: string[];
}

// Supported HTTP methods
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Extract method from filename pattern: {method}-response.json
function getMethodFromResponseFile(filename: string): string | null {
  const lowerFilename = filename.toLowerCase();
  
  for (const method of HTTP_METHODS) {
    const methodLower = method.toLowerCase();
    if (lowerFilename === `${methodLower}-response.json`) {
      return method;
    }
  }
  
  return null;
}

export function scanRoutes(baseDir: string, basePath: string = ''): RouteConfig[] {
  const routes: RouteConfig[] = [];
  
  if (!fs.existsSync(baseDir)) {
    return routes;
  }

  const items = fs.readdirSync(baseDir, { withFileTypes: true });
  const responseFiles: { method: string; file: string }[] = [];

  // First pass: collect all {method}-response.json files
  for (const item of items) {
    if (!item.isDirectory()) {
      const method = getMethodFromResponseFile(item.name);
      if (method) {
        responseFiles.push({ method, file: item.name });
      }
    }
  }

  // Process each response file found
  for (const { method, file: responseFile } of responseFiles) {
    const responsePath = path.join(baseDir, responseFile);
    const methodLower = method.toLowerCase();
    
    // Get corresponding request file: {method}-request.json
    const requestPath = path.join(baseDir, `${methodLower}-request.json`);
    let requestSchema = null;
    let headerSchema = null;
    let querySchema = null;

    // Read request schema if request file exists
    if (fs.existsSync(requestPath)) {
      try {
        const requestContent = fs.readFileSync(requestPath, 'utf-8');
        const parsed = JSON.parse(requestContent);
        
        // Extract headers schema if exists
        if (parsed.headers) {
          headerSchema = parsed.headers;
        }
        
        // Extract query schema if exists
        if (parsed.query) {
          querySchema = parsed.query;
        }
        
        // Extract body schema if exists
        if (parsed.body) {
          requestSchema = parsed.body;
        } else if (parsed.schema) {
          requestSchema = parsed.schema;
        } else if (!parsed.headers && !parsed.query) {
          // If no headers or query property, use entire request.json as body schema
          requestSchema = parsed;
        }
      } catch (error) {
        console.error(`Error reading request file at ${requestPath}:`, error);
      }
    }

    // Parse route path to extract parameters
    const paramMatches = basePath.match(/\[([^\]]+)\]/g) || [];
    const paramNames = paramMatches.map(match => match.slice(1, -1));
    const expressPath = basePath.replace(/\[([^\]]+)\]/g, ':$1');

    // Read response.json
    try {
      const responseContent = fs.readFileSync(responsePath, 'utf-8');
      const responseData = JSON.parse(responseContent);

      routes.push({
        method,
        path: '/' + expressPath.replace(/\\/g, '/'),
        requestSchema,
        headerSchema,
        querySchema,
        responseData,
        isParameterized: paramNames.length > 0,
        paramNames
      });
    } catch (error) {
      console.error(`Error reading response file at ${responsePath}:`, error);
    }
  }

  // Recursively scan subdirectories
  for (const item of items) {
    if (item.isDirectory()) {
      const fullPath = path.join(baseDir, item.name);
      const routePath = path.join(basePath, item.name);

      // Check if directory name is a parameter (starts with [ or [] )
      if (item.name.startsWith('[') && item.name.endsWith(']')) {
        // Extract parameter name
        const paramName = item.name.slice(1, -1); // Remove [ and ]
        const newBasePath = routePath.replace(/\[.*?\]/, `:${paramName}`);
        
        routes.push(...scanRoutes(fullPath, newBasePath));
      } else {
        routes.push(...scanRoutes(fullPath, routePath));
      }
    }
  }

  return routes;
}

// Check if schema field uses new format
function isNewFormatSchema(schemaValue: any): boolean {
  return schemaValue !== null &&
    typeof schemaValue === 'object' &&
    !Array.isArray(schemaValue) &&
    ('value' in schemaValue || 'isNullable' in schemaValue || 'typeData' in schemaValue);
}

// Get actual value from schema (handles both old and new format)
function getSchemaValue(schemaValue: any): any {
  if (isNewFormatSchema(schemaValue)) {
    return schemaValue.value;
  }
  return schemaValue;
}

// Generate example request from schema
function generateExampleRequest(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const example: any = {};

  for (const key in schema) {
    const value = schema[key];
    
    if (value === null || value === undefined) {
      example[key] = null;
    } else if (isNewFormatSchema(value)) {
      // New format: extract value and handle enum
      const actualValue = getSchemaValue(value);
      const enumValues = getEnumValues(value);
      
      if (enumValues && enumValues.length > 0) {
        // Use first enum value as example
        example[key] = enumValues[0];
      } else if (actualValue !== null && typeof actualValue === 'object' && !Array.isArray(actualValue)) {
        // Nested object in new format
        example[key] = generateExampleRequest(actualValue);
      } else if (typeof actualValue === 'string' && ['string', 'number', 'boolean', 'object', 'array'].includes(actualValue.toLowerCase())) {
        // Type definition (e.g., "string", "number") - use example based on type
        const typeStr = actualValue.toLowerCase();
        switch (typeStr) {
          case 'string':
            example[key] = 'string';
            break;
          case 'number':
            example[key] = 0;
            break;
          case 'boolean':
            example[key] = true;
            break;
          case 'object':
            example[key] = {};
            break;
          case 'array':
            example[key] = [];
            break;
          default:
            example[key] = actualValue;
        }
      } else {
        // Use actual value as example
        example[key] = actualValue;
      }
    } else if (Array.isArray(value)) {
      // For arrays, use the first element as example or empty array
      example[key] = value.length > 0 ? [generateExampleRequest(value[0])] : [];
    } else if (typeof value === 'object') {
      // Nested object, recurse
      example[key] = generateExampleRequest(value);
    } else {
      // Use the value as-is (it's already an example from request.json)
      example[key] = value;
    }
  }

  return example;
}

// Helper function to get enum values (for routeLoader)
function getEnumValues(schemaValue: any): string[] | null {
  if (isNewFormatSchema(schemaValue) && Array.isArray(schemaValue.typeData)) {
    return schemaValue.typeData;
  }
  return null;
}

// Create route handler
export function createRouteHandler(config: RouteConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate request headers if header schema exists (for all methods)
    if (config.headerSchema) {
      const headerValidation = validateRequestHeaders(req.headers, config.headerSchema);
      
      if (!headerValidation.valid) {
        // Generate example headers
        const exampleHeaders: any = {};
        for (const headerKey in config.headerSchema) {
          exampleHeaders[headerKey] = config.headerSchema[headerKey];
        }

        return res.status(401).json({
          error: 'Missing required headers',
          missingHeaders: headerValidation.missingHeaders,
          message: `Missing required headers: ${headerValidation.missingHeaders.join(', ')}`,
          example: {
            headers: exampleHeaders,
            note: 'Include these headers in your request'
          }
        });
      }
    }

    // Validate query parameters if query schema exists (for all methods)
    if (config.querySchema) {
      const queryValidation = validateRequestQuery(req.query, config.querySchema);
      
      if (!queryValidation.valid) {
        // Generate example query parameters
        const exampleQuery = generateExampleRequest(config.querySchema);
        
        // Build error messages
        const errorMessages: string[] = [];
        
        if (queryValidation.missingParams.length > 0) {
          errorMessages.push(`Missing required query parameters: ${queryValidation.missingParams.join(', ')}`);
        }
        
        if (queryValidation.typeErrors.length > 0) {
          const typeErrorMessages = queryValidation.typeErrors.map(e => `${e.field} ${e.error}`);
          errorMessages.push(`Query parameter type errors: ${typeErrorMessages.join(', ')}`);
        }
        
        if (queryValidation.enumErrors.length > 0) {
          const enumErrorMessages = queryValidation.enumErrors.map(e => 
            `${e.field} ${e.error}. Allowed values: ${e.allowedValues.join(', ')}`
          );
          errorMessages.push(`Query parameter enum errors: ${enumErrorMessages.join(', ')}`);
        }

        return res.status(400).json({
          error: 'Query parameter validation failed',
          missingParams: queryValidation.missingParams,
          typeErrors: queryValidation.typeErrors,
          enumErrors: queryValidation.enumErrors,
          message: errorMessages.join(' | '),
          example: {
            query: exampleQuery,
            note: 'Include these query parameters in your request URL'
          }
        });
      }
    }

    // Validate request body if schema exists and method requires body
    if (config.requestSchema && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      const validation = validateRequestBody(req.body, config.requestSchema);
      
      if (!validation.valid) {
        // Generate example request body from schema
        const exampleBody = generateExampleRequest(config.requestSchema);
        
        // Build error messages
        const errorMessages: string[] = [];
        
        if (validation.missingFields.length > 0) {
          errorMessages.push(`Missing required fields: ${validation.missingFields.join(', ')}`);
        }
        
        if (validation.typeErrors.length > 0) {
          const typeErrorMessages = validation.typeErrors.map(e => `${e.field} ${e.error}`);
          errorMessages.push(`Type errors: ${typeErrorMessages.join(', ')}`);
        }
        
        if (validation.enumErrors.length > 0) {
          const enumErrorMessages = validation.enumErrors.map(e => 
            `${e.field} ${e.error}. Allowed values: ${e.allowedValues.join(', ')}`
          );
          errorMessages.push(`Enum errors: ${enumErrorMessages.join(', ')}`);
        }

        return res.status(400).json({
          error: 'Request validation failed',
          missingFields: validation.missingFields,
          typeErrors: validation.typeErrors,
          enumErrors: validation.enumErrors,
          message: errorMessages.join(' | '),
          example: {
            requestBodyOnly: exampleBody,
            note: 'Use this example as a reference for the required request format'
          }
        });
      }
    }

    // Return response data
    res.json(config.responseData);
  };
}