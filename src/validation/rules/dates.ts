/**
 * Date-related validation rules
 */

import { Rule, ValidationIssue } from '../../types';
import { 
  parsePartialDate, 
  isFutureDate, 
  calculateAge, 
  calculateDurationYears, 
  isChronological,
  formatDateForError 
} from '../../utils/dates';

/**
 * Rule 1: dates-chronological - end dates must be after start dates
 */
export const datesChronologicalRule: Rule = {
  id: 'dates-chronological',
  message: 'End dates must be after or equal to start dates',
  severity: 'error',
  validate: (resume: any) => {
    const issues: ValidationIssue[] = [];
    
    // Check work experience dates
    if (resume.work_experience && Array.isArray(resume.work_experience)) {
      resume.work_experience.forEach((exp: any, index: number) => {
        if (exp.start_date && exp.end_date) {
          const startDate = parsePartialDate(exp.start_date);
          const endDate = parsePartialDate(exp.end_date, true);
          
          if (startDate && endDate && !isChronological(startDate, endDate)) {
            issues.push({
              type: 'rule',
              severity: 'error',
              message: `Work experience end date (${formatDateForError(endDate)}) must be after start date (${formatDateForError(startDate)})`,
              ruleId: 'dates-chronological',
              path: `work_experience[${index}]`,
            });
          }
        }
      });
    }
    
    // Check education dates
    if (resume.education && Array.isArray(resume.education)) {
      resume.education.forEach((edu: any, index: number) => {
        if (edu.start_date && edu.end_date) {
          const startDate = parsePartialDate(edu.start_date);
          const endDate = parsePartialDate(edu.end_date, true);
          
          if (startDate && endDate && !isChronological(startDate, endDate)) {
            issues.push({
              type: 'rule',
              severity: 'error',
              message: `Education end date (${formatDateForError(endDate)}) must be after start date (${formatDateForError(startDate)})`,
              ruleId: 'dates-chronological',
              path: `education[${index}]`,
            });
          }
        }
      });
    }
    
    // Check certifications dates
    if (resume.certifications && Array.isArray(resume.certifications)) {
      resume.certifications.forEach((cert: any, index: number) => {
        if (cert.date_obtained && cert.expiry_date) {
          const obtainedDate = parsePartialDate(cert.date_obtained);
          const expiryDate = parsePartialDate(cert.expiry_date, true);
          
          if (obtainedDate && expiryDate && !isChronological(obtainedDate, expiryDate)) {
            issues.push({
              type: 'rule',
              severity: 'error',
              message: `Certification expiry date (${formatDateForError(expiryDate)}) must be after obtained date (${formatDateForError(obtainedDate)})`,
              ruleId: 'dates-chronological',
              path: `certifications[${index}]`,
            });
          }
        }
      });
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  },
};

/**
 * Rule 2: dates-not-future - no future dates except availability
 */
export const datesNotFutureRule: Rule = {
  id: 'dates-not-future',
  message: 'Dates should not be in the future except for availability',
  severity: 'warning',
  validate: (resume: any) => {
    const issues: ValidationIssue[] = [];
    
    // Check birth date
    if (resume.personal_information?.birth_date) {
      const birthDate = parsePartialDate(resume.personal_information.birth_date);
      if (birthDate && isFutureDate(birthDate)) {
        issues.push({
          type: 'rule',
          severity: 'warning',
          message: `Birth date should not be in the future: ${formatDateForError(birthDate)}`,
          ruleId: 'dates-not-future',
          path: 'personal_information.birth_date',
        });
      }
    }
    
    // Check work experience dates
    if (resume.work_experience && Array.isArray(resume.work_experience)) {
      resume.work_experience.forEach((exp: any, index: number) => {
        if (exp.start_date) {
          const startDate = parsePartialDate(exp.start_date);
          if (startDate && isFutureDate(startDate)) {
            issues.push({
              type: 'rule',
              severity: 'warning',
              message: `Work experience start date should not be in the future: ${formatDateForError(startDate)}`,
              ruleId: 'dates-not-future',
              path: `work_experience[${index}].start_date`,
            });
          }
        }
        if (exp.end_date) {
          const endDate = parsePartialDate(exp.end_date);
          if (endDate && isFutureDate(endDate)) {
            issues.push({
              type: 'rule',
              severity: 'warning',
              message: `Work experience end date should not be in the future: ${formatDateForError(endDate)}`,
              ruleId: 'dates-not-future',
              path: `work_experience[${index}].end_date`,
            });
          }
        }
      });
    }
    
    // Check education dates
    if (resume.education && Array.isArray(resume.education)) {
      resume.education.forEach((edu: any, index: number) => {
        if (edu.start_date) {
          const startDate = parsePartialDate(edu.start_date);
          if (startDate && isFutureDate(startDate)) {
            issues.push({
              type: 'rule',
              severity: 'warning',
              message: `Education start date should not be in the future: ${formatDateForError(startDate)}`,
              ruleId: 'dates-not-future',
              path: `education[${index}].start_date`,
            });
          }
        }
        if (edu.end_date) {
          const endDate = parsePartialDate(edu.end_date);
          if (endDate && isFutureDate(endDate)) {
            issues.push({
              type: 'rule',
              severity: 'warning',
              message: `Education end date should not be in the future: ${formatDateForError(endDate)}`,
              ruleId: 'dates-not-future',
              path: `education[${index}].end_date`,
            });
          }
        }
      });
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  },
};

/**
 * Rule 3: birth-date-valid - reasonable age validation
 */
export const birthDateValidRule: Rule = {
  id: 'birth-date-valid',
  message: 'Birth date should result in reasonable age (16-100 years)',
  severity: 'error',
  validate: (resume: any) => {
    const issues: ValidationIssue[] = [];
    
    if (resume.personal_information?.birth_date) {
      const birthDate = parsePartialDate(resume.personal_information.birth_date);
      if (birthDate) {
        const age = calculateAge(birthDate);
        
        if (age < 16) {
          issues.push({
            type: 'rule',
            severity: 'error',
            message: `Age based on birth date is too young: ${age} years old`,
            ruleId: 'birth-date-valid',
            path: 'personal_information.birth_date',
          });
        } else if (age > 100) {
          issues.push({
            type: 'rule',
            severity: 'error',
            message: `Age based on birth date is unrealistic: ${age} years old`,
            ruleId: 'birth-date-valid',
            path: 'personal_information.birth_date',
          });
        } else if (age > 80) {
          issues.push({
            type: 'rule',
            severity: 'warning',
            message: `Age based on birth date is quite high: ${age} years old`,
            ruleId: 'birth-date-valid',
            path: 'personal_information.birth_date',
          });
        }
      }
    }
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  },
};

/**
 * Rule 4: experience-duration - individual job duration limits
 */
export const experienceDurationRule: Rule = {
  id: 'experience-duration',
  message: 'Individual job durations should not exceed 50 years',
  severity: 'warning',
  validate: (resume: any) => {
    const issues: ValidationIssue[] = [];
    
    if (resume.work_experience && Array.isArray(resume.work_experience)) {
      resume.work_experience.forEach((exp: any, index: number) => {
        if (exp.start_date && exp.end_date) {
          const startDate = parsePartialDate(exp.start_date);
          const endDate = parsePartialDate(exp.end_date, true);
          
          if (startDate && endDate) {
            const durationYears = calculateDurationYears(startDate, endDate);
            
            if (durationYears > 50) {
              issues.push({
                type: 'rule',
                severity: 'warning',
                message: `Job duration is unusually long: ${durationYears} years at ${exp.company || 'company'}`,
                ruleId: 'experience-duration',
                path: `work_experience[${index}]`,
              });
            }
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