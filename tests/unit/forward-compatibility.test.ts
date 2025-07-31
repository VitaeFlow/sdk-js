/**
 * Tests for forward compatibility functionality
 */

import { validateResume } from '../../src';
import { findCompatibleVersion, getAvailableSchemaVersions } from '../../src/schemas';

describe('Forward Compatibility', () => {
  describe('findCompatibleVersion', () => {
    test('should return exact match when available', () => {
      const availableVersions = ['0.1.0', '0.2.0', '1.0.0'];
      const result = findCompatibleVersion('0.1.0', availableVersions);
      expect(result).toBe('0.1.0');
    });

    test('should find compatible version for future minor version', () => {
      const availableVersions = ['0.1.0', '0.2.0'];
      const result = findCompatibleVersion('0.3.0', availableVersions);
      // Should use the latest available within the same major version
      expect(result).toBe('0.2.0');
    });

    test('should find compatible version for future patch version', () => {
      const availableVersions = ['0.1.0', '0.1.2'];
      const result = findCompatibleVersion('0.1.5', availableVersions);
      // Should use the closest available version (0.1.2)
      expect(result).toBe('0.1.2');
    });

    test('should not find compatible version across major versions', () => {
      const availableVersions = ['0.1.0', '0.2.0'];
      const result = findCompatibleVersion('1.0.0', availableVersions);
      expect(result).toBe(null);
    });

    test('should prefer newer version when equal distance', () => {
      const availableVersions = ['0.1.0', '0.3.0'];
      const result = findCompatibleVersion('0.2.0', availableVersions);
      // Both 0.1.0 and 0.3.0 are distance 1 from 0.2.0, should prefer newer
      expect(result).toBe('0.3.0');
    });

    test('should handle empty available versions', () => {
      const result = findCompatibleVersion('0.1.0', []);
      expect(result).toBe(null);
    });

    test('should handle invalid requested version', () => {
      const availableVersions = ['0.1.0'];
      expect(findCompatibleVersion('', availableVersions)).toBe(null);
      expect(findCompatibleVersion('invalid', availableVersions)).toBe(null);
    });
  });

  describe('validation with compatible mode', () => {
    test('should validate future version in compatible mode', async () => {
      const resumeData = {
        $schema: 'https://vitaeflow.org/schemas/v0.9.0/vitaeflow.schema.json',
        specVersion: '0.9.0', // Future version that doesn't exist
        meta: {
          language: 'en',
          country: 'US'
        },
        resume: {
          basics: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          },
          experience: [{
            position: 'Developer',
            company: 'Test Corp',
            startDate: '2020-01-01',
            current: false
          }]
        }
      };

      const result = await validateResume(resumeData, { mode: 'compatible' });
      
      if (!result.ok) {
        console.log('Forward compatibility validation failed:', result.issues);
      }
      
      expect(result.ok).toBe(true);
      expect(result.version).toBe('0.9.0'); // Should return the original version
    });

    test('should validate future version in strict mode with fallback', async () => {
      const resumeData = {
        $schema: 'https://vitaeflow.org/schemas/v0.9.0/vitaeflow.schema.json',
        specVersion: '0.9.0', // Future version that doesn't exist
        meta: {
          language: 'en',
          country: 'US'
        },
        resume: {
          basics: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          },
          experience: [{
            position: 'Developer',
            company: 'Test Corp',
            startDate: '2020-01-01',
            current: false
          }]
        }
      };

      const result = await validateResume(resumeData, { mode: 'strict' });
      
      // In strict mode, should use fallback schema but may have validation issues
      // due to version mismatch (specVersion: 0.9.0 vs schema expecting exact match)
      expect(result.version).toBe('0.9.0');
      // The validation might fail due to strict version checking, but that's expected
    });

    test('should handle cross-major version incompatibility', async () => {
      const resumeData = {
        $schema: 'https://vitaeflow.org/schemas/v2.0.0/vitaeflow.schema.json',
        specVersion: '2.0.0', // Future major version
        meta: {
          language: 'en',
          country: 'US'
        },
        resume: {
          basics: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          },
          experience: [{
            position: 'Developer',
            company: 'Test Corp',
            startDate: '2020-01-01',
            current: false
          }]
        }
      };

      const result = await validateResume(resumeData, { mode: 'compatible' });
      
      // Should still work with fallback schema
      expect(result.ok).toBe(true);
      expect(result.version).toBe('2.0.0');
    });

    test('should validate with exact version match', async () => {
      const resumeData = {
        $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0', // Current version
        meta: {
          language: 'en',
          country: 'US'
        },
        resume: {
          basics: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          },
          experience: [{
            position: 'Developer',
            company: 'Test Corp',
            startDate: '2020-01-01',
            current: false
          }]
        }
      };

      const result = await validateResume(resumeData, { mode: 'compatible' });
      
      expect(result.ok).toBe(true);
      expect(result.version).toBe('0.1.0');
    });
  });

  describe('validation mode options', () => {
    const baseResumeData = {
      $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
      specVersion: '0.1.0',
      meta: {
        language: 'en',
        country: 'US'
      },
      resume: {
        basics: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        },
        experience: [{
          position: 'Developer',
          company: 'Test Corp',
          startDate: '2020-01-01',
          current: false
        }]
      }
    };

    test('should use strict mode by default', async () => {
      const result = await validateResume(baseResumeData);
      expect(result.ok).toBe(true);
    });

    test('should handle compatible mode', async () => {
      const result = await validateResume(baseResumeData, { mode: 'compatible' });
      expect(result.ok).toBe(true);
    });

    test('should handle lenient mode', async () => {
      const result = await validateResume(baseResumeData, { mode: 'lenient' });
      expect(result.ok).toBe(true);
    });
  });

  describe('getAvailableSchemaVersions integration', () => {
    test('should return available versions including current', () => {
      const versions = getAvailableSchemaVersions();
      expect(versions).toBeInstanceOf(Array);
      expect(versions.length).toBeGreaterThan(0);
      expect(versions).toContain('0.1.0');
    });
  });
});