/**
 * Integration tests for SDK and VitaeFlow Schema
 * Tests the interaction between the SDK and the official schema package
 */

import { validateResume, embedResume, extractResume } from '../../src';
import { getResumeSchema, getAvailableSchemaVersions } from '../../src/schemas';
import { PDFDocument } from 'pdf-lib';

describe('SDK ↔ Schema Integration', () => {
  let samplePDF: Buffer;

  beforeAll(async () => {
    // Create a simple PDF for testing using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    page.drawText('Test PDF for VitaeFlow SDK Integration Tests', {
      x: 50,
      y: 750,
      size: 12,
    });
    
    page.drawText('This PDF is used for testing embed/extract functionality.', {
      x: 50,
      y: 720,
      size: 10,
    });
    
    const pdfBytes = await pdfDoc.save();
    samplePDF = Buffer.from(pdfBytes);
  });

  describe('Schema Integration', () => {
    test('should get available schema versions', () => {
      const versions = getAvailableSchemaVersions();
      expect(versions).toBeInstanceOf(Array);
      expect(versions.length).toBeGreaterThan(0);
      expect(versions).toContain('0.1.0'); // Current version
    });

    test('should get schema for version 0.1.0', async () => {
      const schema = await getResumeSchema('0.1.0');
      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('type', 'object');
    });

    test('should get fallback schema for version 1.0.0', async () => {
      const schema = await getResumeSchema('1.0.0');
      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('title');
      expect(schema.title).toContain('Fallback');
    });

    test('should handle unknown schema version gracefully', async () => {
      const schema = await getResumeSchema('999.0.0');
      expect(schema).toBeDefined(); // Returns fallback schema
      expect(schema.title).toContain('Fallback');
    });
  });

  describe('Validation with Schema', () => {
    test('should validate VitaeFlow v0.1.0 resume data successfully', async () => {
      const resumeData = {
        $schema: 'https://vitaeflow.github.io/vitaeflow-schemas/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        meta: {
          language: 'en',
          country: 'US',
          source: 'test'
        },
        resume: {
          basics: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          },
          experience: [{
            position: 'Test Position',
            company: 'Test Company',
            startDate: '2020-01-01'
          }]
        }
      };

      const result = await validateResume(resumeData);
      expect(result.ok).toBe(true);
      expect(result.version).toBe('0.1.0');
      expect(result.issues).toHaveLength(0);
    });

    test('should validate legacy v1.0.0 resume data', async () => {
      const legacyData = {
        schema_version: '1.0.0',
        personal_information: {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com'
        },
        work_experience: [{
          company: 'Test Corp',
          position: 'Developer',
          start_date: '2020-01-01'
        }]
      };

      const result = await validateResume(legacyData);
      expect(result.ok).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    test('should detect validation errors', async () => {
      const invalidData = {
        specVersion: '0.1.0',
        meta: {
          language: 'en'
          // Missing required country
        },
        resume: {
          basics: {
            firstName: 'John'
            // Missing required lastName and email
          }
        }
      };

      const result = await validateResume(invalidData);
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Workflow', () => {
    test('should embed and extract VitaeFlow v0.1.0 data', async () => {
      const originalData = {
        $schema: 'https://vitaeflow.github.io/vitaeflow-schemas/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        meta: {
          language: 'en',
          country: 'US',
          source: 'integration-test'
        },
        resume: {
          basics: {
            firstName: 'Alice',
            lastName: 'Johnson',
            email: 'alice.johnson@example.com',
            phone: '+1-555-0123'
          },
          experience: [{
            position: 'Software Engineer',
            company: 'Tech Solutions Inc',
            startDate: '2022-01-15',
            endDate: '2024-01-15',
            summary: 'Developed web applications using modern technologies'
          }],
          skills: {
            technical: [{
              name: 'JavaScript',
              level: 'advanced',
              yearsOfExperience: 5,
              category: 'programming'
            }]
          }
        }
      };

      // First validate the data
      const validationResult = await validateResume(originalData);
      expect(validationResult.ok).toBe(true);

      // Embed data into PDF
      const pdfWithData = await embedResume(samplePDF, originalData);
      expect(pdfWithData).toBeInstanceOf(Buffer);
      expect(pdfWithData.length).toBeGreaterThan(samplePDF.length);

      // Extract data back
      const extractResult = await extractResume(pdfWithData);
      expect(extractResult.ok).toBe(true);
      expect(extractResult.data).toBeDefined();
      
      // Verify extracted data matches original
      expect(extractResult.data?.specVersion).toBe('0.1.0');
      expect(extractResult.data?.resume?.basics?.firstName).toBe('Alice');
      expect(extractResult.data?.resume?.basics?.lastName).toBe('Johnson');
      expect(extractResult.data?.resume?.basics?.email).toBe('alice.johnson@example.com');
      expect(extractResult.data?.resume?.experience).toHaveLength(1);
      expect(extractResult.data?.resume?.experience?.[0]?.company).toBe('Tech Solutions Inc');
    });

    test('should preserve data integrity with checksum verification', async () => {
      const resumeData = {
        $schema: 'https://vitaeflow.github.io/vitaeflow-schemas/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        meta: {
          language: 'en',
          country: 'US',
          source: 'checksum-test'
        },
        resume: {
          basics: {
            firstName: 'Bob',
            lastName: 'Wilson',
            email: 'bob.wilson@example.com'
          },
          experience: [{
            position: 'Developer',
            company: 'Test Corp',
            startDate: '2021-01-01'
          }]
        }
      };

      // Embed with checksum
      const pdfWithData = await embedResume(samplePDF, resumeData);
      
      // Extract and verify checksum
      const extractResult = await extractResume(pdfWithData);
      expect(extractResult.ok).toBe(true);
      expect(extractResult.metadata).toBeDefined();
      expect(extractResult.metadata!.checksumValid).toBe(true);
    });

    test('should handle schema validation during embed/extract cycle', async () => {
      const resumeData = {
        $schema: 'https://vitaeflow.github.io/vitaeflow-schemas/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        meta: {
          language: 'en',
          country: 'US',
          source: 'validation-test'
        },
        resume: {
          basics: {
            firstName: 'Charlie',
            lastName: 'Brown',
            email: 'charlie.brown@example.com'
          },
          experience: [{
            position: 'Tester',
            company: 'QA Corp',
            startDate: '2020-06-01'
          }]
        }
      };

      // Embed with validation enabled (default)
      const pdfWithData = await embedResume(samplePDF, resumeData, {
        validate: true,
        validateRules: true
      });

      // Extract with validation
      const extractResult = await extractResume(pdfWithData, {
        mode: 'strict',
        validateRules: true
      });

      expect(extractResult.ok).toBe(true);
      expect(extractResult.issues).toHaveLength(0);
    });

    test('should work with minimal valid data', async () => {
      const minimalData = {
        $schema: 'https://vitaeflow.github.io/vitaeflow-schemas/schemas/v0.1.0/vitaeflow.schema.json',
        specVersion: '0.1.0',
        meta: {
          language: 'en',
          country: 'US'
        },
        resume: {
          basics: {
            firstName: 'Min',
            lastName: 'Data',
            email: 'min@example.com'
          },
          experience: [{
            position: 'Minimal Role',
            company: 'Basic Corp',
            startDate: '2023-01-01'
          }]
        }
      };

      const pdfWithData = await embedResume(samplePDF, minimalData);
      const extractResult = await extractResume(pdfWithData);
      
      expect(extractResult.ok).toBe(true);
      expect(extractResult.data).toEqual(minimalData);
    });
  });

  describe('Browser Compatibility Simulation', () => {
    test('should work when schema API is not available', async () => {
      // Test that fallback versions are returned
      const versions = getAvailableSchemaVersions();
      expect(versions).toContain('0.1.0');
      
      // Test that fallback schema can be retrieved
      const fallbackSchema = await getResumeSchema('1.0.0');
      expect(fallbackSchema).toBeDefined();
      expect(fallbackSchema.title).toContain('Fallback');
    });
  });
});