// Password policy for enterprise deployment.
//
// Required:
//   - 12+ characters
//   - at least one lowercase, one uppercase, one digit
//   - not in the short blocklist below
//
// NIST SP 800-63B no longer recommends mandatory symbol classes or
// periodic rotation; both push users toward predictable patterns
// ("Password1!" → "Password2!"). The length floor and a breach
// blocklist do most of the security work.
//
// For production, pair this with Have I Been Pwned's k-anonymity API
// (/range/<first5sha1>) to block any password that has appeared in a
// real breach. That's a network call and best left to a wrapper.

const TOP_WEAK = new Set([
  'password',
  'passwort',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'qwertz',
  'abc123',
  'letmein',
  'welcome',
  'admin',
  'administrator',
  'changeme',
  'iloveyou',
  'monkey',
  'password1',
  'password123',
  'passwort1',
  'passwort123',
  'test1234',
  'geheim',
  'stoicera',
  'onorm',
  '1300io',
]);

const MIN_LENGTH = 12;

export interface PolicyResult {
  ok: boolean;
  reasons: string[];
}

export function checkPasswordPolicy(password: string): PolicyResult {
  const reasons: string[] = [];

  if (password.length < MIN_LENGTH) {
    reasons.push(`Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein.`);
  }
  if (!/[a-z]/.test(password)) {
    reasons.push('Passwort muss einen Kleinbuchstaben enthalten.');
  }
  if (!/[A-Z]/.test(password)) {
    reasons.push('Passwort muss einen Großbuchstaben enthalten.');
  }
  if (!/[0-9]/.test(password)) {
    reasons.push('Passwort muss eine Ziffer enthalten.');
  }
  if (TOP_WEAK.has(password.toLowerCase())) {
    reasons.push('Passwort ist zu häufig / zu leicht zu erraten.');
  }

  return { ok: reasons.length === 0, reasons };
}

export const passwordPolicyMin = MIN_LENGTH;
