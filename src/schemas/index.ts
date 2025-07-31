/**
 * Schema management with auto-download capabilities
 * Supports local schemas (@vitaeflow/vitae-schema) and remote download from $schema URLs
 */

import { CURRENT_VERSION } from '../constants';
import { Resume, VitaeFlowDocument } from '../types/resume';

// Local schema API - conditional import for Node.js vs Browser
let schemaAPI: any;

if (typeof window === 'undefined' && typeof process !== 'undefined') {
  // Node.js environment
  try {
    schemaAPI = require('@vitaeflow/vitae-schema');
  } catch (error) {
    schemaAPI = null;
  }
} else {
  // Browser environment - try to use global VitaeFlowSchema if available
  if (typeof window !== 'undefined' && (window as any).VitaeFlowSchema) {
    schemaAPI = (window as any).VitaeFlowSchema;
  } else {
    schemaAPI = null;
  }
}

// Schema cache for remote downloads (in-memory, TTL: 1 hour)
const schemaCache = new Map<string, { schema: any; timestamp: number; ttl: number }>();
const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Validate if a schema URL is from an official VitaeFlow source
 */
function isValidSchemaUrl(url: string): boolean {
  return url.startsWith('https://vitaeflow.org/schemas/') ||
         url.startsWith('https://vitaeflow.github.io/vitaeflow-schemas/') ||
         url.startsWith('https://cdn.jsdelivr.net/npm/@vitaeflow/vitae-schema');
}

/**
 * Fetch schema from remote URL with timeout and error handling
 */
