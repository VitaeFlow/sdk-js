/**
 * PDF utilities and helpers
 */

import { PDFDocument, PDFArray, PDFDict, PDFName, PDFString } from 'pdf-lib';
import { ErrorCode, createError } from '../validation/errors';
import { MAX_FILE_SIZE } from '../constants';

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
  fileName: string
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
    
    if (name === fileName && fileSpecElement instanceof PDFDict) {
      return { index: i, fileSpec: fileSpecElement };
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