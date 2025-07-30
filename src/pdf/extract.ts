/**
 * Resume extraction functionality
 * Implements the complete extractResume operation with all 11 steps from the blueprint
 */

import { PDFDocument, PDFDict, PDFName, PDFArray, PDFString } from 'pdf-lib';
import { Resume } from '../types/resume';
import { ExtractOptions } from '../types/options';
import { ExtractResult } from '../types/results';
import { 
  loadPDF,
  findEmbeddedFileByName,
  getEmbeddedFilesNamesArray,
  ensureUint8Array 
} from './utils';
import { parseVFMetadata, VFMetadata, isVitaeFlowMetadata } from './metadata';
import { extractXMPFromPDF } from './xmp';
import { 
  decompressData, 
  getDataSize 
} from '../utils/compression';
import { calculateChecksum, verifyChecksum } from '../utils/checksum';
import { ErrorCode, createError } from '../validation/errors';
import { 
  CURRENT_VERSION, 
  RESUME_FILENAME, 
  DEFAULT_EXTRACT_OPTIONS 
} from '../constants';

/**
 * Extract resume data from a PDF with comprehensive validation
 */
export async function extractResume(
  pdf: Buffer | Uint8Array,
  options: ExtractOptions = {}
): Promise<ExtractResult> {
  // Merge options with defaults
  const opts = { ...DEFAULT_EXTRACT_OPTIONS, ...options };
  
  try {
    // Step 1: Load PDF (detect if encrypted)
    const pdfDoc = await loadPDF(pdf);
    
    const result: ExtractResult = {
      ok: false,
      issues: [],
    };
    
    // Step 2: Try extracting XMP from catalog/Metadata (always attempt, optional in result)
    let xmpData: any = null;
    try {
      xmpData = extractXMPFromPDF(pdfDoc);
      
      // Only include in result if requested
      if (opts.includeXMP && xmpData) {
        const xmpResult: any = {
          hasStructuredData: xmpData.hasStructuredData,
          specVersion: xmpData.specVersion,
        };
        
        // Only add optional properties if they exist
        if (xmpData.candidateName) {
          xmpResult.candidateName = xmpData.candidateName;
        }
        if (xmpData.candidateEmail) {
          xmpResult.candidateEmail = xmpData.candidateEmail;
        }
        
        result.xmp = xmpResult;
      }
    } catch (error) {
      // XMP is optional, continue even if it fails
    }
    
    // Step 3: Look for "resume.json" in /Names/EmbeddedFiles
    const embeddedFileResult = await findEmbeddedResumeFile(pdfDoc);
    if (!embeddedFileResult) {
      result.error = 'No VitaeFlow resume data found in the PDF';
      return result;
    }
    
    const { fileSpec, embeddedFileStream } = embeddedFileResult;
    
    // Step 4: Extract and process the embedded file
    try {
      // Read /VF_Metadata for technical info
      const vfMetadata = parseVFMetadata(fileSpec);
      
      // Extract the stream data
      const rawData = embeddedFileStream.contents;
      let jsonString: string;
      
      // Step 4a: Detect compression and decompress if necessary
      // Prioritize VF_Metadata for compression detection since we use stream() instead of flateStream()
      const isCompressed = vfMetadata?.compressed === true;
      
      if (isCompressed) {
        try {
          const decompressed = decompressData(rawData);
          jsonString = new TextDecoder().decode(decompressed);
        } catch (error) {
          throw createError(
            ErrorCode.INVALID_RESUME_DATA,
            `Failed to decompress resume data: ${error}`
          );
        }
      } else {
        jsonString = new TextDecoder().decode(rawData);
      }
      
      // Step 5: Parse JSON and handle parsing errors
      let resumeData: any;
      try {
        resumeData = JSON.parse(jsonString);
      } catch (error) {
        throw createError(
          ErrorCode.INVALID_RESUME_DATA,
          `Invalid JSON in resume data: ${error}`
        );
      }
      
      // Step 6: Calculate checksum and compare with VF_Metadata
      const calculatedChecksum = await calculateChecksum(jsonString);
      const checksumValid = vfMetadata?.checksum ? 
        await verifyChecksum(jsonString, vfMetadata.checksum) : true;
      
      if (vfMetadata?.checksum && !checksumValid) {
        result.issues.push({
          type: 'rule',
          severity: 'warning',
          message: 'Resume data checksum mismatch - data may have been modified',
          ruleId: 'checksum-validation',
        });
      }
      
      // Add metadata to result
      if (vfMetadata) {
        result.metadata = {
          version: vfMetadata.version,
          checksum: vfMetadata.checksum,
          checksumValid,
          created: vfMetadata.created,
          compressed: vfMetadata.compressed,
          fileSize: vfMetadata.originalSize,
        };
      }
      
      // Step 7: Detect version
      const detectedVersion = detectResumeVersion(resumeData);
      
      // Step 8: Validate according to options.mode
      const validationResult = await validateResumeData(resumeData, detectedVersion, opts);
      result.issues.push(...validationResult.issues);
      
      // Step 9: Apply business rules if enabled
      if (opts.validateRules) {
        const rulesResult = await validateBusinessRules(resumeData, detectedVersion, opts);
        result.issues.push(...rulesResult.issues);
      }
      
      // Step 10: Migrate to latest if requested
      let finalData = resumeData;
      if (opts.migrateToLatest && detectedVersion !== CURRENT_VERSION) {
        const { migrateResume } = await import('../migration/migrator');
        const migrationResult = await migrateResume(resumeData, CURRENT_VERSION);
        if (migrationResult.ok && migrationResult.data) {
          finalData = migrationResult.data;
          result.migrated = true;
          result.migratedFrom = detectedVersion;
        } else {
          result.issues.push({
            type: 'rule',
            severity: 'warning',
            message: `Failed to migrate from version ${detectedVersion} to ${CURRENT_VERSION}: ${migrationResult.error}`,
            ruleId: 'version-migration',
          });
        }
      }
      
      // Step 11: Return complete result
      result.ok = result.issues.filter(issue => issue.severity === 'error').length === 0;
      result.data = finalData as Resume;
      
      return result;
      
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw createError(
        ErrorCode.INVALID_RESUME_DATA,
        `Failed to process embedded resume data: ${error}`,
        { originalError: error }
      );
    }
    
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      throw error;
    }
    
    throw createError(
      ErrorCode.CORRUPTED_PDF, 
      `Failed to extract resume: ${error}`,
      { originalError: error }
    );
  }
}

