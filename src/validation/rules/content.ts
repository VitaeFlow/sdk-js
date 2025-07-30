/**
 * Content validation rules
 */

import { Rule, ValidationIssue } from '../../types';

/**
 * Rule 5: email-format - basic email validation
 */
export const emailFormatRule: Rule = {
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
};

/**
 * Rule 6: required-experience-or-education - at least one section required
 */
export const requiredExperienceOrEducationRule: Rule = {
  id: 'required-experience-or-education',
  message: 'Resume must have at least work experience or education',
  severity: 'error',
  validate: (resume: any) => {
    const hasWork = resume.work_experience && 
      Array.isArray(resume.work_experience) && 
      resume.work_experience.length > 0;
    const hasEducation = resume.education && 
      Array.isArray(resume.education) && 
      resume.education.length > 0;
    
    const valid = hasWork || hasEducation;
    
    return {
      valid,
      issues: valid ? [] : [{
        type: 'rule',
        severity: 'error',
        message: 'Resume must have at least work experience or education section',
        ruleId: 'required-experience-or-education',
      }],
    };
  },
};

/**
 * Rule 7: no-duplicate-entries - avoid duplicate work entries
 */
export const noDuplicateEntriesRule: Rule = {
  id: 'no-duplicate-entries',
  message: 'Avoid duplicate entries with same organization and position',
  severity: 'warning',
  validate: (resume: any) => {
    const issues: ValidationIssue[] = [];
    
    if (resume.work_experience && Array.isArray(resume.work_experience)) {
      const seen = new Map<string, number>();
      
      resume.work_experience.forEach((exp: any, index: number) => {
        if (exp.company && exp.position) {
          const key = `${exp.company.toLowerCase()}|${exp.position.toLowerCase()}`;
          
          if (seen.has(key)) {
            const firstIndex = seen.get(key)!;
            issues.push({
              type: 'rule',
              severity: 'warning',
              message: `Possible duplicate entry: ${exp.position} at ${exp.company} (also found at index ${firstIndex})`,
              ruleId: 'no-duplicate-entries',
              path: `work_experience[${index}]`,
            });
          } else {
            seen.set(key, index);
          }
        }
      });
    }
    
    return {
      valid: true, // Warnings don't affect validity
      issues,
    };
  },
};