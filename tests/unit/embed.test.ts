/**
 * Tests for embedResume function
 */

import { embedResume } from '../../src/pdf/embed';
import { ErrorCode } from '../../src/validation/errors';
import { PDFDocument } from 'pdf-lib';

describe('embedResume', () => {
  let samplePDF: Buffer;
  let sampleResume: any;

  beforeAll(async () => {
    // Create a minimal PDF for testing
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    page.drawText('Test PDF');
    const pdfBytes = await pdfDoc.save();
    samplePDF = Buffer.from(pdfBytes);

    // Create sample resume data (new v0.1.0 format)
    sampleResume = {
      $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
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
          email: 'john.doe@example.com'
        },
        experience: [
          {
            company: 'Test Company',
            position: 'Developer',
            startDate: '2020-01-01',
            endDate: '2023-01-01'
          }
        ]
      }
    };
  });

  describe('basic functionality', () => {
    it('should embed resume data in PDF successfully', async () => {
      const result = await embedResume(samplePDF, sampleResume);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(samplePDF.length);
    });

    it('should handle compression option', async () => {
      const resultCompressed = await embedResume(samplePDF, sampleResume, { 
        compress: true 
      });
      const resultUncompressed = await embedResume(samplePDF, sampleResume, { 
        compress: false 
      });
      
      expect(resultCompressed).toBeInstanceOf(Buffer);
      expect(resultUncompressed).toBeInstanceOf(Buffer);
    });

    it('should skip XMP when requested', async () => {
      const result = await embedResume(samplePDF, sampleResume, { 
        skipXMP: true 
      });
      
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('error handling', () => {
    it('should reject invalid PDF data', async () => {
      const invalidPDF = Buffer.from('not a pdf');
      
      await expect(embedResume(invalidPDF, sampleResume))
        .rejects
        .toHaveProperty('code', ErrorCode.CORRUPTED_PDF);
    });

    it('should reject file that is too large', async () => {
      // Create a mock PDF that reports as too large
      const largePDF = Buffer.alloc(11 * 1024 * 1024); // 11MB
      
      await expect(embedResume(largePDF, sampleResume))
        .rejects
        .toHaveProperty('code', ErrorCode.FILE_TOO_LARGE);
    });
  });

  describe('options handling', () => {
    it('should use default options when none provided', async () => {
      const result = await embedResume(samplePDF, sampleResume);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should merge provided options with defaults', async () => {
      const result = await embedResume(samplePDF, sampleResume, {
        compress: true
      });
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('backward compatibility', () => {
    it('should handle legacy v1.0.0 format', async () => {
      const legacyResume = {
        schema_version: '1.0.0',
        personal_information: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com'
        },
        work_experience: [{
          company: 'Test Company',
          position: 'Developer',
          start_date: '2020-01-01',
          end_date: '2023-01-01'
        }]
      };
      
      const result = await embedResume(samplePDF, legacyResume);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(samplePDF.length);
    });
  });
});