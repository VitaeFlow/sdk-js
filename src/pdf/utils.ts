/**
 * PDF utilities and helpers
 */

import { PDFDocument, PDFArray, PDFDict, PDFName, PDFString } from 'pdf-lib';
import { ErrorCode, createError } from '../validation/errors';
import { MAX_FILE_SIZE, RESUME_FILENAME } from '../constants';
import { extractXMPFromPDF } from './xmp';
import { HasResumeResult } from '../types/results';

/**
 * Load and validate a PDF document
 */
export async function loadPDF(pdfData: Buffer | Uint8Array): Promise<PDFDocument> {
  try {
    // Check file size
    if (pdfData.length > MAX_FILE_SIZE) {
      throw createError(
        ErrorCode.FILE_TOO_LARGE,
        `PDF file size (${pdfData.length} bytes) exceeds maximum allowed size (${MAX_FILE_SIZE} bytes)`
      );
    }

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfData, {
      ignoreEncryption: false,
    });

    // Check for encryption
    if (pdfDoc.isEncrypted) {
      throw createError(ErrorCode.ENCRYPTED_PDF);
    }

    return pdfDoc;
  } catch (error) {
    if (error instanceof Error && error.message.includes('encrypted')) {
      throw createError(ErrorCode.ENCRYPTED_PDF);
    }
    
    if (error instanceof Error && (
      error.message.includes('Invalid PDF') ||
      error.message.includes('Unable to parse')
    )) {
      throw createError(ErrorCode.INVALID_PDF, error.message);
    }

    // Re-throw VitaeFlowError as-is
    if (error instanceof Error && 'code' in error) {
      throw error;
    }

    throw createError(ErrorCode.CORRUPTED_PDF, `Failed to load PDF: ${error}`);
  }
}

/**
 * Get or create the Names dictionary in the PDF
 */
export function getOrCreateNameDict(pdfDoc: PDFDocument): PDFDict {
  const catalog = pdfDoc.catalog;
  let namesDict = catalog.get(PDFName.of('Names'));
  
  if (!namesDict || !(namesDict instanceof PDFDict)) {
    namesDict = PDFDict.withContext(pdfDoc.context);
    catalog.set(PDFName.of('Names'), namesDict);
  }
  
  return namesDict as PDFDict;
}

/**
 * Get or create the EmbeddedFiles dictionary
 */
export function getOrCreateEmbeddedFilesDict(pdfDoc: PDFDocument): PDFDict {
  const namesDict = getOrCreateNameDict(pdfDoc);
  let embeddedFilesDict = namesDict.get(PDFName.of('EmbeddedFiles'));
  
  if (!embeddedFilesDict || !(embeddedFilesDict instanceof PDFDict)) {
    embeddedFilesDict = PDFDict.withContext(pdfDoc.context);
    namesDict.set(PDFName.of('EmbeddedFiles'), embeddedFilesDict);
  }
  
  return embeddedFilesDict as PDFDict;
}

/**
 * Get the Names array from EmbeddedFiles dictionary
 */
export function getEmbeddedFilesNamesArray(embeddedFilesDict: PDFDict): PDFArray | undefined {
  const names = embeddedFilesDict.get(PDFName.of('Names'));
  return names instanceof PDFArray ? names : undefined;
}

/**
 * Set or update the Names array in EmbeddedFiles dictionary
 */
export function setEmbeddedFilesNamesArray(embeddedFilesDict: PDFDict, namesArray: PDFArray): void {
  embeddedFilesDict.set(PDFName.of('Names'), namesArray);
}

/**
 * Find an embedded file by name in the Names array
 */
export function findEmbeddedFileByName(
  namesArray: PDFArray,
  fileName: string,
  pdfDoc?: PDFDocument
): { index: number; fileSpec: PDFDict } | null {
  const elements = namesArray.asArray();
  
  // Names array format: [name1, filespec1, name2, filespec2, ...]
  for (let i = 0; i < elements.length; i += 2) {
    const nameElement = elements[i];
    const fileSpecElement = elements[i + 1];
    
    if (!nameElement || !fileSpecElement) continue;
    
    let name: string;
    if (nameElement instanceof PDFString) {
      name = nameElement.decodeText();
    } else if (nameElement instanceof PDFName) {
      name = nameElement.decodeText();
    } else {
      continue;
    }
    
    if (name === fileName) {
      // Resolve PDFRef to get actual PDFDict if needed
      let fileSpec: PDFDict;
      if (fileSpecElement instanceof PDFDict) {
        fileSpec = fileSpecElement;
      } else if (pdfDoc) {
        const resolved = pdfDoc.context.lookup(fileSpecElement);
        if (resolved instanceof PDFDict) {
          fileSpec = resolved;
        } else {
          continue;
        }
      } else {
        continue;
      }
      
      return { index: i, fileSpec };
    }
  }
  
  return null;
}

/**
 * Remove an embedded file from the Names array
 */
export function removeEmbeddedFile(namesArray: PDFArray, index: number): void {
  const elements = namesArray.asArray();
  // Remove both name and filespec (2 elements)
  elements.splice(index, 2);
}

/**
 * Add an embedded file to the Names array
 */
export function addEmbeddedFile(
  namesArray: PDFArray,
  fileName: string,
  fileSpec: PDFDict
): void {
  namesArray.push(PDFString.of(fileName));
  namesArray.push(fileSpec);
}

/**
 * Create a current timestamp in ISO format
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Convert Buffer/Uint8Array to the appropriate type for pdf-lib
 */
