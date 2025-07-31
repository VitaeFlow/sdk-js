# @vitaeflow/sdk

> JavaScript/TypeScript SDK for VitaeFlow - embed structured resume data in PDFs

🚧 **Work in Progress** - Phase 1 Complete

## Current Status

✅ **Phase 1 Complete - Foundation**
- Project setup and structure
- Core embedding functionality (`embedResume`)
- Triple metadata levels (XMP, FileSpec, Embedded)
- Cross-platform checksum and compression
- Error handling system
- Basic test suite

## Installation

```bash
npm install @vitaeflow/sdk
```

## Quick Start

```typescript
import { embedResume, validateResume } from '@vitaeflow/sdk';
import fs from 'fs';

const pdfBuffer = fs.readFileSync('resume.pdf');

// VitaeFlow v0.1.0 format with structured schema
const resumeData = {
  $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
  specVersion: '0.1.0',
  meta: {
    language: 'en',
    country: 'US',
    source: 'manual-entry'
  },
  resume: {
    basics: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0123'
    },
    experience: [
      {
        position: 'Software Engineer',
        company: 'Acme Corp',
        startDate: '2020-01-01',
        endDate: '2023-01-01',
        current: false,
        summary: 'Developed scalable web applications'
      }
    ]
  }
};

// Validate resume data first
const validation = await validateResume(resumeData);
if (!validation.ok) {
  console.error('Validation failed:', validation.issues);
  process.exit(1);
}

// Embed resume data in PDF
const enhancedPDF = await embedResume(pdfBuffer, resumeData, {
  validate: true,
  validateRules: true,
  compress: 'auto'
});

fs.writeFileSync('enhanced-resume.pdf', enhancedPDF);
```

## Features Implemented

### ✅ embedResume(pdf, resume, options?)
- Embeds structured resume data in PDF
- Triple metadata levels for discoverability
- Automatic compression for large data
- XMP metadata in PDF catalog
- FileSpec with VitaeFlow metadata
- JSON data embedded as "resume.json"

### ✅ Error Handling
- Comprehensive error codes
- Encrypted PDF detection
- File size validation
- PDF structure validation

### ✅ Cross-Platform Support
- Node.js and browser compatible
- Native crypto for checksums
- Compression with pako/zlib

## Advanced Features

### ✅ Validation System
- **Schema Validation**: Automatic validation against VitaeFlow schemas
- **Business Rules**: Advanced content validation rules
- **Multiple Modes**: `strict`, `compatible`, `lenient` validation modes
- **Forward Compatibility**: Graceful handling of future schema versions

### ✅ Schema Auto-Download
- **Remote Schemas**: Automatic download from `$schema` URLs
- **Local Fallback**: Falls back to bundled schemas when remote fails
- **Caching**: In-memory caching of downloaded schemas
- **Security**: Only trusted VitaeFlow schema URLs allowed

### ✅ PDF Extraction
- **Data Extraction**: Extract embedded resume data from PDFs
- **Validation**: Validate extracted data automatically
- **Legacy Support**: Handle both v0.1.0 and legacy v1.0.0 formats

## Validation Modes

### Strict Mode (Default)
```typescript
const result = await validateResume(resumeData, { mode: 'strict' });
```
- Enforces exact schema compliance
- All business rules apply
- Future versions use fallback schemas

### Compatible Mode
```typescript
const result = await validateResume(resumeData, { mode: 'compatible' });
```
- **Forward Compatible**: Handles future minor/patch versions gracefully
- Uses best available compatible schema
- Relaxed version field validation for future versions
- Ideal for production systems that need to handle newer data formats

### Lenient Mode
```typescript
const result = await validateResume(resumeData, { mode: 'lenient' });
```
- Minimal validation
- Skip most business rules
- Use for data migration or development

## Schema Auto-Download

The SDK automatically downloads schemas from `$schema` URLs:

```typescript
const resumeData = {
  $schema: 'https://vitaeflow.org/schemas/v0.1.0/vitaeflow.schema.json',
  specVersion: '0.1.0',
  // ... rest of data
};

// Schema will be automatically downloaded and cached
const result = await validateResume(resumeData);
```

### Supported Schema URLs
- `https://vitaeflow.org/schemas/v*/vitaeflow.schema.json`
- `https://vitaeflow.github.io/vitaeflow-schemas/schemas/v*/vitaeflow.schema.json`
- `https://cdn.jsdelivr.net/npm/@vitaeflow/vitae-schema@*/schemas/v*/vitaeflow.schema.json`

### Manual Control
```typescript
// Disable auto-download
const result = await validateResume(resumeData, { 
  useRemoteSchema: false 
});

// Custom timeout
const result = await validateResume(resumeData, { 
  useRemoteSchema: true,
  remoteTimeout: 10000  // 10 seconds
});
```

## Testing

### Unit Tests
```bash
npm test
```

### Real PDF Tests
For comprehensive testing with actual PDF files:
```bash
cd .real-test
node test-real-pdf.js  # Complete test suite
node verify-pdf.js     # Verify embedded data
```

## Contributing

This project follows the VitaeFlow specification for embedding structured resume data in PDFs to improve ATS parsing accuracy.

## License

MIT