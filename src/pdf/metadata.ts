/**
 * FileSpec metadata handling for VitaeFlow
 * Implements the /VF_Metadata dictionary structure
 */

import { PDFDocument, PDFDict, PDFName, PDFString, PDFNumber, PDFBool } from 'pdf-lib';
import { 
  VITAEFLOW_SPEC, 
  VITAEFLOW_TYPE, 
  CURRENT_VERSION,
  AF_RELATIONSHIP,
  FILE_DESCRIPTION,
  RESUME_FILENAME 
} from '../constants';

/**
 * VitaeFlow metadata structure for FileSpec
 */
export interface VFMetadata {
  type: string;
  spec: string;
  version: string;
  checksum: string;
  created: string;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

/**
 * Create a FileSpec dictionary with VitaeFlow metadata
 */
export function createFileSpec(
  pdfDoc: PDFDocument,
  embeddedFileRef: any,
  metadata: VFMetadata
): PDFDict {
  const efDict = pdfDoc.context.obj({
    F: embeddedFileRef,
    UF: embeddedFileRef,
  });

  const fileSpec = pdfDoc.context.obj({
    Type: PDFName.of('Filespec'),
    F: PDFString.of(RESUME_FILENAME),
    UF: PDFString.of(RESUME_FILENAME),
    Desc: PDFString.of(FILE_DESCRIPTION),
    AFRelationship: PDFName.of(AF_RELATIONSHIP),
    EF: efDict,
  });

  // Add VitaeFlow custom metadata
  const vfMetadata = createVFMetadataDict(pdfDoc, metadata);
  fileSpec.set(PDFName.of('VF_Metadata'), vfMetadata);

  return fileSpec as PDFDict;
}

/**
 * Create the /VF_Metadata dictionary
 */
export function createVFMetadataDict(pdfDoc: PDFDocument, metadata: VFMetadata): PDFDict {
  return pdfDoc.context.obj({
    Type: PDFName.of(metadata.type),
    Spec: PDFName.of(metadata.spec),
    Version: PDFString.of(metadata.version),
    Checksum: PDFString.of(metadata.checksum),
    Created: PDFString.of(metadata.created),
    Compressed: metadata.compressed ? PDFBool.True : PDFBool.False,
    OriginalSize: PDFNumber.of(metadata.originalSize),
    CompressedSize: PDFNumber.of(metadata.compressedSize),
  });
}

/**
 * Parse VF_Metadata from a FileSpec dictionary
 */
export function parseVFMetadata(fileSpec: PDFDict): VFMetadata | null {
  try {
    const vfMetadata = fileSpec.lookup(PDFName.of('VF_Metadata'), PDFDict);
    if (!vfMetadata) return null;

    const type = vfMetadata.lookup(PDFName.of('Type'), PDFName)?.decodeText();
    const spec = vfMetadata.lookup(PDFName.of('Spec'), PDFName)?.decodeText();
    const version = vfMetadata.lookup(PDFName.of('Version'), PDFString)?.decodeText();
    const checksum = vfMetadata.lookup(PDFName.of('Checksum'), PDFString)?.decodeText();
    const created = vfMetadata.lookup(PDFName.of('Created'), PDFString)?.decodeText();
    const compressed = vfMetadata.lookup(PDFName.of('Compressed'), PDFBool)?.asBoolean();
    const originalSize = vfMetadata.lookup(PDFName.of('OriginalSize'), PDFNumber)?.asNumber();
    const compressedSize = vfMetadata.lookup(PDFName.of('CompressedSize'), PDFNumber)?.asNumber();

    if (!type || !spec || !version || !checksum || !created || 
        compressed === undefined || originalSize === undefined || compressedSize === undefined) {
      return null;
    }

    return {
      type,
      spec,
      version,
      checksum,
      created,
      compressed,
      originalSize,
      compressedSize,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create VF metadata for embedding
 */
export function createVFMetadataForEmbed(
  checksum: string,
  created: string,
  compressed: boolean,
  originalSize: number,
  compressedSize: number
): VFMetadata {
  return {
    type: VITAEFLOW_TYPE,
    spec: VITAEFLOW_SPEC,
    version: CURRENT_VERSION,
    checksum,
    created,
    compressed,
    originalSize,
    compressedSize,
  };
}

/**
 * Validate VF metadata structure
 */
export function validateVFMetadata(metadata: VFMetadata): boolean {
  return (
    typeof metadata.type === 'string' &&
    typeof metadata.spec === 'string' &&
    typeof metadata.version === 'string' &&
    typeof metadata.checksum === 'string' &&
    typeof metadata.created === 'string' &&
    typeof metadata.compressed === 'boolean' &&
    typeof metadata.originalSize === 'number' &&
    typeof metadata.compressedSize === 'number' &&
    metadata.originalSize >= 0 &&
    metadata.compressedSize >= 0
  );
}

/**
 * Check if metadata indicates VitaeFlow data
 */
export function isVitaeFlowMetadata(metadata: VFMetadata): boolean {
  return (
    metadata.type === VITAEFLOW_TYPE &&
    metadata.spec === VITAEFLOW_SPEC
  );
}