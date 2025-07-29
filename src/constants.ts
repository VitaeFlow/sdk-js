/**
 * VitaeFlow SDK Constants
 * Core constants used throughout the SDK
 */

export const CURRENT_VERSION = '1.0.0';

export const COMPRESS_THRESHOLD = 500 * 1024; // 500KB

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const RESUME_FILENAME = 'resume.json';

export const VITAEFLOW_NAMESPACE = 'https://vitaeflow.org/ns/1.0/';

export const CHECKSUM_ALGORITHM = 'SHA-256';

export const VITAEFLOW_SPEC = 'org.vitaeflow.v1';

export const VITAEFLOW_TYPE = 'resume';

export const AF_RELATIONSHIP = 'Data';

export const FILE_DESCRIPTION = 'VitaeFlow Resume Data - Structured CV information';

export const XMP_VITAEFLOW_PREFIX = 'vf';

export const DEFAULT_EMBED_OPTIONS = {
  validate: true,
  validateRules: true,
  compress: 'auto' as const,
  skipXMP: false,
};

export const DEFAULT_EXTRACT_OPTIONS = {
  mode: 'compatible' as const,
  validateRules: true,
  migrateToLatest: false,
  includeXMP: false,
  skipRules: [],
};

export const DEFAULT_VALIDATION_OPTIONS = {
  mode: 'strict' as const,
  validateRules: true,
  skipRules: [],
  maxIssues: undefined,
};