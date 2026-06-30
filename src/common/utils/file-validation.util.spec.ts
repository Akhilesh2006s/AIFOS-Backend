import { BadRequestException } from '@nestjs/common';
import { validateUpload } from './file-validation.util';

function mockFile(partial: Partial<Express.Multer.File> & { buffer: Buffer }): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: partial.originalname || 'doc.pdf',
    encoding: '7bit',
    mimetype: partial.mimetype || 'application/pdf',
    size: partial.size ?? partial.buffer.length,
    buffer: partial.buffer,
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('file-validation.util', () => {
  it('accepts valid PDF with magic bytes', () => {
    const file = mockFile({
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    });
    expect(() => validateUpload(file)).not.toThrow();
  });

  it('rejects disallowed extensions', () => {
    const file = mockFile({
      originalname: 'malware.exe',
      mimetype: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    });
    expect(() => validateUpload(file)).toThrow(BadRequestException);
  });

  it('rejects MIME/extension mismatch for PDF', () => {
    const file = mockFile({
      originalname: 'fake.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('not a pdf'),
    });
    expect(() => validateUpload(file)).toThrow(/does not match/);
  });

  it('rejects oversized files', () => {
    const file = mockFile({
      originalname: 'big.pdf',
      buffer: Buffer.from('%PDF-'),
      size: 30 * 1024 * 1024,
    });
    expect(() => validateUpload(file)).toThrow(/exceeds/);
  });
});
