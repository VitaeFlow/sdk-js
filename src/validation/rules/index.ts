/**
 * Central export for all validation rules
 */

import { Rule } from '../../types';

// Import date-related rules
import {
  datesChronologicalRule,
  datesNotFutureRule,
  birthDateValidRule,
  experienceDurationRule
} from './dates';

// Import content-related rules
import {
  emailFormatRule,
  requiredExperienceOrEducationRule,
  noDuplicateEntriesRule
} from './content';

/**
 * All core validation rules for v1.0.0
 */
export const coreRulesV1: Rule[] = [
  datesChronologicalRule,
  datesNotFutureRule,
  birthDateValidRule,
  experienceDurationRule,
  emailFormatRule,
  requiredExperienceOrEducationRule,
  noDuplicateEntriesRule,
];

/**
 * Get core rules for a specific version
 */
export function getCoreRulesForVersion(version: string): Rule[] {
  // For now, only v1.0.0 is supported
  // In the future, this would route to version-specific rule sets
  if (version.startsWith('1.')) {
    return coreRulesV1;
  }
  
  // Fallback to v1 rules for unknown versions
  return coreRulesV1;
}

// Re-export individual rules for advanced use cases
export {
  datesChronologicalRule,
  datesNotFutureRule,
  birthDateValidRule,
  experienceDurationRule,
  emailFormatRule,
  requiredExperienceOrEducationRule,
  noDuplicateEntriesRule
};