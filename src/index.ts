/**
 * VitaeFlow SDK - JavaScript/TypeScript SDK for embedding structured resume data in PDFs
 * 
 * @packageDocumentation
 */

// Core functions
export { embedResume } from './pdf/embed';
export { extractResume } from './pdf/extract';

// Aliases for compatibility
export { embedResume as embedResumeInPDF } from './pdf/embed';
export { extractResume as extractResumeFromPDF } from './pdf/extract';
export { hasResume, hasResumeDetailed } from './pdf/utils';

// Types
export type {
  Resume,
  EmbedOptions,
  ExtractOptions,
  ValidationOptions,
  Rule,
  ValidationIssue,
  ValidationResult,
  ExtractResult,
  MigrationResult,
  HasResumeResult,
} from './types';

// Error handling
export { VitaeFlowError, ErrorCode } from './validation/errors';

// Constants
export {
  CURRENT_VERSION,
  COMPRESS_THRESHOLD,
  MAX_FILE_SIZE,
  RESUME_FILENAME,
  VITAEFLOW_NAMESPACE,
  CHECKSUM_ALGORITHM,
} from './constants';

// Validation and migration
export { 
  validateResume, 
  addCustomRule, 
  removeCustomRule,
  addCustomRules,
  removeRulesByCategory,
  getRulesByCategory,
  listCustomRules,
  getCustomRuleById
} from './validation/validator';
export { migrateResume, canMigrateResume, getVersionCompatibility } from './migration/migrator';

// Utilities (for advanced use cases)
export { calculateChecksum, verifyChecksum } from './utils/checksum';
export { 
  compressData, 
  decompressData, 
  shouldCompress,
  getDataSize 
} from './utils/compression';

// Version info
export const version = '0.1.2';