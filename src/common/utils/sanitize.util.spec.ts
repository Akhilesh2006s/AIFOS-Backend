import { sanitizeMongoFilter, safeJsonParse, clientIp } from './sanitize.util';

describe('sanitize.util', () => {
  describe('sanitizeMongoFilter', () => {
    it('removes $ operator keys', () => {
      const input = { name: 'test', $gt: { age: 1 }, nested: { $where: 'evil' } };
      const result = sanitizeMongoFilter(input);
      expect(result).toEqual({ name: 'test', nested: {} });
    });

    it('preserves safe fields', () => {
      const input = { status: 'active', count: 3 };
      expect(sanitizeMongoFilter(input)).toEqual(input);
    });
  });

  describe('safeJsonParse', () => {
    it('parses and sanitizes JSON objects', () => {
      const raw = JSON.stringify({ tags: ['a'], $gt: 1 });
      expect(safeJsonParse<Record<string, unknown>>(raw)).toEqual({ tags: ['a'] });
    });

    it('rejects empty payloads', () => {
      expect(() => safeJsonParse('   ')).toThrow(/empty/);
    });
  });

  describe('clientIp', () => {
    it('reads x-forwarded-for', () => {
      expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
    });

    it('falls back to req.ip', () => {
      expect(clientIp({ ip: '9.9.9.9' })).toBe('9.9.9.9');
    });
  });
});
