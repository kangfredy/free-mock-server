# Mock Server

A dynamic, file-based mock server built with Express.js and TypeScript. Create REST API mocks by simply organizing JSON files in folders - no code required!

## Features

- 🚀 **Dynamic Routing**: Automatically creates routes based on folder structure
- 📁 **File-Based Configuration**: Define endpoints using JSON files
- 🔄 **Auto-Reload**: Automatically reloads routes when files change (no server restart needed)
- ✅ **Request Validation**: Validates request body and headers against schemas
- 📝 **Helpful Error Messages**: Shows example requests when validation fails
- 🎯 **Parameter Support**: Dynamic route parameters using `[id]` folder naming
- 🔒 **Header Validation**: Validate required headers (e.g., authentication tokens)
- 🛡️ **Type-Safe**: Built with TypeScript for better development experience

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Folder Structure](#folder-structure)
- [File Naming Convention](#file-naming-convention)
- [Request Validation](#request-validation)
- [Response Files](#response-files)
- [Dynamic Parameters](#dynamic-parameters)
- [Auto-Reload](#auto-reload)
- [Examples](#examples)
- [API Reference](#api-reference)

## Installation

```bash
# Clone the repository
git clone https://github.com/kangfredy/free-mock-server.git
cd free-mock-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start

1. **Create mock data structure** in `src/mocks/`:

```
src/mocks/
└── user/
    ├── get-response.json
    └── post-request.json
    └── post-response.json
```

2. **Start the server**:

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

3. **Test the endpoint**:

```bash
# GET /user
curl http://localhost:3000/user

# POST /user
curl -X POST http://localhost:3000/user \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'
```

## Configuration

### Environment Variables

Create a `.env` file in the project root (you can copy from `.env.example`):

```env
# Server port (default: 3000)
PORT=3000

# API base path (default: empty string - routes at root)
API_BASE_PATH=
# Example: API_BASE_PATH=/api

# Mock data directory (default: src/mocks)
# Can be relative to project root or absolute path
MOCK_DATA_DIR=src/mocks

# Enable file watcher in production (default: enabled in development)
ENABLE_FILE_WATCHER=true

# Node environment
NODE_ENV=development
```

You can use the provided `.env.example` as a template:

```bash
cp .env.example .env
```

### Package Scripts

- `npm run dev` - Start server in development mode with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server

## Folder Structure

The mock server creates routes based on your folder structure in the `mocks` directory:

```
mocks/
├── user/                          → GET,POST /user
│   ├── get-response.json
│   ├── post-request.json
│   └── post-response.json
│
├── user/
│   └── [id]/                      → GET /user/:id
│       ├── get-response.json
│       ├── put-request.json
│       ├── put-response.json
│       └── delete-response.json
│
└── products/
    └── [id]/
        └── reviews/               → GET /products/:id/reviews
            └── get-response.json
```

**Rules:**
- Each folder represents a route segment
- Folders named `[parameterName]` become route parameters (e.g., `[id]` → `:id`)
- Multiple HTTP methods can exist in the same folder
- Routes are automatically created based on response files

## File Naming Convention

### Response Files

Response files define what the endpoint returns. Use the pattern:

- `{method}-response.json` (e.g., `get-response.json`, `post-response.json`)

**Supported methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`

**Example: `get-response.json`**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "User One",
      "email": "user1@example.com"
    }
  ]
}
```

### Request Files (Optional)

Request files define the expected request format and enable validation:

- `{method}-request.json` (e.g., `post-request.json`, `put-request.json`)

#### Simple Format (Legacy)

The simple format is quick and easy to use. **All fields defined in this format are treated as REQUIRED**.

**Example: `post-request.json` (Simple Format)**
```json
{
  "headers": {
    "authorization": "Bearer token",
    "content-type": "application/json"
  },
  "body": {
    "name": "string",
    "email": "string",
    "phone": {
      "countryCode": "string",
      "number": "string"
    },
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "zip": "string"
    }
  }
}
```

**Important notes for Simple Format:**
- ✅ All fields are **required** by default
- ✅ Nested objects are also fully required (e.g., if `phone` exists, both `phone.countryCode` and `phone.number` must be present)
- ✅ Field existence is validated, but data types are not strictly validated (uses example values as reference)
- ✅ Use this format when you need quick validation without type checking or optional fields

#### Advanced Format (With Validation)

For more control, you can use the advanced format with validation rules:

**Example: `post-request.json` (Advanced Format)**
```json
{
  "headers": {
    "content-type": "application/json",
    "authorization": {
      "value": "Bearer token",
      "isNullable": false
    }
  },
  "body": {
    "name": {
      "value": "string",
      "isNullable": false
    },
    "email": {
      "value": "string",
      "isNullable": false
    },
    "age": {
      "value": "number",
      "isNullable": true
    },
    "status": {
      "value": "string",
      "typeData": ["active", "inactive", "pending"],
      "isNullable": false
    },
    "phone": {
      "value": {
        "countryCode": {
          "value": "string",
          "isNullable": false
        },
        "number": {
          "value": "string",
          "isNullable": false
        }
      },
      "isNullable": true
    },
    "address": {
      "value": {
        "street": {
          "value": "string",
          "isNullable": false
        },
        "city": {
          "value": "string",
          "isNullable": false
        },
        "state": {
          "value": "string",
          "typeData": ["CA", "NY", "TX", "FL"],
          "isNullable": false
        },
        "zip": {
          "value": "string",
          "isNullable": false
        }
      },
      "isNullable": false
    },
    "isActive": {
      "value": "boolean",
      "isNullable": false
    }
  }
}
```

**Advanced Format Properties:**
- `value`: The expected value or type (can be `"string"`, `"number"`, `"boolean"`, `"object"`, `"array"`, or an example value)
- `isNullable`: `true` = field is optional, `false` = field is required (default: `false`)
- `typeData`: Array of allowed enum values (for validation)

**Request file structure:**
- `headers` (optional): Expected request headers
- `query` (optional): Expected query parameters (for all HTTP methods)
- `body` (optional): Expected request body schema (for POST, PUT, PATCH)

**Note:** The server supports both formats - use simple format for quick setup, or advanced format for detailed validation.

## Request Validation

The server automatically validates requests when a `{method}-request.json` file exists.

### Body Validation

For `POST`, `PUT`, and `PATCH` requests, the server validates:
- **Required/Optional Fields**: Checks if required fields are present (using `isNullable` in advanced format)
- **Data Types**: Validates field types (`string`, `number`, `boolean`, `object`, `array`)
- **Enum Values**: Validates against allowed values (using `typeData` array)
- **Nested Objects**: Recursive validation of nested object properties
- **Field Paths**: Reports errors with dot notation (e.g., `address.street`)

**Example validation error (with advanced validation):**
```json
{
  "error": "Request validation failed",
  "missingFields": ["email", "address.street"],
  "typeErrors": [
    {"field": "age", "error": "must be a number"},
    {"field": "isActive", "error": "must be a boolean"}
  ],
  "enumErrors": [
    {
      "field": "status",
      "error": "Value \"invalid\" is not allowed",
      "allowedValues": ["active", "inactive", "pending"]
    },
    {
      "field": "address.state",
      "error": "Value \"XX\" is not allowed",
      "allowedValues": ["CA", "NY", "TX", "FL"]
    }
  ],
  "message": "Missing required fields: email, address.street | Type errors: age must be a number, isActive must be a boolean | Enum errors: status Value \"invalid\" is not allowed. Allowed values: active, inactive, pending, address.state Value \"XX\" is not allowed. Allowed values: CA, NY, TX, FL",
  "example": {
    "requestBodyOnly": {
      "name": "string",
      "email": "string",
      "age": 0,
      "status": "active",
      "phone": {
        "countryCode": "string",
        "number": "string"
      },
      "address": {
        "street": "string",
        "city": "string",
        "state": "CA",
        "zip": "string"
      },
      "isActive": true
    },
    "note": "Use this example as a reference for the required request format"
  }
}
```

### Validation Features

1. **Required vs Optional Fields**:
   - In **simple format**: All fields are required by default
   - In **advanced format**: Use `isNullable: true` to make fields optional
   
2. **Type Validation**:
   - Supports: `string`, `number`, `boolean`, `object`, `array`
   - Can specify type as string (e.g., `"value": "string"`) or infer from example value
   
3. **Enum Validation**:
   - Use `typeData` array to specify allowed values
   - Validates that the value matches one of the allowed enum values
   
4. **Nested Validation**:
   - Works recursively for nested objects
   - Reports errors with full path (e.g., `address.state`)

### Query Parameter Validation

Query parameters are validated for all HTTP methods when defined in the `query` property of the request file:

**Example: `get-request.json` with query validation**
```json
{
  "query": {
    "page": {
      "value": "number",
      "isNullable": false
    },
    "limit": {
      "value": "number",
      "isNullable": true
    },
    "status": {
      "value": "string",
      "typeData": ["active", "inactive", "pending"],
      "isNullable": true
    },
    "sort": {
      "value": "string",
      "typeData": ["asc", "desc"],
      "isNullable": true
    }
  }
}
```

**Simple format for query parameters:**
```json
{
  "query": {
    "page": "1",
    "limit": "10",
    "status": "active"
  }
}
```

**Example validation error:**
```json
{
  "error": "Query parameter validation failed",
  "missingParams": ["page"],
  "typeErrors": [
    {"field": "limit", "error": "must be a number"}
  ],
  "enumErrors": [
    {
      "field": "status",
      "error": "Value \"invalid\" is not allowed",
      "allowedValues": ["active", "inactive", "pending"]
    }
  ],
  "message": "Missing required query parameters: page | Query parameter type errors: limit must be a number | Query parameter enum errors: status Value \"invalid\" is not allowed. Allowed values: active, inactive, pending",
  "example": {
    "query": {
      "page": 1,
      "limit": 10,
      "status": "active",
      "sort": "asc"
    },
    "note": "Include these query parameters in your request URL"
  }
}
```

**Usage example:**
```bash
# Valid request
GET /users?page=1&limit=10&status=active&sort=asc

# Invalid request (missing required 'page')
GET /users?limit=10
# Returns 400 error with missing parameter details
```

### Header Validation

Headers are validated for all HTTP methods when defined in the request file:

**Example validation error:**
```json
{
  "error": "Missing required headers",
  "missingHeaders": ["authorization"],
  "message": "Missing required headers: authorization",
  "example": {
    "headers": {
      "authorization": "Bearer token",
      "content-type": "application/json"
    },
    "note": "Include these headers in your request"
  }
}
```

**Important notes:**
- Header names are case-insensitive
- Query parameters support both simple and advanced format (same as body)
- Query parameters can be validated for all HTTP methods (GET, POST, PUT, etc.)
- `GET` and `DELETE` methods don't validate body (even if request file exists)
- Validation is recursive - validates nested objects to any depth

## Response Files

Response files contain the data that will be returned by the endpoint. The entire JSON file content is returned as the response.

**Example: `post-response.json`**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "createdAt": "2021-01-01T00:00:00.000Z"
  }
}
```

## Dynamic Parameters

Use folder names wrapped in square brackets to create dynamic route parameters:

**Folder structure:**
```
mocks/
└── user/
    └── [id]/
        └── get-response.json
```

**Route created:** `GET /user/:id`

**In response files, you can reference parameters:**
```json
{
  "id": ":id",
  "message": "User with ID :id retrieved"
}
```

Note: The `:id` placeholder in response files is returned as-is. For actual parameter values, you'll need to modify the handler code.

## Auto-Reload

In development mode, the server automatically watches for file changes and reloads routes without requiring a restart.

**Features:**
- Watches all JSON files in the `mocks` directory
- Debounced reload (waits 500ms for multiple changes to finish)
- Recursive watching (includes all subdirectories)
- Logs all file changes and route reloads

**Console output example:**
```
📝 File change: user/post-response.json
🔄 File change detected, reloading routes...
📂 Scanning routes from: src/mocks
✅ Reloaded 3 route(s):
  GET /user
  POST /user
  GET /user/:id
```

To disable auto-reload in production, set `ENABLE_FILE_WATCHER=false` in `.env`.

## Examples

### Example 1: Simple GET Endpoint

**Structure:**
```
mocks/
└── users/
    └── get-response.json
```

**File: `get-response.json`**
```json
{
  "users": [
    {"id": 1, "name": "John"},
    {"id": 2, "name": "Jane"}
  ]
}
```

**Result:** `GET /users` returns the users array

### Example 2: POST with Validation

**Structure:**
```
mocks/
└── users/
    ├── post-request.json
    └── post-response.json
```

**File: `post-request.json`**
```json
{
  "headers": {
    "authorization": "Bearer token"
  },
  "body": {
    "name": "string",
    "email": "string"
  }
}
```

**File: `post-response.json`**
```json
{
  "success": true,
  "id": 1,
  "message": "User created"
}
```

**Result:** 
- `POST /users` validates headers and body
- Returns 400 error if validation fails (with example request)
- Returns success response if validation passes

### Example 3: Dynamic Parameter

**Structure:**
```
mocks/
└── products/
    └── [id]/
        ├── get-response.json
        ├── put-request.json
        ├── put-response.json
        └── delete-response.json
```

**File: `products/[id]/get-response.json`**
```json
{
  "id": ":id",
  "name": "Product Name",
  "price": 99.99
}
```

**Result:** 
- `GET /products/:id` - Get product by ID
- `PUT /products/:id` - Update product (with validation)
- `DELETE /products/:id` - Delete product

### Example 4: Nested Routes

**Structure:**
```
mocks/
└── users/
    └── [userId]/
        └── orders/
            └── get-response.json
```

**Result:** `GET /users/:userId/orders`

## API Reference

### API Documentation

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`

The Swagger UI documents example endpoints (such as `/health`, `/users`, and `/products/{id}`) and shows request/response examples based on the folder structure examples in this README. Your actual routes are still fully driven by the `mocks` directory structure.

### Health Check

```
GET /health
```

Returns server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Route Matching

Routes are matched based on:
1. HTTP method (GET, POST, PUT, PATCH, DELETE)
2. Path structure from folder hierarchy
3. Dynamic parameters from `[paramName]` folders

### Error Responses

#### 400 Bad Request (Missing Body Fields)
```json
{
  "error": "Missing request body fields",
  "missingFields": ["email", "address.street"],
  "message": "Missing required fields: email, address.street",
  "example": {
    "requestBodyOnly": { /* example body */ },
    "note": "Use this example as a reference..."
  }
}
```

#### 401 Unauthorized (Missing Headers)
```json
{
  "error": "Missing required headers",
  "missingHeaders": ["authorization"],
  "message": "Missing required headers: authorization",
  "example": {
    "headers": { /* example headers */ },
    "note": "Include these headers in your request"
  }
}
```

#### 404 Not Found
```json
{
  "error": "Route not found",
  "path": "/unknown/route",
  "method": "GET"
}
```

## Best Practices

1. **Organize by resource**: Create folders for each resource type (users, products, orders)
2. **Use consistent naming**: Follow the `{method}-response.json` and `{method}-request.json` pattern
3. **Validate everything**: Always create request files for POST/PUT/PATCH endpoints
4. **Provide examples**: Include example values in request files that match real data
5. **Use nested validation**: Define complete nested objects in request files for better validation
6. **Test thoroughly**: Verify all endpoints work before deploying

## Troubleshooting

### Routes not loading
- Check that response files follow the naming convention: `{method}-response.json`
- Verify the `MOCK_DATA_DIR` path in `.env` is correct
- Check console logs for file reading errors

### Validation not working
- Ensure `{method}-request.json` file exists in the same folder as response file
- Check that request file has valid JSON structure
- Verify you're using POST, PUT, or PATCH (GET/DELETE don't validate body)

### Auto-reload not working
- Ensure you're running in development mode (`npm run dev`)
- Check that `ENABLE_FILE_WATCHER=true` in `.env` for production
- Verify file changes are being saved

### 404 errors
- Check that folder structure matches the route you're trying to access
- Verify `API_BASE_PATH` matches your request URL prefix
- Ensure response file exists for the HTTP method you're using

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