export function ensureUint8Array(data: Buffer | Uint8Array): Uint8Array {
  return data instanceof Buffer ? new Uint8Array(data) : data;
}

/**
 * Quick check if a PDF contains VitaeFlow resume data
 * Optimized for performance - no JSON parsing or full extraction
 * 
 * Use cases:
 * - Quick UI feedback ("Resume detected") before full extraction
 * - Batch processing to filter PDFs with embedded resumes
 * - ATS systems doing preliminary checks
 * - File validators checking VitaeFlow compliance
 */
export async function hasResume(pdf: Buffer | Uint8Array): Promise<boolean> {
  try {
    // Step 1: Load PDF (minimal)
    const pdfDoc = await loadPDF(pdf);
    
    // Step 2: Check XMP metadata first (fastest check)
    try {
      const xmpData = extractXMPFromPDF(pdfDoc);
      if (xmpData && xmpData.hasStructuredData) {
        return true;
      }
    } catch (error) {
      // XMP check failed, continue to embedded files check
    }
    
    // Step 3: Check for embedded "resume.json" file
    try {
      const catalog = pdfDoc.catalog;
      const namesDictRef = catalog.get(PDFName.of('Names'));
      
      if (!namesDictRef) {
        return false;
      }
      
      // Resolve reference to get actual PDFDict
      const namesDict = pdfDoc.context.lookup(namesDictRef);
      if (!namesDict || !(namesDict instanceof PDFDict)) {
        return false;
      }
      
      const embeddedFilesDictRef = namesDict.get(PDFName.of('EmbeddedFiles'));
      if (!embeddedFilesDictRef) {
        return false;
      }
      
      // Resolve reference to get actual PDFDict
      const embeddedFilesDict = pdfDoc.context.lookup(embeddedFilesDictRef);
      if (!embeddedFilesDict || !(embeddedFilesDict instanceof PDFDict)) {
        return false;
      }
      
      const namesArray = getEmbeddedFilesNamesArray(embeddedFilesDict);
      if (!namesArray) {
        return false;
      }
      
      // Look for "resume.json" in the names array
      const found = findEmbeddedFileByName(namesArray, RESUME_FILENAME, pdfDoc);
      return found !== null;
      
    } catch (error) {
      // Embedded files check failed
      return false;
    }
    
  } catch (error) {
    // Handle errors silently and return false
    return false;
  }
}

/**
 * Enhanced check for VitaeFlow resume data with detailed detection info
 * Provides confidence levels and source information for better UX
 * 
 * Use cases:
 * - Resume builders showing "Resume data quality: High confidence"
 * - ATS systems displaying detection source for transparency  
 * - Debug tools showing detection methodology
 * - Analytics tracking detection success rates
 */
export async function hasResumeDetailed(pdf: Buffer | Uint8Array): Promise<HasResumeResult> {
  try {
    // Step 1: Load PDF (minimal)
    const pdfDoc = await loadPDF(pdf);
    
    let hasXMP = false;
    let hasEmbedded = false;
    let xmpVersion: string | undefined;
    
    // Step 2: Check XMP metadata first (fastest check)
    try {
      const xmpData = extractXMPFromPDF(pdfDoc);
      if (xmpData && xmpData.hasStructuredData) {
        hasXMP = true;
        xmpVersion = xmpData.specVersion;
      }
    } catch (error) {
      // XMP check failed, continue to embedded files check
    }
    
    // Step 3: Check for embedded "resume.json" file
    try {
      const catalog = pdfDoc.catalog;
      const namesDictRef = catalog.get(PDFName.of('Names'));
      
      if (namesDictRef) {
        // Resolve reference to get actual PDFDict
        const namesDict = pdfDoc.context.lookup(namesDictRef);
        if (namesDict && namesDict instanceof PDFDict) {
          const embeddedFilesDictRef = namesDict.get(PDFName.of('EmbeddedFiles'));
          if (embeddedFilesDictRef) {
            // Resolve reference to get actual PDFDict
            const embeddedFilesDict = pdfDoc.context.lookup(embeddedFilesDictRef);
            if (embeddedFilesDict && embeddedFilesDict instanceof PDFDict) {
              const namesArray = getEmbeddedFilesNamesArray(embeddedFilesDict);
              if (namesArray) {
                // Look for "resume.json" in the names array
                const found = findEmbeddedFileByName(namesArray, RESUME_FILENAME, pdfDoc);
                if (found !== null) {
                  hasEmbedded = true;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // Embedded files check failed, continue with what we have
    }
    
    // Step 4: Determine confidence and source
    if (hasXMP && hasEmbedded) {
      return {
        hasResume: true,
        source: 'xmp', // Prefer XMP as primary source when both present
        ...(xmpVersion && { version: xmpVersion }),
        confidence: 'high'
      };
    } else if (hasXMP) {
      return {
        hasResume: true,
        source: 'xmp',
        ...(xmpVersion && { version: xmpVersion }),
        confidence: 'medium' // XMP claims but no embedded file found
      };
    } else if (hasEmbedded) {
      return {
        hasResume: true,
        source: 'embedded',
        confidence: 'medium' // File exists but no XMP metadata
      };
    } else {
      return {
        hasResume: false,
        confidence: 'high' // High confidence in negative result
      };
    }
    
  } catch (error) {
    // Handle errors and return low confidence negative result
    return {
      hasResume: false,
      confidence: 'low' // Error occurred, can't be sure
    };
  }
}