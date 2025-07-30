/**
 * Schema imports and exports
 * TODO: Import from @vitaeflow/spec when available
 */

import { CURRENT_VERSION } from '../constants';

// Temporary schema definition until @vitaeflow/spec is available
const RESUME_SCHEMA_V1 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vitaeflow.org/schemas/resume/v1.0.0.json',
  title: 'VitaeFlow Resume Schema v1.0.0',
  type: 'object',
  properties: {
    schema_version: {
      type: 'string',
      const: '1.0.0',
    },
    personal_information: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { 
          type: 'string',
          format: 'email',
        },
        phone: { type: 'string' },
        address: { type: 'string' },
      },
      additionalProperties: true,
    },
    work_experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          position: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['company', 'position', 'start_date'],
        additionalProperties: true,
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          institution: { type: 'string' },
          degree: { type: 'string' },
          field_of_study: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
        },
        required: ['institution', 'degree', 'field_of_study', 'start_date'],
        additionalProperties: true,
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          level: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
};

/**
 * Get resume schema for a specific version
 */
export function getResumeSchema(version: string): any {
  switch (version) {
    case '1.0.0':
      return RESUME_SCHEMA_V1;
    default:
      // For unknown versions, return the current schema
      if (version === CURRENT_VERSION) {
        return RESUME_SCHEMA_V1;
      }
      return null;
  }
}

/**
 * Get all available schema versions
 */
export function getAvailableVersions(): string[] {
  return ['1.0.0'];
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  return getAvailableVersions().includes(version);
}