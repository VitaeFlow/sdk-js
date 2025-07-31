/**
 * Resume validation system
 * Provides schema and business rules validation with version support
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import { Resume } from '../types/resume';
import { ValidationOptions, ValidationResult, ValidationIssue, Rule } from '../types';
import { CURRENT_VERSION, DEFAULT_VALIDATION_OPTIONS } from '../constants';
import { getResumeSchema, getSchemaForData, SchemaOptions, detectVersionFromData, getAvailableSchemaVersions, findCompatibleVersion } from '../schemas';
import { getCoreRulesForVersion } from './rules';

/**
 * Main validator class for resume data
 */
export class ResumeValidator {
  private ajv: Ajv;
  private customRules: Rule[] = [];
  private static schemaCache = new Map<string, ValidateFunction>();

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
    const detectedVersion = opts.version || detectVersionFromData(data);
    let actualVersion = detectedVersion;
    
    // Step 2: Handle forward compatibility in 'compatible' mode
    if (opts.mode === 'compatible') {
      // In compatible mode, if we have a future version, try to find the best compatible version
      const availableVersions = getAvailableSchemaVersions();
      if (!availableVersions.includes(detectedVersion)) {
        const compatibleVersion = findCompatibleVersion(detectedVersion, availableVersions);
        if (compatibleVersion) {
          actualVersion = compatibleVersion;
          console.warn(`Using compatible schema version ${compatibleVersion} for requested ${detectedVersion}`);
        }
      }
    }
    
    // Step 3: Load and compile schema (with caching and auto-download)
    const cacheKey = `${actualVersion}-${opts.useRemoteSchema}-${opts.schemaUrl}`;
    let validate = ResumeValidator.schemaCache.get(cacheKey);
    
    if (!validate) {
      try {
        // Use new schema resolution with auto-download capabilities
        const schemaOptions: SchemaOptions = {};
        
        if (opts.useRemoteSchema !== undefined) schemaOptions.useRemoteSchema = opts.useRemoteSchema;
        if (opts.cacheSchema !== undefined) schemaOptions.cacheSchema = opts.cacheSchema;
        if (opts.fallbackToLocal !== undefined) schemaOptions.fallbackToLocal = opts.fallbackToLocal;
        if (opts.remoteTimeout !== undefined) schemaOptions.remoteTimeout = opts.remoteTimeout;
        if (opts.schemaUrl !== undefined) schemaOptions.schemaUrl = opts.schemaUrl;
        
        let schema = await getSchemaForData(data, schemaOptions);
        
        if (!schema) {
          return {
            ok: false,
            schemaValid: false,
            rulesValid: false,
            version: detectedVersion,
            issues: [{
              type: 'schema',
              severity: 'error',
              message: `No schema available for version ${detectedVersion}`,
              path: 'specVersion',
            }],
          };
        }
        
        // In compatible mode, make schema more lenient for version fields
        if (opts.mode === 'compatible' && actualVersion !== detectedVersion) {
          schema = { ...schema };
          
          // Remove strict version constraints
          if (schema.properties?.specVersion?.const) {
            schema.properties.specVersion = { type: 'string' };
          }
          if (schema.properties?.schema_version?.const) {
            schema.properties.schema_version = { type: 'string' };
          }
        }
        
        validate = this.ajv.compile(schema);
        ResumeValidator.schemaCache.set(cacheKey, validate);
        
      } catch (error) {
        return {
          ok: false,
          schemaValid: false,
          rulesValid: false,
          version: detectedVersion,
          issues: [{
            type: 'schema',
            severity: 'error',
            message: `Schema loading failed: ${error}`,
            path: 'specVersion',
          }],
        };
      }
    }
    
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
      
      const rulesResult = await this.validateRules(data, actualVersion, rulesOptions);
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
      version: detectedVersion, // Return the original detected version
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
   * Validate business rules with priority ordering and enhanced error handling
   */
  private async validateRules(
    data: any, 
    version: string, 
    options: ValidationOptions
  ): Promise<{ valid: boolean; issues: ValidationIssue[] }> {
    const issues: ValidationIssue[] = [];
    
    // Get core rules for version
    const coreRules = this.getCoreRulesForVersion(version);
    
    // Combine with custom rules
    const allRules = [
      ...coreRules,
      ...(options.customRules || []),
      ...this.customRules,
    ];
    
    // Filter out skipped rules and apply version compatibility
    const activeRules = allRules.filter(rule => {
      // Skip if explicitly excluded
      if (options.skipRules?.includes(rule.id)) {
        return false;
      }
      
      // Check version compatibility if appliesTo is specified
      if (rule.appliesTo) {
        // For now, assume all rules apply to all versions
        // Future: Implement semver compatibility check when needed
      }
      
      return true;
    });
    
    // Sort rules by priority (lower numbers first, default 5)
    const sortedRules = activeRules.sort((a, b) => {
      const priorityA = a.priority ?? 5;
      const priorityB = b.priority ?? 5;
      return priorityA - priorityB;
    });
    
    // Execute all rules in priority order
    for (const rule of sortedRules) {
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
          context: {
            category: rule.category,
            priority: rule.priority,
            description: rule.description
          }
        });
      }
    }
    
    const valid = issues.every(issue => issue.severity !== 'error');
    return { valid, issues };
  }

  /**
   * Get core validation rules for a specific version
   */
  private getCoreRulesForVersion(version: string): Rule[] {
    return getCoreRulesForVersion(version);
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

/**
 * Add multiple custom validation rules globally
 * Use case: Installing rule packages like @vitaeflow/rules-healthcare
 */
export function addCustomRules(rules: Rule[]): void {
  rules.forEach(rule => globalValidator.addCustomRule(rule));
}

/**
 * Remove all custom rules matching a specific category
 * Use cases:
 * - Disabling all ATS optimization rules for internal use
 * - Removing compliance rules when changing jurisdictions
 * - Clearing performance rules for development testing
 */
export function removeRulesByCategory(category: string): void {
  const currentRules = globalValidator.getCustomRules();
  const rulesToRemove = currentRules.filter(rule => rule.category === category);
  rulesToRemove.forEach(rule => globalValidator.removeCustomRule(rule.id));
}

/**
 * Get all custom rules in a specific category
 * Use cases:
 * - Auditing active compliance rules
 * - Debugging ATS optimization settings
 * - Generating rule documentation by category
 */
export function getRulesByCategory(category: string): Rule[] {
  return globalValidator.getCustomRules().filter(rule => rule.category === category);
}

/**
 * List all currently registered custom rules
 * Use cases:
 * - Admin interfaces showing active rules
 * - Debugging validation configuration
 * - Rule management dashboards
 */
export function listCustomRules(): Rule[] {
  return globalValidator.getCustomRules();
}

/**
 * Get a specific custom rule by its ID
 * Use cases:
 * - Rule configuration interfaces
 * - Debugging specific rule failures
 * - Dynamic rule modification
 */
export function getCustomRuleById(ruleId: string): Rule | undefined {
  return globalValidator.getCustomRules().find(rule => rule.id === ruleId);
}