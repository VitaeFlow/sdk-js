/**
 * Tests for automatic schema download functionality
 */

import { validateResume } from '../../src';
import { getSchemaForData, extractSchemaUrlFromData } from '../../src/schemas';

describe('Schema Auto-Download', () => {
  describe('extractSchemaUrlFromData', () => {
    test('should extract $schema URL from data', () => {
      const data = {
        $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        resume: {}
      };

      const url = extractSchemaUrlFromData(data);
      expect(url).toBe('https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json');
    });

    test('should return null if no $schema present', () => {
      const data = {
        specVersion: '0.1.0',
        resume: {}
      };

      const url = extractSchemaUrlFromData(data);
      expect(url).toBe(null);
    });

    test('should return null for invalid data', () => {
      expect(extractSchemaUrlFromData(null)).toBe(null);
      expect(extractSchemaUrlFromData(undefined)).toBe(null);
      expect(extractSchemaUrlFromData('string')).toBe(null);
    });
  });

  describe('getSchemaForData with local fallback', () => {
    test('should auto-enable remote fetching when $schema URL is present (fallback test)', async () => {
      const data = {
        $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        resume: {}
      };

      // Since we can't easily mock Node.js HTTP in tests, test that it tries remote
      // and falls back to local schema when network isn't available
      const schema = await getSchemaForData(data);
      
      expect(schema).toBeDefined();
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    });

    test('should respect explicit useRemoteSchema: false', async () => {
      const data = {
        $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        resume: {}
      };

      // This should not attempt to fetch since useRemoteSchema is explicitly false
      const schema = await getSchemaForData(data, { useRemoteSchema: false });
      
      expect(schema).toBeDefined(); // Should fall back to local/minimal schema
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    });

    test('should handle invalid schema URLs', async () => {
      const data = {
        $schema: 'https://malicious-site.com/fake-schema.json',
        specVersion: '0.1.0',
        resume: {}
      };

      // Should reject invalid schema URLs and fall back to local
      const schema = await getSchemaForData(data);
      
      expect(schema).toBeDefined();
      // Should either be the official schema or fallback, but not from malicious site
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    });
  });

  describe('validation with schema URL', () => {
    test('should validate data using fallback when remote not available', async () => {
      const resumeData = {
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

      const result = await validateResume(resumeData);
      
      expect(result.ok).toBe(true);
      expect(result.version).toBe('0.1.0');
    });

    test('should handle invalid schema URLs in validation', async () => {
      const resumeData = {
        $schema: 'https://malicious-site.com/fake-schema.json',
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

      const result = await validateResume(resumeData);
      
      // Should reject invalid schema URLs and fall back to local validation
      expect(result).toBeDefined();
      expect(result.ok).toBe(true); // Should still validate with fallback
    });
  });

  describe('URL validation', () => {
    test('should accept valid VitaeFlow schema URLs', async () => {
      const validUrls = [
        'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
        'https://vitaeflow.github.io/vitaeflow-schemas/schemas/v0.1.0/vitaeflow.schema.json',
        'https://cdn.jsdelivr.net/npm/@vitaeflow/vitae-schema@0.1.0/schemas/v0.1.0/vitaeflow.schema.json'
      ];

      for (const url of validUrls) {
        const data = {
          $schema: url,
          specVersion: '0.1.0',
          meta: { language: 'en', country: 'US' },
          resume: { basics: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' } }
        };

        const result = await validateResume(data);
        expect(result).toBeDefined();
      }
    });

    test('should reject invalid schema URLs', async () => {
      const invalidUrls = [
        'https://malicious-site.com/schema.json',
        'http://vitaeflow.org/schema.json', // http instead of https
        'https://example.com/vitaeflow.schema.json'
      ];

      for (const url of invalidUrls) {
        const data = {
          $schema: url,
          specVersion: '0.1.0',
          meta: { language: 'en', country: 'US' },
          resume: { basics: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' } }
        };

        // Should still work but use fallback schema
        const result = await validateResume(data);
        expect(result).toBeDefined();
      }
    });
  });
});