/**
 * Resume embedding functionality - based on proven structpdf implementation
 * Implements the complete embedResume operation with triple metadata levels
 */

import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString } from 'pdf-lib';
import { Resume } from '../types/resume';
import { EmbedOptions } from '../types/options';
import { 
  loadPDF,
  createTimestamp
} from './utils';
import { 
  createFileSpec, 
  createVFMetadataForEmbed 
} from './metadata';
import { addXMPToPDF, createXMPDataForEmbed } from './xmp';
import { 
  compressData, 
  shouldCompress, 
  getDataSize 
} from '../utils/compression';
import { calculateChecksum } from '../utils/checksum';
import { ErrorCode, createError } from '../validation/errors';
import { 
  CURRENT_VERSION, 
  RESUME_FILENAME, 
  DEFAULT_EMBED_OPTIONS 
} from '../constants';

/**
 * Embed resume data into a PDF with triple metadata levels
 */
export async function embedResume(
  pdf: Buffer | Uint8Array | string,
  resume: Resume,
  options: EmbedOptions = {}
): Promise<Buffer> {
  // Merge options with defaults
  const opts = { ...DEFAULT_EMBED_OPTIONS, ...options };
  
  try {
    // Step 1: Handle string input (create simple PDF)
    let pdfData: Buffer | Uint8Array;
    if (typeof pdf === 'string') {
      // Create a simple PDF with the text content
      const simplePdf = await PDFDocument.create();
      const page = simplePdf.addPage();
      const { width, height } = page.getSize();
      page.drawText(pdf, {
        x: 50,
        y: height - 100,
        size: 12
      });
      const pdfBytes = await simplePdf.save();
      pdfData = Buffer.from(pdfBytes);
    } else {
      pdfData = pdf;
    }
    
    // Step 2: Load and validate PDF
    const pdfDoc = await loadPDF(pdfData);
    
    // Step 2: Prepare resume data and detect version
    const version = (resume as any).specVersion || (resume as any).schema_version || CURRENT_VERSION;
    const resumeData = {
      ...resume,
      // Maintain version field based on format
      ...(version === '0.1.0' ? { specVersion: version } : { schema_version: version })
    };
    
    // Step 2a: Validate resume data if enabled
    if (opts.validate !== false) {
      const { validateResume } = await import('../validation/validator');
      const validationResult = await validateResume(resumeData, {
        version: version,
        mode: 'strict',
        validateRules: opts.validateRules
      });
      
      if (!validationResult.ok) {
        throw createError(
          ErrorCode.INVALID_RESUME_DATA,
          `Resume validation failed: ${validationResult.issues.filter(i => i.severity === 'error').map(i => i.message).join(', ')}`
        );
      }
    }
    
    // Step 3: Serialize to JSON (optimized without formatting)
    const jsonData = JSON.stringify(resumeData);
    const originalSize = getDataSize(jsonData);
    
    // Step 4: Calculate checksum
    const checksum = await calculateChecksum(jsonData);
    
    // Step 5: Handle compression
    const compress = shouldCompress(jsonData, opts.compress || 'auto');
    let finalData: Uint8Array;
    
    if (compress) {
      finalData = compressData(jsonData);
    } else {
      finalData = new TextEncoder().encode(jsonData);
    }
    
    // Step 6: Remove existing file if it exists
    removeEmbeddedFile(pdfDoc, RESUME_FILENAME);
    
    // Step 7: Embed file using enhanced approach with VF metadata
    const timestamp = createTimestamp();
    await embedFileInPDF(
      pdfDoc, 
      RESUME_FILENAME, 
      finalData, 
      opts.includeVFMetadata ? {
        checksum,
        created: timestamp,
        compressed: compress,
        originalSize,
        compressedSize: finalData.length
      } : undefined
    );
    
    // Step 8: Add XMP metadata (unless skipped)
    if (!opts.skipXMP) {
      const xmpData = createXMPDataForEmbed(
        extractCandidateName(resumeData),
        extractCandidateEmail(resumeData),
        checksum
      );
      addXMPToPDF(pdfDoc, xmpData);
    }
    
    // Step 9: Save and return PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    // Re-throw VitaeFlowError as-is
    if (error instanceof Error && 'code' in error) {
      throw error;
    }
    
    // Wrap other errors
    throw createError(
      ErrorCode.CORRUPTED_PDF, 
      `Failed to embed resume: ${error}`,
      { originalError: error }
    );
  }
}

/**
 * Embed file in PDF using the proven structpdf approach
 */
