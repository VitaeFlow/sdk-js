/**
 * Resume embedding functionality
 * Implements the complete embedResume operation with triple metadata levels
 */

import { PDFDocument, PDFArray, PDFStream, PDFName, PDFNumber, PDFString } from 'pdf-lib';
import { Resume } from '../types/resume';
import { EmbedOptions } from '../types/options';
import { 
  loadPDF, 
  getOrCreateEmbeddedFilesDict, 
  getEmbeddedFilesNamesArray, 
  setEmbeddedFilesNamesArray,
  findEmbeddedFileByName,
  removeEmbeddedFile,
  addEmbeddedFile,
  createTimestamp,
  ensureUint8Array
} from './utils';
import { 
  createFileSpec, 
  createVFMetadataForEmbed 
} from './metadata';
import { 
  addXMPToPDF, 
  createXMPDataForEmbed 
} from './xmp';
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
  pdf: Buffer | Uint8Array,
  resume: Resume,
  options: EmbedOptions = {}
): Promise<Buffer> {
  // Merge options with defaults
  const opts = { ...DEFAULT_EMBED_OPTIONS, ...options };
  
  try {
    // Step 1: Load and validate PDF
    const pdfDoc = await loadPDF(pdf);
    
    // Step 2: Validate resume data if requested
    if (opts.validate) {
      // TODO: Implement validation when validator is ready
      // For now, we'll skip validation to keep the core embedding working
    }
    
    // Step 3: Ensure schema_version is set
    const resumeData = {
      ...resume,
      schema_version: resume.schema_version || CURRENT_VERSION
    };
    
    // Step 4: Serialize resume to JSON
    const jsonData = JSON.stringify(resumeData, null, 2);
    const originalSize = getDataSize(jsonData);
    
    // Step 5: Calculate checksum on original JSON (before compression)
    const checksum = await calculateChecksum(jsonData);
    
    // Step 6: Determine if compression is needed
    const compress = shouldCompress(jsonData, opts.compress || 'auto');
    
    // Step 7: Prepare final data
    let finalData: Uint8Array;
    let compressedSize: number;
    
    if (compress) {
      finalData = compressData(jsonData);
      compressedSize = finalData.length;
    } else {
      finalData = new TextEncoder().encode(jsonData);
      compressedSize = originalSize;
    }
    
    // Step 8: Create embedded file stream
    const embeddedFile = await createEmbeddedFileStream(
      pdfDoc, 
      finalData, 
      compress, 
      originalSize
    );
    const embeddedFileRef = pdfDoc.context.register(embeddedFile);
    
    // Step 9: Create VF metadata
    const timestamp = createTimestamp();
    const vfMetadata = createVFMetadataForEmbed(
      checksum,
      timestamp,
      compress,
      originalSize,
      compressedSize
    );
    
    // Step 10: Create FileSpec with metadata
    console.log('Creating FileSpec with embeddedFileRef:', embeddedFileRef);
    console.log('VF metadata:', vfMetadata);
    const fileSpec = createFileSpec(pdfDoc, embeddedFileRef, vfMetadata);
    console.log('FileSpec created:', fileSpec);
    const fileSpecRef = pdfDoc.context.register(fileSpec);
    
    // Step 11: Add to /Names/EmbeddedFiles
    console.log('Adding to embedded files with fileSpecRef:', fileSpecRef);
    await addToEmbeddedFiles(pdfDoc, fileSpecRef);
    
    // Step 12: Add XMP metadata (unless skipped)
    if (!opts.skipXMP) {
      const xmpData = createXMPDataForEmbed(
        extractCandidateName(resumeData),
        extractCandidateEmail(resumeData),
        checksum
      );
      addXMPToPDF(pdfDoc, xmpData);
    }
    
    // Step 13: Return modified PDF
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
 * Create embedded file stream with proper filters and parameters
 */
async function createEmbeddedFileStream(
  pdfDoc: PDFDocument,
  data: Uint8Array,
  compressed: boolean,
  originalSize: number
): Promise<PDFStream> {
  const timestamp = createTimestamp();
  
  if (compressed) {
    // Create compressed stream with FlateDecode filter
    const stream = pdfDoc.context.flateStream(data);
    
    // Add parameters
    stream.dict.set(PDFName.of('Length'), PDFNumber.of(data.length));
    stream.dict.set(PDFName.of('Params'), pdfDoc.context.obj({
      Size: PDFNumber.of(originalSize),
      CreationDate: PDFString.of(`D:${timestamp.replace(/[-:]/g, '').replace('T', '').split('.')[0]}Z`),
      ModDate: PDFString.of(`D:${timestamp.replace(/[-:]/g, '').replace('T', '').split('.')[0]}Z`),
    }));
    
    return stream;
  } else {
    // Create uncompressed stream
    const stream = pdfDoc.context.stream(data);
    
    // Add parameters
    stream.dict.set(PDFName.of('Length'), PDFNumber.of(data.length));
    stream.dict.set(PDFName.of('Params'), pdfDoc.context.obj({
      Size: PDFNumber.of(originalSize),
      CreationDate: PDFString.of(`D:${timestamp.replace(/[-:]/g, '').replace('T', '').split('.')[0]}Z`),
      ModDate: PDFString.of(`D:${timestamp.replace(/[-:]/g, '').replace('T', '').split('.')[0]}Z`),
    }));
    
    return stream;
  }
}

/**
 * Add FileSpec to EmbeddedFiles Names array
 */
async function addToEmbeddedFiles(pdfDoc: PDFDocument, fileSpecRef: any): Promise<void> {
  console.log('Getting embedded files dict...');
  const embeddedFilesDict = getOrCreateEmbeddedFilesDict(pdfDoc);
  console.log('Embedded files dict:', embeddedFilesDict);
  let namesArray = getEmbeddedFilesNamesArray(embeddedFilesDict);
  console.log('Names array:', namesArray);
  
  if (!namesArray) {
    // Create new Names array
    namesArray = pdfDoc.context.obj([]);
    setEmbeddedFilesNamesArray(embeddedFilesDict, namesArray);
  }
  
  // Check if resume.json already exists and remove it
  const existing = findEmbeddedFileByName(namesArray, RESUME_FILENAME);
  if (existing) {
    removeEmbeddedFile(namesArray, existing.index);
  }
  
  // Add new entry
  addEmbeddedFile(namesArray, RESUME_FILENAME, fileSpecRef);
}

/**
 * Extract candidate name from resume data
 */
function extractCandidateName(resume: any): string | undefined {
  // Try different possible locations for name
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
  // Try different possible locations for email
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