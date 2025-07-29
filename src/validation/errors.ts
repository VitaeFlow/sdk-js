/**
 * Error handling for VitaeFlow SDK
 */

import { ValidationResult } from '../types/results';

/**
 * Error codes for VitaeFlow operations
 */
export enum ErrorCode {
  INVALID_PDF = 'INVALID_PDF',
  ENCRYPTED_PDF = 'ENCRYPTED_PDF',
  CORRUPTED_PDF = 'CORRUPTED_PDF',
  NO_RESUME_FOUND = 'NO_RESUME_FOUND',
  INVALID_RESUME_DATA = 'INVALID_RESUME_DATA',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
}

/**
 * Base error class for VitaeFlow SDK
 */
export class VitaeFlowError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, any>;
  public readonly validation?: ValidationResult;

  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, any>,
    validation?: ValidationResult
  ) {
    super(message);
    this.name = 'VitaeFlowError';
    this.code = code;
    
    // Only assign optional properties if they are provided
    if (context !== undefined) {
      this.context = context;
    }
    if (validation !== undefined) {
      this.validation = validation;
    }

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, VitaeFlowError.prototype);
  }

  /**
   * Create a VitaeFlowError from an ErrorCode and message
   */
  static create(
    code: ErrorCode,
    message: string,
    context?: Record<string, any>
  ): VitaeFlowError {
    return new VitaeFlowError(code, message, context);
  }

  /**
   * Create a validation error with validation details
   */
  static validation(
    message: string,
    validationResult: ValidationResult,
    context?: Record<string, any>
  ): VitaeFlowError {
    return new VitaeFlowError(
      ErrorCode.VALIDATION_FAILED,
      message,
      context,
      validationResult
    );
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      validation: this.validation,
      stack: this.stack,
    };
  }
}

/**
 * Error messages for each error code
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_PDF]: 'The provided file is not a valid PDF document',
  [ErrorCode.ENCRYPTED_PDF]: 'The PDF is encrypted and cannot be processed',
  [ErrorCode.CORRUPTED_PDF]: 'The PDF structure is corrupted or invalid',
  [ErrorCode.NO_RESUME_FOUND]: 'No VitaeFlow resume data found in the PDF',
  [ErrorCode.INVALID_RESUME_DATA]: 'The resume data is invalid or corrupted',
  [ErrorCode.UNSUPPORTED_VERSION]: 'Unsupported VitaeFlow specification version',
  [ErrorCode.VALIDATION_FAILED]: 'Resume data validation failed',
  [ErrorCode.MIGRATION_FAILED]: 'Failed to migrate resume data to target version',
  [ErrorCode.CHECKSUM_MISMATCH]: 'Resume data integrity check failed (checksum mismatch)',
  [ErrorCode.FILE_TOO_LARGE]: 'Resume data exceeds maximum allowed size',
};

/**
 * Helper function to create errors with default messages
 */
export function createError(
  code: ErrorCode,
  customMessage?: string,
  context?: Record<string, any>
): VitaeFlowError {
  const message = customMessage || ERROR_MESSAGES[code];
  return VitaeFlowError.create(code, message, context);
}