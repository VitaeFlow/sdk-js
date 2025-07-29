/**
 * Result types for VitaeFlow SDK operations
 */

import { Resume } from './resume';

export interface ValidationIssue {
  /**
   * Type of issue
   */
  type: 'schema' | 'rule';

  /**
   * Severity level
   */
  severity: 'error' | 'warning';

  /**
   * Human-readable message
   */
  message: string;

  /**
   * JSON path to the problematic field (for schema issues)
   */
  path?: string;

  /**
   * Rule ID that generated this issue (for rule issues)
   */
  ruleId?: string;

  /**
   * Additional context or details
   */
  context?: Record<string, any>;
}

export interface ValidationResult {
  /**
   * Whether validation passed (no errors, warnings allowed)
   */
  ok: boolean;

  /**
   * Whether schema validation passed
   */
  schemaValid: boolean;

  /**
   * Whether business rules validation passed
   */
  rulesValid: boolean;

  /**
   * Schema version used for validation
   */
  version: string;

  /**
   * All validation issues found
   */
  issues: ValidationIssue[];
}

export interface ExtractResult {
  /**
   * Whether extraction was successful
   */
  ok: boolean;

  /**
   * Extracted resume data (if successful)
   */
  data?: Resume;

  /**
   * Technical metadata about the embedded file
   */
  metadata?: {
    version: string;
    checksum: string;
    checksumValid: boolean;
    created: string;
    compressed: boolean;
    fileSize: number;
  };

  /**
   * XMP metadata (if includeXMP option was true)
   */
  xmp?: {
    hasStructuredData: boolean;
    specVersion: string;
    candidateName?: string;
    candidateEmail?: string;
  };

  /**
   * All validation issues found during extraction
   */
  issues: ValidationIssue[];

  /**
   * Error message if extraction failed
   */
  error?: string;

  /**
   * Whether data was migrated to a newer version
   */
  migrated?: boolean;

  /**
   * Original version if data was migrated
   */
  migratedFrom?: string;
}

export interface MigrationResult {
  /**
   * Whether migration was successful
   */
  ok: boolean;

  /**
   * Migrated resume data (if successful)
   */
  data?: Resume;

  /**
   * Error message if migration failed
   */
  error?: string;

  /**
   * Source version
   */
  fromVersion: string;

  /**
   * Target version
   */
  toVersion: string;

  /**
   * Migration steps that were applied
   */
  steps: string[];
}