async function embedFileInPDF(
  pdfDoc: PDFDocument,
  fileName: string,
  fileData: Uint8Array,
  vfMetadata?: {
    checksum: string;
    created: string;
    compressed: boolean;
    originalSize: number;
    compressedSize: number;
  }
): Promise<void> {
  // Create file stream - use stream() instead of flateStream() to avoid double compression
  // when fileData is already compressed with our compression system
  const fileStream = pdfDoc.context.stream(fileData);
  const fileStreamRef = pdfDoc.context.register(fileStream);
  
  // Set stream dictionary
  fileStream.dict.set(PDFName.of('Type'), PDFName.of('EmbeddedFile'));
  fileStream.dict.set(PDFName.of('Subtype'), PDFName.of('application/json'));
  fileStream.dict.set(PDFName.of('Length'), pdfDoc.context.obj(fileData.length));
  
  // Create file specification with optional VF metadata
  let fileSpec: any;
  if (vfMetadata) {
    const vfMetadataForSpec = createVFMetadataForEmbed(
      vfMetadata.checksum,
      vfMetadata.created,
      vfMetadata.compressed,
      vfMetadata.originalSize,
      vfMetadata.compressedSize
    );
    fileSpec = createFileSpec(pdfDoc, fileStreamRef, vfMetadataForSpec);
  } else {
    fileSpec = pdfDoc.context.obj({
      Type: 'Filespec',
      F: PDFString.of(fileName),
      UF: PDFString.of(fileName),
      EF: { F: fileStreamRef }
    });
  }
  const fileSpecRef = pdfDoc.context.register(fileSpec);
  
  // Get or create Names dictionary
  const catalog = pdfDoc.catalog;
  let namesDict: PDFDict;
  try {
    namesDict = catalog.lookup(PDFName.of('Names'), PDFDict);
  } catch {
    namesDict = pdfDoc.context.obj({});
    catalog.set(PDFName.of('Names'), pdfDoc.context.register(namesDict));
  }
  
  if (!namesDict) {
    namesDict = pdfDoc.context.obj({});
    catalog.set(PDFName.of('Names'), pdfDoc.context.register(namesDict));
  }
  
  // Get or create EmbeddedFiles
  let embeddedFilesDict: PDFDict;
  try {
    embeddedFilesDict = namesDict.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
  } catch {
    embeddedFilesDict = pdfDoc.context.obj({
      Names: []
    });
    namesDict.set(PDFName.of('EmbeddedFiles'), pdfDoc.context.register(embeddedFilesDict));
  }
  
  if (!embeddedFilesDict) {
    embeddedFilesDict = pdfDoc.context.obj({
      Names: []
    });
    namesDict.set(PDFName.of('EmbeddedFiles'), pdfDoc.context.register(embeddedFilesDict));
  }
  
  // Add file to names array
  let namesArray: PDFArray;
  try {
    namesArray = embeddedFilesDict.lookup(PDFName.of('Names'), PDFArray);
  } catch {
    namesArray = pdfDoc.context.obj([]);
  }
  
  if (!namesArray) {
    namesArray = pdfDoc.context.obj([]);
  }
  
  // Remove existing file with same name if it exists
  const newNamesArray = [];
  for (let i = 0; i < namesArray.size(); i += 2) {
    const existingName = namesArray.lookup(i);
    if (existingName?.toString() !== `(${fileName})`) {
      newNamesArray.push(namesArray.lookup(i));
      newNamesArray.push(namesArray.lookup(i + 1));
    }
  }
  
  // Add new file
  newNamesArray.push(PDFString.of(fileName));
  newNamesArray.push(fileSpecRef);
  
  embeddedFilesDict.set(PDFName.of('Names'), pdfDoc.context.obj(newNamesArray));
}

/**
 * Remove embedded file using the proven approach
 */
function removeEmbeddedFile(pdfDoc: PDFDocument, fileName: string): boolean {
  try {
    const catalog = pdfDoc.catalog;
    
    let namesDict: PDFDict | undefined;
    try {
      namesDict = catalog.lookup(PDFName.of('Names'), PDFDict);
    } catch {
      return false;
    }
    if (!namesDict) return false;
    
    let embeddedFilesDict: PDFDict | undefined;
    try {
      embeddedFilesDict = namesDict.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
    } catch {
      return false;
    }
    if (!embeddedFilesDict) return false;
    
    let namesArray: PDFArray | undefined;
    try {
      namesArray = embeddedFilesDict.lookup(PDFName.of('Names'), PDFArray);
    } catch {
      return false;
    }
    if (!namesArray) return false;
    
    const newNamesArray = [];
    let removed = false;
    
    for (let i = 0; i < namesArray.size(); i += 2) {
      const name = namesArray.lookup(i);
      if (name?.toString() !== `(${fileName})`) {
        newNamesArray.push(namesArray.lookup(i));
        newNamesArray.push(namesArray.lookup(i + 1));
      } else {
        removed = true;
      }
    }
    
    if (removed) {
      embeddedFilesDict.set(PDFName.of('Names'), pdfDoc.context.obj(newNamesArray));
    }
    
    return removed;
  } catch (error) {
    return false;
  }
}

/**
 * Extract candidate name from resume data
 */
function extractCandidateName(resume: any): string | undefined {
  if (resume.personal_information?.full_name) {
    return resume.personal_information.full_name;
  }
  
  if (resume.personal_information?.first_name && resume.personal_information?.last_name) {
    return `${resume.personal_information.first_name} ${resume.personal_information.last_name}`;
  }
  
  if (resume.basics?.name) {
    return resume.basics.name;
  }
  
  return undefined;
}

/**
 * Extract candidate email from resume data
 */
function extractCandidateEmail(resume: any): string | undefined {
  if (resume.personal_information?.email) {
    return resume.personal_information.email;
  }
  
  if (resume.basics?.email) {
    return resume.basics.email;
  }
  
  if (resume.contact_information?.email) {
    return resume.contact_information.email;
  }
  
  return undefined;
}