// Check if schema field uses new format (with value, isNullable, typeData)
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

// Check if field is nullable/optional
function isFieldNullable(schemaValue: any): boolean {
  if (isNewFormatSchema(schemaValue)) {
    return schemaValue.isNullable === true;
  }
  return false; // Default: required
}

// Get enum values from schema
function getEnumValues(schemaValue: any): string[] | null {
  if (isNewFormatSchema(schemaValue) && Array.isArray(schemaValue.typeData)) {
    return schemaValue.typeData;
  }
  return null;
}

// Validate data type
function validateType(value: any, expectedType: string, fieldPath: string): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    return { valid: true }; // Null/undefined handled by required check
  }

  switch (expectedType?.toLowerCase()) {
    case 'string':
      return { valid: typeof value === 'string', error: `must be a string` };
    case 'number':
      return { valid: typeof value === 'number' && !isNaN(value), error: `must be a number` };
    case 'boolean':
      return { valid: typeof value === 'boolean', error: `must be a boolean` };
    case 'object':
      return { valid: typeof value === 'object' && !Array.isArray(value) && value !== null, error: `must be an object` };
    case 'array':
      return { valid: Array.isArray(value), error: `must be an array` };
    default:
      // If type is not recognized, skip type validation (backward compatibility)
      return { valid: true };
  }
}

