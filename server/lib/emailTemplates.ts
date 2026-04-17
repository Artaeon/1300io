import { config } from '../config';

/**
 * Email bodies. Kept in one file so copy review is cheap and the
 * German wording stays consistent across verification vs. reset.
 *
 * URLs are built from config.frontendUrl so the links land on the
 * client's /verify-email and /reset-password routes.
 */

export function verificationEmail(name: string, token: string): {
  subject: string;
  text: string;
  html: string;
} {
  const url = `${config.frontendUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = '1300.io — E-Mail-Adresse bestätigen';
  const text =
    `Hallo ${name},\n\n` +
    `bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr 1300.io-Konto zu aktivieren.\n\n` +
    `Link (24h gültig):\n${url}\n\n` +
    `Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.\n\n` +
    `— 1300.io`;
  const html =
    `<!doctype html><html><body style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;color:#1f2937">` +
    `<h2 style="margin:0 0 16px;color:#111827">E-Mail-Adresse bestätigen</h2>` +
    `<p>Hallo ${escapeHtml(name)},</p>` +
    `<p>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr 1300.io-Konto zu aktivieren.</p>` +
    `<p style="margin:24px 0"><a href="${url}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">E-Mail bestätigen</a></p>` +
    `<p style="color:#6b7280;font-size:13px">Oder kopieren Sie diesen Link: <br>${url}</p>` +
    `<p style="color:#6b7280;font-size:13px">Der Link ist 24 Stunden gültig. Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.</p>` +
    `<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb">` +
    `<p style="color:#9ca3af;font-size:12px">1300.io — Sicherheitsbegehung nach ÖNORM B 1300</p>` +
    `</body></html>`;
  return { subject, text, html };
}

export function passwordResetEmail(name: string, token: string): {
  subject: string;
  text: string;
  html: string;
} {
  const url = `${config.frontendUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = '1300.io — Passwort zurücksetzen';
  const text =
    `Hallo ${name},\n\n` +
    `es wurde ein neues Passwort für Ihr 1300.io-Konto angefordert.\n\n` +
    `Link (60 Minuten gültig):\n${url}\n\n` +
    `Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail bitte und melden sich mit Ihrem bisherigen Passwort an. Bei Verdacht auf einen Sicherheitsvorfall wenden Sie sich an security@stoicera.com.\n\n` +
    `— 1300.io`;
  const html =
    `<!doctype html><html><body style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;color:#1f2937">` +
    `<h2 style="margin:0 0 16px;color:#111827">Passwort zurücksetzen</h2>` +
    `<p>Hallo ${escapeHtml(name)},</p>` +
    `<p>es wurde ein neues Passwort für Ihr 1300.io-Konto angefordert.</p>` +
    `<p style="margin:24px 0"><a href="${url}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Passwort zurücksetzen</a></p>` +
    `<p style="color:#6b7280;font-size:13px">Oder kopieren Sie diesen Link: <br>${url}</p>` +
    `<p style="color:#6b7280;font-size:13px"><strong>Der Link ist 60 Minuten gültig.</strong> Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail bitte. Bei Verdacht auf einen Vorfall: security@stoicera.com</p>` +
    `<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb">` +
    `<p style="color:#9ca3af;font-size:12px">1300.io — Sicherheitsbegehung nach ÖNORM B 1300</p>` +
    `</body></html>`;
  return { subject, text, html };
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
