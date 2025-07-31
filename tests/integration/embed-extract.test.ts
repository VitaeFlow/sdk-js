/**
 * Integration tests for embed/extract workflow
 */

import { embedResume, extractResume, hasResume } from '../../src';
import { Resume } from '../../src/types/resume';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

describe('Embed/Extract Integration', () => {
  let samplePDF: Buffer;
  let sampleResume: Resume;

  beforeAll(async () => {
    // Create a simple test PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    page.drawText('Test Resume PDF', { x: 50, y: 350 });
    const pdfBytes = await pdfDoc.save();
    samplePDF = Buffer.from(pdfBytes);

    // Create sample resume data (v0.1.0 format)
    sampleResume = {
      specVersion: '0.1.0',
      meta: {
        language: 'en',
        country: 'US',
        source: 'test-data'
      },
      resume: {
        basics: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-0123',
        },
        experience: [
          {
            company: 'Tech Corp',
            position: 'Senior Developer',
            startDate: '2020-01-01',
            endDate: '2023-12-31',
            summary: 'Led development of key features',
          },
        ],
        education: [
          {
            institution: 'University of Tech',
            studyType: 'Bachelor of Science',
            area: 'Computer Science',
            startDate: '2016-09-01',
            endDate: '2020-05-31',
          },
        ],
        skills: {
          technical: [
            { name: 'TypeScript', level: 'expert' },
            { name: 'React', level: 'advanced' },
          ]
        },
      },
    };
  });

  describe('hasResume()', () => {
    it('should return false for PDF without resume data', async () => {
      const result = await hasResume(samplePDF);
      expect(result).toBe(false);
    });

    it('should return true for PDF with embedded resume', async () => {
      const pdfWithResume = await embedResume(samplePDF, sampleResume);
      const result = await hasResume(pdfWithResume);
      expect(result).toBe(true);
    });
  });

  describe('embedResume()', () => {
    it('should embed resume data successfully', async () => {
      const result = await embedResume(samplePDF, sampleResume);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(samplePDF.length);
    });

    it('should embed with VF metadata by default', async () => {
      const result = await embedResume(samplePDF, sampleResume);
      const extracted = await extractResume(result);
      
      expect(extracted.ok).toBe(true);
      expect(extracted.metadata).toBeDefined();
      expect(extracted.metadata?.version).toBe('0.1.0');
      expect(extracted.metadata?.compressed).toBeDefined();
    });

    it('should embed without VF metadata when disabled', async () => {
      const result = await embedResume(samplePDF, sampleResume, {
        includeVFMetadata: false
      });
      const extracted = await extractResume(result);
      
      expect(extracted.ok).toBe(true);
      // Should still work but without detailed metadata
      expect(extracted.data).toBeDefined();
    });

    it('should handle compression options', async () => {
      const resultAlways = await embedResume(samplePDF, sampleResume, {
        compress: true
      });
      const resultNever = await embedResume(samplePDF, sampleResume, {
        compress: false
      });

      const extractedAlways = await extractResume(resultAlways);
      const extractedNever = await extractResume(resultNever);

      expect(extractedAlways.ok).toBe(true);
      expect(extractedNever.ok).toBe(true);
      expect(extractedAlways.metadata?.compressed).toBe(true);
      expect(extractedNever.metadata?.compressed).toBe(false);
    });
  });

  describe('extractResume()', () => {
    let embeddedPDF: Buffer;

    beforeEach(async () => {
      embeddedPDF = await embedResume(samplePDF, sampleResume);
    });

    it('should extract resume data successfully', async () => {
      const result = await extractResume(embeddedPDF);
      
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.resume?.basics?.firstName).toBe('John');
      expect(result.data?.resume?.basics?.lastName).toBe('Doe');
      expect(result.data?.resume?.basics?.email).toBe('john.doe@example.com');
      expect(result.issues.length).toBe(0);
    });

    it('should validate data by default', async () => {
      const result = await extractResume(embeddedPDF);
      
      expect(result.ok).toBe(true);
      expect(result.issues).toBeDefined();
      // Should have no validation errors for valid data
      const errors = result.issues.filter(issue => issue.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('should include XMP metadata when requested', async () => {
      const result = await extractResume(embeddedPDF, {
        includeXMP: true
      });
      
      expect(result.ok).toBe(true);
      expect(result.xmp).toBeDefined();
      expect(result.xmp?.hasStructuredData).toBe(true);
    });

    it('should handle different validation modes', async () => {
      const strictResult = await extractResume(embeddedPDF, {
        mode: 'strict'
      });
      const lenientResult = await extractResume(embeddedPDF, {
        mode: 'lenient'
      });

      expect(strictResult.ok).toBe(true);
      expect(lenientResult.ok).toBe(true);
    });

    it('should fail gracefully with invalid PDF', async () => {
      const invalidPDF = Buffer.from('not a pdf');
      
      await expect(extractResume(invalidPDF)).rejects.toThrow();
    });

    it('should return error for PDF without resume data', async () => {
      const result = await extractResume(samplePDF);
      
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No VitaeFlow resume data found');
    });
  });

  describe('Round-trip integrity', () => {
    it('should maintain data integrity through embed/extract cycle', async () => {
      const embedded = await embedResume(samplePDF, sampleResume);
      const extracted = await extractResume(embedded);
      
      expect(extracted.ok).toBe(true);
      expect(extracted.data).toEqual(sampleResume);
    });

    it('should handle multiple embed/extract cycles', async () => {
      let currentPDF = samplePDF;
      
      // First cycle
      currentPDF = await embedResume(currentPDF, sampleResume);
      let result = await extractResume(currentPDF);
      expect(result.ok).toBe(true);
      
      // Second cycle (replace data)
      const modifiedResume = {
        ...sampleResume,
        resume: {
          ...sampleResume.resume!,
          basics: {
            ...sampleResume.resume!.basics,
            firstName: 'Jane',
            lastName: 'Doe'
          }
        }
      };
      
      currentPDF = await embedResume(currentPDF, modifiedResume);
      result = await extractResume(currentPDF);
      
      expect(result.ok).toBe(true);
      expect(result.data?.resume?.basics?.firstName).toBe('Jane');
      expect(result.data?.resume?.basics?.lastName).toBe('Doe');
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted embedded data gracefully', async () => {
      // This test would require manually corrupting PDF data
      // For now, we'll test basic error handling
      const invalidBuffer = Buffer.from('invalid data');
      await expect(extractResume(invalidBuffer)).rejects.toThrow();
    });
  });
});