/**
 * Find the embedded resume file in the PDF
 */
async function findEmbeddedResumeFile(pdfDoc: PDFDocument): Promise<{
  fileSpec: PDFDict;
  embeddedFileStream: any;
} | null> {
  try {
    const catalog = pdfDoc.catalog;
    
    // Navigate to /Names/EmbeddedFiles - resolve PDFRef objects properly
    const namesDictRef = catalog.get(PDFName.of('Names'));
    if (!namesDictRef) {
      return null;
    }
    
    // Resolve reference to get actual PDFDict
    const namesDict = pdfDoc.context.lookup(namesDictRef);
    if (!namesDict || !(namesDict instanceof PDFDict)) {
      return null;
    }
    
    const embeddedFilesDictRef = namesDict.get(PDFName.of('EmbeddedFiles'));
    if (!embeddedFilesDictRef) {
      return null;
    }
    
    // Resolve reference to get actual PDFDict
    const embeddedFilesDict = pdfDoc.context.lookup(embeddedFilesDictRef);
    if (!embeddedFilesDict || !(embeddedFilesDict instanceof PDFDict)) {
      return null;
    }
    
    const namesArray = getEmbeddedFilesNamesArray(embeddedFilesDict);
    if (!namesArray) {
      return null;
    }
    
    // Find resume.json file
    const found = findEmbeddedFileByName(namesArray, RESUME_FILENAME, pdfDoc);
    if (!found) {
      return null;
    }
    
    const { fileSpec } = found;
    
    // Get the embedded file stream
    const efDict = fileSpec.get(PDFName.of('EF'));
    if (!efDict || !(efDict instanceof PDFDict)) {
      return null;
    }
    
    const embeddedFileRef = efDict.get(PDFName.of('F')) || efDict.get(PDFName.of('UF'));
    if (!embeddedFileRef) {
      return null;
    }
    
    const embeddedFileStream = pdfDoc.context.lookup(embeddedFileRef);
    if (!embeddedFileStream) {
      return null;
    }
    
    return { fileSpec, embeddedFileStream };
    
  } catch (error) {
    return null;
  }
}

/**
 * Detect resume version from data
 */
function detectResumeVersion(resumeData: any): string {
  // 1. Check data.schema_version
  if (resumeData.schema_version && typeof resumeData.schema_version === 'string') {
    return resumeData.schema_version;
  }
  
  // 2. Check data.$schema with regex
  if (resumeData.$schema && typeof resumeData.$schema === 'string') {
    const match = resumeData.$schema.match(/v(\d+\.\d+\.\d+)/);
    if (match) {
      return match[1];
    }
  }
  
  // 3. Structure heuristic (basic check)
  if (resumeData.personal_information || resumeData.work_experience || resumeData.education) {
    return '1.0.0'; // Assume current format
  }
  
  // 4. Default
  return '1.0.0';
}

/**
 * Validate resume data (schema validation)
 */
async function validateResumeData(
  data: any, 
  version: string, 
  options: ExtractOptions
): Promise<{ issues: any[] }> {
  try {
    const { validateResume } = await import('../validation/validator');
    const result = await validateResume(data, {
      version,
      mode: options.mode === 'lenient' ? 'lenient' : 'strict',
      validateRules: false, // Only schema validation here
    });
    return { issues: result.issues };
  } catch (error) {
    return {
      issues: [{
        type: 'schema',
        severity: 'error',
        message: `Schema validation failed: ${error}`,
        path: '$',
      }]
    };
  }
}

/**
 * Validate business rules
 */
async function validateBusinessRules(
  data: any, 
  version: string, 
  options: ExtractOptions
): Promise<{ issues: any[] }> {
  try {
    const { validateResume } = await import('../validation/validator');
    const result = await validateResume(data, {
      version,
      mode: options.mode === 'lenient' ? 'lenient' : 'strict',
      validateRules: true,
      skipRules: options.skipRules || [],
    });
    // Filter to only rule-type issues since we already did schema validation
    const ruleIssues = result.issues.filter(issue => issue.type === 'rule');
    return { issues: ruleIssues };
  } catch (error) {
    return {
      issues: [{
        type: 'rule',
        severity: 'error',
        message: `Business rules validation failed: ${error}`,
        ruleId: 'validation-error',
      }]
    };
  }
}

