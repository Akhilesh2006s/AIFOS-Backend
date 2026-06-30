import { BadRequestException } from '@nestjs/common';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt',
]);

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
]);

const MAGIC: Array<{ ext: string; test: (buf: Buffer) => boolean }> = [
  { ext: '.pdf', test: (b) => b.slice(0, 5).toString('ascii') === '%PDF-' },
  { ext: '.png', test: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: '.jpg', test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.jpeg', test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.gif', test: (b) => b.slice(0, 6).toString('ascii').startsWith('GIF8') },
  { ext: '.webp', test: (b) => b.length >= 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
  { ext: '.doc', test: (b) => b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf },
  { ext: '.docx', test: (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b },
  { ext: '.xls', test: (b) => b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf },
  { ext: '.xlsx', test: (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b },
];

function sanitizeFilename(name: string): string {
  return (name || 'upload')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 200);
}

function verifyMagicBytes(buffer: Buffer, ext: string) {
  if (ext === '.csv' || ext === '.txt') return;
  const rule = MAGIC.find((m) => m.ext === ext);
  if (rule && !rule.test(buffer)) {
    throw new BadRequestException('File content does not match declared type');
  }
}

export function validateUpload(file: Express.Multer.File, maxBytes = 25 * 1024 * 1024) {
  if (!file?.buffer?.length && !file?.size) {
    throw new BadRequestException('Empty file upload');
  }
  if (file.size > maxBytes) {
    throw new BadRequestException(`File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`);
  }
  const ext = (file.originalname?.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(`File type ${ext || 'unknown'} not allowed`);
  }
  if (file.mimetype && !ALLOWED_MIMES.has(file.mimetype) && file.mimetype !== 'application/octet-stream') {
    throw new BadRequestException(`MIME type ${file.mimetype} not allowed`);
  }
  const dangerous = /\.(exe|bat|sh|js|html|htm|php|asp|svg)$/i;
  if (dangerous.test(file.originalname)) {
    throw new BadRequestException('Executable or script file types are not allowed');
  }
  if (file.buffer?.length) {
    verifyMagicBytes(file.buffer, ext);
  }
  file.originalname = sanitizeFilename(file.originalname);
}
