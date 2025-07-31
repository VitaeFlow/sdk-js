/**
 * Schema imports and exports
 * Uses official VitaeFlow schemas from @vitaeflow/vitae-schema
 */

import { getSchema, getLatestSchema, getAvailableVersions } from '@vitaeflow/vitae-schema';
import { CURRENT_VERSION } from '../constants';
import { Resume, VitaeFlowDocument } from '../types/resume';

// Legacy schema for backward compatibility (v1.0.0 format)
const LEGACY_SCHEMA_V1 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vitaeflow.org/schemas/resume/v1.0.0.json',
  title: 'VitaeFlow Resume Schema v1.0.0 (Legacy)',
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
 * Supports both new VitaeFlow schemas and legacy formats
 */
export function getResumeSchema(version: string): any {
  // Handle legacy v1.0.0 format
  if (version === '1.0.0') {
    return LEGACY_SCHEMA_V1;
  }
  
  // Use official VitaeFlow schemas for v0.1.0+
  try {
    const schema = getSchema(version);
    if (schema) {
      return schema;
    }
  } catch (error) {
    // Schema version not found in official package
    console.warn(`Schema version ${version} not found in @vitaeflow/vitae-schema`);
  }
  
  // Fallback to current version or latest schema
  if (version === CURRENT_VERSION) {
    try {
      return getLatestSchema();
    } catch (error) {
      console.warn('Failed to load latest schema, falling back to legacy');
      return LEGACY_SCHEMA_V1;
    }
  }
  
  return null;
}

/**
 * Get all available schema versions
 * Combines official VitaeFlow versions with legacy support
 */
export function getAvailableSchemaVersions(): string[] {
  try {
    const officialVersions = getAvailableVersions();
    // Include legacy version for backward compatibility
    return ['1.0.0', ...officialVersions];
  } catch (error) {
    console.warn('Failed to load official schema versions, using legacy only');
    return ['1.0.0'];
  }
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  return getAvailableSchemaVersions().includes(version);
}

/**
 * Migrate legacy resume data to VitaeFlow v0.1.0 format
 */
export function migrateLegacyToVitaeFlow(legacyData: Resume): VitaeFlowDocument {
  const personalInfo = legacyData.personal_information || {};
  
  return {
    specVersion: '0.1.0',
    meta: {
      language: 'en',
      country: 'US',
      source: 'legacy-migration',
    },
    resume: {
      basics: {
        firstName: personalInfo.first_name || '',
        lastName: personalInfo.last_name || '',
        email: personalInfo.email || '',
        ...(personalInfo.phone && { phone: personalInfo.phone }),
        ...(personalInfo.full_name && { summary: `Resume for ${personalInfo.full_name}` }),
      },
      ...(legacyData.work_experience && {
        experience: legacyData.work_experience.map(exp => ({
          position: exp.position,
          company: exp.company,
          startDate: exp.start_date,
          ...(exp.end_date && { endDate: exp.end_date }),
          ...(exp.description && { summary: exp.description }),
        }))
      }),
      ...(legacyData.education && {
        education: legacyData.education.map(edu => ({
          institution: edu.institution,
          studyType: edu.degree,
          area: edu.field_of_study,
          startDate: edu.start_date,
          ...(edu.end_date && { endDate: edu.end_date }),
        }))
      }),
      ...(legacyData.skills && {
        skills: {
          technical: legacyData.skills.map(skill => ({
            name: skill.name,
            level: (skill.level?.toLowerCase() as any) || 'intermediate',
          }))
        }
      }),
    },
  };
}

/**
 * Check if data is in legacy format
 */
export function isLegacyFormat(data: any): boolean {
  return data && (
    data.schema_version === '1.0.0' ||
    (data.personal_information && !data.specVersion && !data.resume)
  );
}