async function fetchSchemaFromUrl(url: string, timeout: number = 5000): Promise<any> {
  if (!isValidSchemaUrl(url)) {
    throw new Error(`Invalid schema URL: ${url}. Only official VitaeFlow URLs are allowed.`);
  }

  // Check cache first
  const cached = schemaCache.get(url);
  if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
    return cached.schema;
  }

  let schema: any;

  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    // Browser environment
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      schema = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } else if (typeof require !== 'undefined') {
    // Node.js environment
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    schema = await new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const request = protocol.get(url, { timeout }, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        let data = '';
        response.on('data', (chunk: string) => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error}`));
          }
        });
      });
      
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });
    });
  } else {
    throw new Error('No HTTP client available for fetching remote schema');
  }

  // Cache the result
  schemaCache.set(url, {
    schema,
    timestamp: Date.now(),
    ttl: DEFAULT_CACHE_TTL
  });

  return schema;
}

/**
 * Options for schema retrieval
 */
export interface SchemaOptions {
  useRemoteSchema?: boolean;      // Enable auto-download from $schema URL
  cacheSchema?: boolean;          // Cache downloaded schemas
  fallbackToLocal?: boolean;      // Fallback to local package if remote fails
  remoteTimeout?: number;         // Timeout for remote fetch (ms)
  schemaUrl?: string;            // Explicit schema URL to download from
}

/**
 * Find the most compatible local version for a requested version
 * Implements forward-compatibility logic for graceful handling of future versions
 */
export function findCompatibleVersion(requestedVersion: string, availableVersions: string[]): string | null {
  if (!requestedVersion || !availableVersions.length) return null;
  
  // Try exact match first
  if (availableVersions.includes(requestedVersion)) {
    return requestedVersion;
  }
  
  const versionParts = requestedVersion.split('.').map(Number);
  const reqMajor = versionParts[0] || 0;
  const reqMinor = versionParts[1] || 0;
  const reqPatch = versionParts[2] || 0;
  
  // Validate that we have valid numbers and proper version format
  if (isNaN(reqMajor) || isNaN(reqMinor) || isNaN(reqPatch) || versionParts.length < 3) {
    return null;
  }
  
  const parsedVersions = availableVersions
    .map(v => {
      const parts = v.split('.').map(Number);
      return { 
        version: v, 
        major: parts[0] || 0, 
        minor: parts[1] || 0, 
        patch: parts[2] || 0 
      };
    });
  
  // Forward compatibility strategy:
  // 1. Same major version - backward compatible (newer minor/patch versions can read older data)
  // 2. Prefer the latest available version within the same major
  const compatibleVersions = parsedVersions
    .filter(v => {
      // Same major version - both backward and forward compatible within major
      if (v.major === reqMajor) {
        return true;
      }
      
      // For now, we don't support cross-major version compatibility
      // Future: could add specific migration rules here
      return false;
    })
    .sort((a, b) => {
      // Prefer closest version, but lean towards newer for forward compatibility
      const aDiff = Math.abs((a.minor * 100 + a.patch) - (reqMinor * 100 + reqPatch));
      const bDiff = Math.abs((b.minor * 100 + b.patch) - (reqMinor * 100 + reqPatch));
      
      if (aDiff !== bDiff) {
        return aDiff - bDiff; // Closest version first
      }
      
      // If equal distance, prefer newer version for forward compatibility
      if (a.minor !== b.minor) return b.minor - a.minor;
      return b.patch - a.patch;
    });
  
  return compatibleVersions[0]?.version || null;
}

/**
 * Create a minimal fallback schema for validation
 */
function createMinimalSchema(version: string): any {
  // Check if this is a legacy version (1.x.x format)
  const isLegacy = version.startsWith('1.');
  
  if (isLegacy) {
    // Create legacy schema for v1.x.x
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: `https://vitaeflow.org/schemas/v${version}/legacy-fallback.json`,
      title: `Legacy VitaeFlow Schema v${version} (Fallback)`,
      type: 'object',
      properties: {
        $schema: { type: 'string' },
        schema_version: { type: 'string' },
        personal_information: { 
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string', format: 'email' }
          },
          required: ['first_name', 'last_name', 'email']
        },
        work_experience: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              company: { type: 'string' },
              position: { type: 'string' },
              start_date: { type: 'string' }
            },
            required: ['company', 'position', 'start_date']
          }
        }
      },
      required: ['schema_version', 'personal_information'],
      additionalProperties: true
    };
  }
  
  // Modern v0.x.x schema
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: `https://vitaeflow.org/schemas/v${version}/fallback.json`,
    title: `Minimal VitaeFlow Schema v${version} (Fallback)`,
    type: 'object',
    properties: {
      $schema: { type: 'string' },
      specVersion: { type: 'string' },
      meta: { 
        type: 'object',
        properties: {
          language: { type: 'string' },
          country: { type: 'string' }
        },
        required: ['language', 'country']
      },
      resume: { 
        type: 'object',
        properties: {
          basics: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string', format: 'email' }
            },
            required: ['firstName', 'lastName', 'email']
          }
        },
        required: ['basics']
      }
    },
    required: ['specVersion', 'meta', 'resume'],
    additionalProperties: true
  };
}

/**
 * Get resume schema for a specific version with auto-download capabilities
 */
export async function getResumeSchema(
  version: string, 
  options: SchemaOptions = {}
): Promise<any> {
  const {
    useRemoteSchema = false,
    cacheSchema = true,
    fallbackToLocal = true,
    remoteTimeout = 5000,
    schemaUrl
  } = options;

  // Try remote download first if enabled
  if (useRemoteSchema && schemaUrl) {
    try {
      const remoteSchema = await fetchSchemaFromUrl(schemaUrl, remoteTimeout);
      return remoteSchema;
    } catch (error) {
      console.warn(`Failed to fetch remote schema from ${schemaUrl}:`, error);
      if (!fallbackToLocal) {
        throw new Error(`Remote schema fetch failed and fallback disabled: ${error}`);
      }
    }
  }

  // Try local schema package
  if (schemaAPI) {
    try {
      const schema = schemaAPI.getSchema(version);
      if (schema) {
        return schema;
      }
    } catch (error) {
      console.warn(`Local schema version ${version} not found:`, error);
    }

    // Try to find compatible version
    try {
      const availableVersions = schemaAPI.getAvailableVersions();
      const compatibleVersion = findCompatibleVersion(version, availableVersions);
      
      if (compatibleVersion) {
        console.warn(`Using compatible schema version ${compatibleVersion} for requested ${version}`);
        return schemaAPI.getSchema(compatibleVersion);
      }
    } catch (error) {
      console.warn('Failed to find compatible schema version:', error);
    }
  }

  // Last resort: create minimal fallback schema
  console.warn(`Creating minimal fallback schema for version ${version}`);
  return createMinimalSchema(version);
}

