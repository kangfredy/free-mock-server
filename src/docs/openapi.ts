// Dynamic OpenAPI 3.0 generator for mock server documentation
// This uses RouteConfig from routeLoader so Swagger will always
// follow the latest mocks folder structure.

import type { RouteConfig } from '../utils/routeLoader';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

// Convert simple body/query/header schema to a generic JSON Schema
function schemaFromRequestPart(part: any): any {
  if (!part || typeof part !== 'object') {
    return undefined;
  }

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const key of Object.keys(part)) {
    const raw = part[key];

    // New format: { value, isNullable, typeData }
    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      ('value' in raw || 'isNullable' in raw || 'typeData' in raw)
    ) {
      const value = raw.value;
      const isNullable = raw.isNullable === true ? true : false;
      const enumValues = Array.isArray(raw.typeData) ? raw.typeData : undefined;

      const schema: any = {};

      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (['string', 'number', 'boolean', 'object', 'array'].includes(lower)) {
          schema.type = lower === 'array' ? 'array' : lower;
        } else {
          schema.type = 'string';
          schema.example = value;
        }
      } else if (Array.isArray(value)) {
        schema.type = 'array';
        if (value.length > 0 && typeof value[0] === 'object') {
          schema.items = schemaFromRequestPart(value[0]);
        }
      } else if (value && typeof value === 'object') {
        schema.type = 'object';
        const nested = schemaFromRequestPart(value);
        if (nested && nested.properties) {
          schema.properties = nested.properties;
          if (nested.required) {
            schema.required = nested.required;
          }
        }
      } else if (typeof value === 'number') {
        schema.type = 'number';
        schema.example = value;
      } else if (typeof value === 'boolean') {
        schema.type = 'boolean';
        schema.example = value;
      } else {
        schema.type = 'string';
      }

      if (enumValues) {
        schema.enum = enumValues;
      }

      if (!isNullable) {
        required.push(key);
      }

      properties[key] = schema;
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      // Legacy format: nested object
      const nested = schemaFromRequestPart(raw);
      properties[key] = {
        type: 'object',
        properties: nested?.properties ?? {},
      };
      required.push(key);
    } else {
      // Simple value, treat as required
      properties[key] = { type: typeof raw === 'number' ? 'number' : 'string' };
      required.push(key);
    }
  }

  const result: any = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    result.required = required;
  }

  return result;
}

// Generate OpenAPI spec based on the latest route list
export function buildOpenApiSpec(routes: RouteConfig[], apiBasePath: string) {
  const paths: Record<string, any> = {};

  // Add a static health check definition
  paths['/health'] = {
    get: {
      summary: 'Health check',
      description: 'Cek status server mock.',
      responses: {
        '200': {
          description: 'Server sehat',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
                required: ['status', 'timestamp'],
              },
            },
          },
        },
      },
    },
  };

  routes.forEach((route) => {
    const method = route.method.toLowerCase() as HttpMethod;
    const fullPath = `${apiBasePath || ''}${route.path}`;

    if (!paths[fullPath]) {
      paths[fullPath] = {};
    }

    const parameters: any[] = [];

    // Path params from scanRoutes (paramNames)
    if (route.paramNames && route.paramNames.length > 0) {
      route.paramNames.forEach((name) => {
        parameters.push({
          in: 'path',
          name,
          required: true,
          schema: { type: 'string' },
        });
      });
    }

    // Query params
    if (route.querySchema) {
      Object.keys(route.querySchema).forEach((key) => {
        parameters.push({
          in: 'query',
          name: key,
          required: true, // from mock perspective, all defined fields are important
          schema: { type: 'string' },
        });
      });
    }

    // Header params
    if (route.headerSchema) {
      Object.keys(route.headerSchema).forEach((key) => {
        parameters.push({
          in: 'header',
          name: key,
          required: true,
          schema: { type: 'string' },
        });
      });
    }

    const operation: any = {
      summary: `${route.method} ${fullPath}`,
      description:
        'This endpoint is generated automatically from the folder structure and JSON files in the mocks directory.',
      parameters,
      responses: {
        '200': {
          description: 'Mock response loaded from the {method}-response.json file',
          content: {
            'application/json': {
              schema: {
                type: 'object',
              },
              examples: {
                example: {
                  summary: 'Example response from the response.json file',
                  value: route.responseData,
                },
              },
            },
          },
        },
        ...(route.requestSchema && ['POST', 'PUT', 'PATCH'].includes(route.method)
          ? {
              '400': {
                description: 'Request validation failed (based on schema from request.json)',
              },
            }
          : {}),
      },
    };

    if (route.requestSchema && ['POST', 'PUT', 'PATCH'].includes(route.method)) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: schemaFromRequestPart(route.requestSchema),
          },
        },
      };
    }

    paths[fullPath][method] = operation;
  });

  return {
    openapi: '3.0.0',
    info: {
      title: 'Free Mock Server',
      version: '1.0.0',
      description:
        'Dynamic file-based mock server. Endpoints are generated automatically from the folder structure and JSON files in the mocks directory.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description:
          'Local server (adjust PORT and API_BASE_PATH from the .env file if different)',
      },
    ],
    paths,
  };
}

