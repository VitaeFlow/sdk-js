/**
 * XMP metadata handling for VitaeFlow
 * Implements XMP creation and parsing with VitaeFlow namespace
 */

import { PDFDocument, PDFStream, PDFName, PDFDict } from 'pdf-lib';
import { 
  VITAEFLOW_NAMESPACE, 
  XMP_VITAEFLOW_PREFIX, 
  CURRENT_VERSION 
} from '../constants';
import { escapeXml, parseXmlKeyValues } from '../utils/xml';

/**
 * VitaeFlow XMP metadata structure
 */
export interface VitaeFlowXMP {
  hasStructuredData: boolean;
  specVersion: string;
  candidateName?: string;
  candidateEmail?: string;
  checksum?: string;
  lastModified?: string;
  resumeId?: string;
}

/**
 * Create XMP metadata stream with VitaeFlow data
 */
export function createXMPMetadata(
  pdfDoc: PDFDocument,
  xmpData: VitaeFlowXMP
): PDFStream {
  const xmpXml = generateXMPXml(xmpData);
  const xmpBytes = new TextEncoder().encode(xmpXml);
  
  const xmpStream = pdfDoc.context.stream(xmpBytes);
  xmpStream.dict.set(PDFName.of('Type'), PDFName.of('Metadata'));
  xmpStream.dict.set(PDFName.of('Subtype'), PDFName.of('XML'));
  
  return xmpStream;
}

/**
 * Generate XMP XML content
 */
export function generateXMPXml(xmpData: VitaeFlowXMP): string {
  const timestamp = new Date().toISOString();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="VitaeFlow SDK">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:${XMP_VITAEFLOW_PREFIX}="${VITAEFLOW_NAMESPACE}"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        ${XMP_VITAEFLOW_PREFIX}:hasStructuredData="${xmpData.hasStructuredData}"
        ${XMP_VITAEFLOW_PREFIX}:specVersion="${escapeXml(xmpData.specVersion)}"${
          xmpData.candidateName ? `\n        ${XMP_VITAEFLOW_PREFIX}:candidateName="${escapeXml(xmpData.candidateName)}"` : ''
        }${
          xmpData.candidateEmail ? `\n        ${XMP_VITAEFLOW_PREFIX}:candidateEmail="${escapeXml(xmpData.candidateEmail)}"` : ''
        }${
          xmpData.checksum ? `\n        ${XMP_VITAEFLOW_PREFIX}:checksum="${escapeXml(xmpData.checksum)}"` : ''
        }${
          xmpData.lastModified ? `\n        ${XMP_VITAEFLOW_PREFIX}:lastModified="${escapeXml(xmpData.lastModified)}"` : ''
        }${
          xmpData.resumeId ? `\n        ${XMP_VITAEFLOW_PREFIX}:resumeId="${escapeXml(xmpData.resumeId)}"` : ''
        }
        xmp:MetadataDate="${timestamp}"
        xmp:ModifyDate="${timestamp}">
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
}

/**
 * Add XMP metadata to PDF catalog
 */
export function addXMPToPDF(pdfDoc: PDFDocument, xmpData: VitaeFlowXMP): void {
  const xmpStream = createXMPMetadata(pdfDoc, xmpData);
  const xmpRef = pdfDoc.context.register(xmpStream);
  
  // Add metadata stream to catalog
  pdfDoc.catalog.set(PDFName.of('Metadata'), xmpRef);
}

/**
 * Parse XMP metadata from PDF
 */
export function parseXMPMetadata(metadataStream: PDFStream): VitaeFlowXMP | null {
  try {
    // Get stream contents (should be uncompressed XML now)
    const streamData = (metadataStream as any).contents || new Uint8Array();
    const xmpXml = new TextDecoder().decode(streamData);
    
    return parseXMPXml(xmpXml);
  } catch (error) {
    return null;
  }
}

/**
 * Parse VitaeFlow data from XMP XML
 */
export function parseXMPXml(xmpXml: string): VitaeFlowXMP | null {
  try {
    const keyValues = parseXmlKeyValues(xmpXml);
    const vfPrefix = `${XMP_VITAEFLOW_PREFIX}:`;
    
    // Extract VitaeFlow-specific fields
    const hasStructuredDataStr = keyValues[`${vfPrefix}hasStructuredData`];
    const specVersion = keyValues[`${vfPrefix}specVersion`];
    
    if (!hasStructuredDataStr || !specVersion) {
      return null;
    }
    
    const hasStructuredData = hasStructuredDataStr.toLowerCase() === 'true';
    
    const result: VitaeFlowXMP = {
      hasStructuredData,
      specVersion,
    };
    
    // Only add optional properties if they exist
    const candidateName = keyValues[`${vfPrefix}candidateName`];
    if (candidateName) result.candidateName = candidateName;
    
    const candidateEmail = keyValues[`${vfPrefix}candidateEmail`];
    if (candidateEmail) result.candidateEmail = candidateEmail;
    
    const checksum = keyValues[`${vfPrefix}checksum`];
    if (checksum) result.checksum = checksum;
    
    const lastModified = keyValues[`${vfPrefix}lastModified`];
    if (lastModified) result.lastModified = lastModified;
    
    const resumeId = keyValues[`${vfPrefix}resumeId`];
    if (resumeId) result.resumeId = resumeId;
    
    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Extract XMP metadata from PDF document
 */
export function extractXMPFromPDF(pdfDoc: PDFDocument): VitaeFlowXMP | null {
  try {
    const metadataRef = pdfDoc.catalog.lookup(PDFName.of('Metadata'));
    if (!metadataRef) return null;
    
    const metadataStream = pdfDoc.context.lookup(metadataRef, PDFStream);
    if (!metadataStream) return null;
    
    return parseXMPMetadata(metadataStream);
  } catch (error) {
    return null;
  }
}

/**
 * Create XMP data for embedding
 */
export function createXMPDataForEmbed(
  candidateName?: string,
  candidateEmail?: string,
  checksum?: string,
  resumeId?: string
): VitaeFlowXMP {
  const result: VitaeFlowXMP = {
    hasStructuredData: true,
    specVersion: CURRENT_VERSION,
    lastModified: new Date().toISOString(),
  };
  
  // Only add optional properties if they are provided
  if (candidateName) result.candidateName = candidateName;
  if (candidateEmail) result.candidateEmail = candidateEmail;
  if (checksum) result.checksum = checksum;
  if (resumeId) result.resumeId = resumeId;
  
  return result;
}

/**
 * Check if PDF has VitaeFlow XMP metadata
 */
export function hasVitaeFlowXMP(pdfDoc: PDFDocument): boolean {
  const xmpData = extractXMPFromPDF(pdfDoc);
  return xmpData?.hasStructuredData === true;
}