/**
 * Synchronous version of getResumeSchema for backward compatibility
 */
export function getResumeSchemaSync(version: string): any {
  if (schemaAPI) {
    try {
      const schema = schemaAPI.getSchema(version);
      if (schema) {
        return schema;
      }
    } catch (error) {
      console.warn(`Schema version ${version} not found locally`);
    }

    // Try compatible version
    try {
      const availableVersions = schemaAPI.getAvailableVersions();
      const compatibleVersion = findCompatibleVersion(version, availableVersions);
      
      if (compatibleVersion) {
        return schemaAPI.getSchema(compatibleVersion);
      }
    } catch (error) {
      // Fall through to minimal schema
    }
  }

  // Return minimal schema
  return createMinimalSchema(version);
}

/**
 * Get all available schema versions
 */
export function getAvailableSchemaVersions(): string[] {
  if (schemaAPI) {
    try {
      return schemaAPI.getAvailableVersions();
    } catch (error) {
      console.warn('Failed to load official schema versions');
      return [CURRENT_VERSION];
    }
  }
  
  // Fallback when schemaAPI is not available
  return [CURRENT_VERSION];
}

/**
 * Check if a version is supported (locally or can be fetched remotely)
 */
export function isVersionSupported(version: string): boolean {
  const localVersions = getAvailableSchemaVersions();
  return localVersions.includes(version);
}

/**
 * Get schema URL for auto-download based on data
 */
export function extractSchemaUrlFromData(data: any): string | null {
  if (data && typeof data === 'object') {
    return data.$schema || null;
  }
  return null;
}

/**
 * Detect version from resume data
 * Supports both new VitaeFlow format (specVersion) and legacy format (schema_version)
 */
export function detectVersionFromData(data: any): string {
  if (data && typeof data === 'object') {
    // Check for new VitaeFlow format first
    if (data.specVersion && typeof data.specVersion === 'string') {
      return data.specVersion;
    }
    
    // Check for legacy format
    if (data.schema_version && typeof data.schema_version === 'string') {
      return data.schema_version;
    }
    
    // Check $schema URL for version info
    if (data.$schema && typeof data.$schema === 'string') {
      // Match new format: schemas/v0.1.0/vitaeflow.schema.json
      const newMatch = data.$schema.match(/schemas\/v(\d+\.\d+\.\d+)\/vitaeflow\.schema\.json/);
      if (newMatch) {
        return newMatch[1];
      }
      
      // Match legacy format: v1.0.0.json
      const legacyMatch = data.$schema.match(/v(\d+\.\d+\.\d+)\.json/);
      if (legacyMatch) {
        return legacyMatch[1];
      }
    }
  }
  
  // Default to current version
  return CURRENT_VERSION;
}

/**
 * Create schema-aware validation function
 */
export async function getSchemaForData(
  data: any, 
  options: SchemaOptions = {}
): Promise<any> {
  const version = detectVersionFromData(data);
  const schemaUrl = extractSchemaUrlFromData(data);
  
  const schemaOptions: SchemaOptions = { ...options };
  
  const finalSchemaUrl = schemaUrl || options.schemaUrl;
  if (finalSchemaUrl) {
    schemaOptions.schemaUrl = finalSchemaUrl;
    // Auto-enable remote schema fetching when $schema URL is present
    if (schemaOptions.useRemoteSchema === undefined) {
      schemaOptions.useRemoteSchema = true;
    }
  }
  
  return getResumeSchema(version, schemaOptions);
}