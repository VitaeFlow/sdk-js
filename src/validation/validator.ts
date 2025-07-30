/**
 * Resume validation system
 * Provides schema and business rules validation with version support
 */

import Ajv, { ErrorObject } from 'ajv';
import { Resume } from '../types/resume';
import { ValidationOptions, ValidationResult, ValidationIssue, Rule } from '../types';
import { CURRENT_VERSION, DEFAULT_VALIDATION_OPTIONS } from '../constants';
import { getResumeSchema } from '../schemas';

/**
 * Main validator class for resume data
 */
export class ResumeValidator {
  private ajv: Ajv;
  private customRules: Rule[] = [];

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false, // Allow additional properties
      removeAdditional: false,
    });
  }

  /**
   * Validate resume data with schema and rules
   */
  async validate(
    data: any,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const opts = { 
      ...DEFAULT_VALIDATION_OPTIONS, 
      ...options,
      skipRules: options.skipRules || [],
    };
    
    // Handle maxIssues properly
    if (options.maxIssues === undefined) {
      delete (opts as any).maxIssues;
    }
    
    // Step 1: Detect or use provided version
    const version = opts.version || this.detectVersion(data);
    
    // Step 2: Load and compile schema
    const schema = getResumeSchema(version);
    if (!schema) {
      return {
        ok: false,
        schemaValid: false,
        rulesValid: false,
        version,
        issues: [{
          type: 'schema',
          severity: 'error',
          message: `No schema available for version ${version}`,
          path: 'schema_version',
        }],
      };
    }
    
    const validate = this.ajv.compile(schema);
    
    // Step 3: Validate against schema
    const schemaValid = validate(data);
    const schemaIssues = this.convertAjvErrors(validate.errors || []);
    
    // Step 4: Apply business rules if enabled
    let rulesIssues: ValidationIssue[] = [];
    let rulesValid = true;
    
    if (opts.validateRules && opts.mode !== 'lenient') {
      // Create properly typed options for validateRules
      const rulesOptions: ValidationOptions = {
        mode: opts.mode,
        validateRules: opts.validateRules,
        skipRules: opts.skipRules,
      };
      
      if (opts.version) {
        rulesOptions.version = opts.version;
      }
      
      if (opts.customRules) {
        rulesOptions.customRules = opts.customRules;
      }
      
      if (opts.maxIssues !== undefined) {
        rulesOptions.maxIssues = opts.maxIssues;
      }
      
      const rulesResult = await this.validateRules(data, version, rulesOptions);
      rulesIssues = rulesResult.issues;
      rulesValid = rulesResult.valid;
    }
    
    // Step 5: Combine all issues
    const allIssues = [...schemaIssues, ...rulesIssues];
    
    // Step 6: Apply maxIssues limit if specified
    const issues = (opts.maxIssues !== undefined) ? allIssues.slice(0, opts.maxIssues) : allIssues;
    
    // Step 7: Calculate overall success
    const hasErrors = issues.some(issue => issue.severity === 'error');
    
    return {
      ok: !hasErrors,
      schemaValid,
      rulesValid,
      version,
      issues,
    };
  }

  /**
   * Add a custom validation rule
   */
  addCustomRule(rule: Rule): void {
    this.customRules.push(rule);
  }

  /**
   * Remove a custom validation rule
   */
  removeCustomRule(ruleId: string): void {
    this.customRules = this.customRules.filter(rule => rule.id !== ruleId);
  }

  /**
   * Get all custom rules
   */
  getCustomRules(): Rule[] {
    return [...this.customRules];
  }

  /**
   * Detect version from resume data
   */
  private detectVersion(data: any): string {
    if (data?.schema_version && typeof data.schema_version === 'string') {
      return data.schema_version;
    }
    
    if (data?.$schema && typeof data.$schema === 'string') {
      const match = data.$schema.match(/v(\d+\.\d+\.\d+)/);
      if (match) {
        return match[1];
      }
    }
    
    return CURRENT_VERSION;
  }

  /**
   * Convert AJV errors to ValidationIssues
   */
  private convertAjvErrors(errors: ErrorObject[]): ValidationIssue[] {
    return errors.map(error => {
      const issue: ValidationIssue = {
        type: 'schema',
        severity: 'error',
        message: `${error.instancePath || 'root'} ${error.message}`,
        context: {
          keyword: error.keyword,
          params: error.params,
          data: error.data,
        },
      };
      
      if (error.instancePath) {
        issue.path = error.instancePath;
      }
      
      return issue;
    });
  }

  /**
   * Validate business rules
   */
  private async validateRules(
    data: any, 
    version: string, 
    options: ValidationOptions
  ): Promise<{ valid: boolean; issues: ValidationIssue[] }> {
    const issues: ValidationIssue[] = [];
    
    // Get core rules for version (stub for now)
    const coreRules = this.getCoreRulesForVersion(version);
    
    // Combine with custom rules
    const allRules = [
      ...coreRules,
      ...(options.customRules || []),
      ...this.customRules,
    ];
    
    // Filter out skipped rules
    const activeRules = allRules.filter(rule => 
      !options.skipRules?.includes(rule.id)
    );
    
    // Execute all rules
    for (const rule of activeRules) {
      try {
        const result = rule.validate(data);
        if (!result.valid) {
          issues.push(...result.issues);
        }
      } catch (error) {
        issues.push({
          type: 'rule',
          severity: 'error',
          message: `Rule ${rule.id} failed: ${error}`,
          ruleId: rule.id,
        });
      }
    }
    
    const valid = issues.every(issue => issue.severity !== 'error');
    return { valid, issues };
  }

  /**
   * Get core validation rules for a specific version
   * This is a stub that will be enhanced in Phase 3
   */
  private getCoreRulesForVersion(version: string): Rule[] {
    const coreRules: Rule[] = [
      {
        id: 'required-sections',
        message: 'Resume must have at least one of: personal information, work experience, or education',
        severity: 'error',
        validate: (resume: any) => {
          const hasPersonal = resume.personal_information && 
            Object.keys(resume.personal_information).length > 0;
          const hasWork = resume.work_experience && 
            Array.isArray(resume.work_experience) && 
            resume.work_experience.length > 0;
          const hasEducation = resume.education && 
            Array.isArray(resume.education) && 
            resume.education.length > 0;
          
          const valid = hasPersonal || hasWork || hasEducation;
          
          return {
            valid,
            issues: valid ? [] : [{
              type: 'rule',
              severity: 'error',
              message: 'Resume must have at least one of: personal information, work experience, or education',
              ruleId: 'required-sections',
            }],
          };
        },
      },
      {
        id: 'email-format',
        message: 'Email addresses must be valid',
        severity: 'error',
        validate: (resume: any) => {
          const issues: ValidationIssue[] = [];
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          
          // Check personal information email
          if (resume.personal_information?.email) {
            if (!emailRegex.test(resume.personal_information.email)) {
              issues.push({
                type: 'rule',
                severity: 'error',
                message: 'Invalid email format in personal information',
                ruleId: 'email-format',
                path: 'personal_information.email',
              });
            }
          }
          
          return {
            valid: issues.length === 0,
            issues,
          };
        },
      },
    ];
    
    return coreRules;
  }
}

// Global validator instance
const globalValidator = new ResumeValidator();

/**
 * Validate resume data (convenience function)
 */
export async function validateResume(
  data: any,
  options?: ValidationOptions
): Promise<ValidationResult> {
  return globalValidator.validate(data, options);
}

/**
 * Add a custom validation rule globally
 */
export function addCustomRule(rule: Rule): void {
  globalValidator.addCustomRule(rule);
}

/**
 * Remove a custom validation rule globally
 */
export function removeCustomRule(ruleId: string): void {
  globalValidator.removeCustomRule(ruleId);
}