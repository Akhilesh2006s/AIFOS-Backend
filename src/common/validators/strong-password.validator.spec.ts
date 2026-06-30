import { assertStrongPassword, isStrongPassword } from './strong-password.validator';

describe('strong-password.validator', () => {
  it('accepts valid enterprise passwords', () => {
    expect(isStrongPassword('TestAdmin!Pass2026')).toBe(true);
    expect(() => assertStrongPassword('Secure#Pass1234')).not.toThrow();
  });

  it('rejects short passwords', () => {
    expect(isStrongPassword('Short1!')).toBe(false);
  });

  it('rejects passwords missing character classes', () => {
    expect(isStrongPassword('alllowercase123!')).toBe(false);
    expect(isStrongPassword('ALLUPPERCASE123!')).toBe(false);
    expect(isStrongPassword('NoDigitsHere!!!!')).toBe(false);
    expect(isStrongPassword('NoSpecialChar123')).toBe(false);
  });

  it('assertStrongPassword throws with guidance', () => {
    expect(() => assertStrongPassword('weak')).toThrow(/12–128 characters/);
  });
});
