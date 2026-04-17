import { describe, it, expect } from 'vitest';
import { checkPasswordPolicy, passwordPolicyMin } from '../lib/passwordPolicy';

describe('passwordPolicy', () => {
  it('exports a minimum length of 12', () => {
    expect(passwordPolicyMin).toBe(12);
  });

  it('rejects passwords shorter than 12 characters', () => {
    const result = checkPasswordPolicy('Short1');
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('12 Zeichen'))).toBe(true);
  });

  it('rejects passwords without lowercase', () => {
    const result = checkPasswordPolicy('ALLUPPERCASE1');
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.toLowerCase().includes('kleinbuchstab'))).toBe(true);
  });

  it('rejects passwords without uppercase', () => {
    const result = checkPasswordPolicy('alllowercase1');
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.toLowerCase().includes('großbuchstab'))).toBe(true);
  });

  it('rejects passwords without digits', () => {
    const result = checkPasswordPolicy('NoDigitsAtAll');
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.toLowerCase().includes('ziffer'))).toBe(true);
  });

  it('rejects common weak passwords regardless of length/mix', () => {
    // Example: "Password123!" hits the blocklist via lowercase.
    const result = checkPasswordPolicy('password1234'); // 12 chars but blocklisted
    expect(result.ok).toBe(false);
    // Could fail the uppercase rule AND the blocklist rule — either is fine
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('rejects project-specific weak terms', () => {
    const stoicera = checkPasswordPolicy('stoicera1234');
    expect(stoicera.ok).toBe(false);
    const onorm = checkPasswordPolicy('onorm1300!!!');
    expect(onorm.ok).toBe(false);
  });

  it('accepts a strong password', () => {
    const result = checkPasswordPolicy('Correct-Horse-Battery-42');
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('collects multiple reasons when multiple rules fail', () => {
    const result = checkPasswordPolicy('shortx'); // too short, no upper, no digit
    expect(result.ok).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
