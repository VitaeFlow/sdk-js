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
import { embedResume } from '@vitaeflow/sdk';
import fs from 'fs';

const pdfBuffer = fs.readFileSync('resume.pdf');
const resumeData = {
  schema_version: '1.0.0',
  personal_information: {
    full_name: 'John Doe',
    email: 'john.doe@example.com'
  },
  work_experience: [
    {
      company: 'Acme Corp',
      position: 'Software Engineer',
      start_date: '2020-01-01',
      end_date: '2023-01-01'
    }
  ]
};

// Embed resume data in PDF
const enhancedPDF = await embedResume(pdfBuffer, resumeData, {
  compress: 'auto',
  skipXMP: false
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

## Roadmap

🔄 **Next Phases**
- Phase 2: PDF extraction and validation
- Phase 3: Business rules and schema validation
- Phase 4: Migration system
- Phase 5: Templates and examples

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