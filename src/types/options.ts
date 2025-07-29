/**
 * Options types for VitaeFlow SDK operations
 */

import { ValidationIssue } from './results';

export interface EmbedOptions {
  /**
   * Whether to validate the resume data before embedding
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to validate business rules in addition to schema
   * @default true
   */
  validateRules?: boolean;

  /**
   * Compression strategy for the embedded JSON data
   * - true: always compress
   * - false: never compress
   * - 'auto': compress if data size > COMPRESS_THRESHOLD
   * @default 'auto'
   */
  compress?: boolean | 'auto';

  /**
   * Whether to skip adding XMP metadata to the PDF catalog
   * @default false
   */
  skipXMP?: boolean;

  /**
   * Custom metadata for future extensions
   */
  customMetadata?: Record<string, any>;
}

export interface ExtractOptions {
  /**
   * Validation mode for extracted data
   * - 'strict': only accept known versions
   * - 'compatible': accept future minor versions
   * - 'lenient': minimal validation
   * @default 'compatible'
   */
  mode?: 'strict' | 'compatible' | 'lenient';

  /**
   * Whether to validate business rules after extraction
   * @default true
   */
  validateRules?: boolean;

  /**
   * Whether to migrate data to the latest version
   * @default false
   */
  migrateToLatest?: boolean;

  /**
   * Whether to include XMP metadata in the result
   * @default false
   */
  includeXMP?: boolean;

  /**
   * Rules to skip during validation
   * @default []
   */
  skipRules?: string[];
}

export interface ValidationOptions {
  /**
   * Schema version to use for validation (auto-detected if not provided)
   */
  version?: string;

  /**
   * Validation mode
   * - 'strict': strict validation with all rules
   * - 'lenient': relaxed validation
   * @default 'strict'
   */
  mode?: 'strict' | 'lenient';

  /**
   * Whether to validate business rules in addition to schema
   * @default true
   */
  validateRules?: boolean;

  /**
   * Rules to skip during validation
   * @default []
   */
  skipRules?: string[];

  /**
   * Custom validation rules to apply
   */
  customRules?: Rule[];

  /**
   * Maximum number of issues to return (unlimited if not specified)
   */
  maxIssues?: number;
}

export interface Rule {
  /**
   * Unique identifier for the rule
   */
  id: string;

  /**
   * Human-readable message describing what the rule validates
   */
  message: string;

  /**
   * Severity of rule violations
   * @default 'error'
   */
  severity?: 'error' | 'warning';

  /**
   * Validation function
   * @param resume - The resume data to validate
   * @returns Validation result with any issues found
   */
  validate: (resume: any) => {
    valid: boolean;
    issues: ValidationIssue[];
  };

  /**
   * Semver pattern specifying which versions this rule applies to
   * If not specified, applies to all versions
   */
  appliesTo?: string;
}