// Validate request body against schema
export function validateRequestBody(reqBody: any, schema: any): { 
  valid: boolean; 
  missingFields: string[];
  typeErrors: Array<{ field: string; error: string }>;
  enumErrors: Array<{ field: string; error: string; allowedValues: string[] }>;
} {
  if (!schema) {
    return { valid: true, missingFields: [], typeErrors: [], enumErrors: [] };
  }

  const missingFields: string[] = [];
  const typeErrors: Array<{ field: string; error: string }> = [];
  const enumErrors: Array<{ field: string; error: string; allowedValues: string[] }> = [];

  function checkFields(obj: any, schemaObj: any, prefix: string = '') {
    if (typeof schemaObj !== 'object' || schemaObj === null) {
      return;
    }

    for (const key in schemaObj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const schemaValue = schemaObj[key];

      // Check if key exists in request object
      const keyExists = obj && typeof obj === 'object' && key in obj;
      const objValue = keyExists ? obj[key] : undefined;
      const isNullable = isFieldNullable(schemaValue);

      // Check if using new format schema
      if (isNewFormatSchema(schemaValue)) {
        // New format: check required first
        if (!keyExists || objValue === null || objValue === undefined) {
          if (!isNullable) {
            missingFields.push(fullKey);
          }
          continue; // Skip further validation if field doesn't exist and is nullable
        }

        const actualSchemaValue = getSchemaValue(schemaValue);
        
        // Validate enum if typeData exists
        const enumValues = getEnumValues(schemaValue);
        if (enumValues && enumValues.length > 0) {
          if (!enumValues.includes(objValue)) {
            enumErrors.push({
              field: fullKey,
              error: `Value "${objValue}" is not allowed`,
              allowedValues: enumValues
            });
          }
        }

        // Handle nested objects
        if (actualSchemaValue !== null &&
            typeof actualSchemaValue === 'object' &&
            !Array.isArray(actualSchemaValue) &&
            Object.keys(actualSchemaValue).length > 0) {
          
          if (typeof objValue === 'object' && !Array.isArray(objValue) && objValue !== null) {
            // Validate nested properties recursively
            checkFields(objValue, actualSchemaValue, fullKey);
          } else {
            // Type validation for nested object
            const typeValidation = validateType(objValue, 'object', fullKey);
            if (!typeValidation.valid) {
              typeErrors.push({
                field: fullKey,
                error: typeValidation.error || 'Invalid type'
              });
            }
          }
        } else {
          // Validate primitive type
          const expectedType = typeof actualSchemaValue === 'string' ? actualSchemaValue : 
                               typeof actualSchemaValue;
          
          if (expectedType === 'string' && typeof actualSchemaValue === 'string') {
            // Type specified as string in value
            const typeValidation = validateType(objValue, 'string', fullKey);
            if (!typeValidation.valid) {
              typeErrors.push({
                field: fullKey,
                error: typeValidation.error || 'Invalid type'
              });
            }
          } else {
            // Type validation based on example value type
            const expectedTypeStr = typeof actualSchemaValue;
            const typeValidation = validateType(objValue, expectedTypeStr, fullKey);
            if (!typeValidation.valid && expectedTypeStr !== 'object') {
              typeErrors.push({
                field: fullKey,
                error: typeValidation.error || 'Invalid type'
              });
            }
          }
        }
      } else {
        // Old format: backward compatibility
        if (schemaValue !== null && 
            typeof schemaValue === 'object' && 
            !Array.isArray(schemaValue) &&
            Object.keys(schemaValue).length > 0) {
          
          if (keyExists && objValue !== null && typeof objValue === 'object' && !Array.isArray(objValue)) {
            // Key exists and is an object, validate nested properties recursively
            checkFields(objValue, schemaValue, fullKey);
          } else if (!keyExists || objValue === null || objValue === undefined) {
            // Key doesn't exist or is null/undefined
            missingFields.push(fullKey);
          }
        } else {
          // Primitive value or empty object/array - just check if key exists
          if (!keyExists) {
            missingFields.push(fullKey);
          }
        }
      }
    }
  }

  checkFields(reqBody, schema);

  const hasErrors = missingFields.length > 0 || typeErrors.length > 0 || enumErrors.length > 0;

  return {
    valid: !hasErrors,
    missingFields,
    typeErrors,
    enumErrors
  };
}
  
  // Validate request headers against schema
  export function validateRequestHeaders(reqHeaders: any, schema: any): { valid: boolean; missingHeaders: string[] } {
    if (!schema) {
      return { valid: true, missingHeaders: [] };
    }

    const missingHeaders: string[] = [];
    
    // Headers are case-insensitive, so we need to check both cases
    const normalizeHeader = (header: string): string => {
      return header.toLowerCase();
    };
    
    // Create normalized header map from request
    const normalizedReqHeaders: { [key: string]: string } = {};
    for (const key in reqHeaders) {
      normalizedReqHeaders[normalizeHeader(key)] = reqHeaders[key];
    }

    // Check each required header in schema
    for (const headerKey in schema) {
      const normalizedKey = normalizeHeader(headerKey);
      
      if (!(normalizedKey in normalizedReqHeaders)) {
        missingHeaders.push(headerKey);
      }
    }

    return {
      valid: missingHeaders.length === 0,
      missingHeaders
    };
  }

  // Validate request query parameters against schema
  export function validateRequestQuery(reqQuery: any, schema: any): { 
    valid: boolean; 
    missingParams: string[];
    typeErrors: Array<{ field: string; error: string }>;
    enumErrors: Array<{ field: string; error: string; allowedValues: string[] }>;
  } {
    if (!schema) {
      return { valid: true, missingParams: [], typeErrors: [], enumErrors: [] };
    }

    const missingParams: string[] = [];
    const typeErrors: Array<{ field: string; error: string }> = [];
    const enumErrors: Array<{ field: string; error: string; allowedValues: string[] }> = [];

    for (const key in schema) {
      const schemaValue = schema[key];
      const queryValue = reqQuery[key];
      const keyExists = queryValue !== undefined && queryValue !== null;

      // Check if using new format schema
      if (isNewFormatSchema(schemaValue)) {
        const isNullable = isFieldNullable(schemaValue);
        const actualSchemaValue = getSchemaValue(schemaValue);
        const enumValues = getEnumValues(schemaValue);

        // Check required
        if (!keyExists) {
          if (!isNullable) {
            missingParams.push(key);
          }
          continue;
        }

        // Validate enum if typeData exists
        if (enumValues && enumValues.length > 0) {
          const stringValue = String(queryValue);
          if (!enumValues.includes(stringValue)) {
            enumErrors.push({
              field: key,
              error: `Value "${stringValue}" is not allowed`,
              allowedValues: enumValues
            });
          }
        }

        // Validate type
        if (typeof actualSchemaValue === 'string') {
          const expectedType = actualSchemaValue.toLowerCase();
          const typeValidation = validateType(queryValue, expectedType, key);
          if (!typeValidation.valid) {
            typeErrors.push({
              field: key,
              error: typeValidation.error || 'Invalid type'
            });
          }
        }
      } else {
        // Old format: just check if exists
        if (!keyExists) {
          missingParams.push(key);
        }
      }
    }

    const hasErrors = missingParams.length > 0 || typeErrors.length > 0 || enumErrors.length > 0;

    return {
      valid: !hasErrors,
      missingParams,
      typeErrors,
      enumErrors
    };
  }