# Pull Request

## Was wurde geändert

<!-- Kurze Beschreibung, worum es geht. Ein oder zwei Sätze reichen. -->

## Warum

<!-- Welches Problem wird gelöst? Was passiert, wenn wir nichts tun? -->

## Änderungen im Überblick

<!-- Stichpunktliste der wichtigsten Änderungen, nicht jede Datei. -->

-
-

## Tests

<!-- Wie wurde geprüft, dass es funktioniert? -->

- [ ] `npm run lint` läuft durch
- [ ] `npm run test` läuft durch (Server und Client)
- [ ] Manuell im Browser getestet (falls UI-relevant)
- [ ] Migrationen: `prisma migrate deploy` angewendet (falls Schema-Änderung)

## Sicherheit / Datenschutz

<!-- Nur ausfüllen, wenn relevant. Löschen, wenn nicht. -->

- [ ] Neue Endpunkte prüfen Authentifizierung und Organisation-Scoping
- [ ] Keine Secrets im Diff (überprüft mit `git diff | grep -i secret`)
- [ ] Input-Validierung via Zod-Schema für neue Request-Bodies

## Breaking changes

<!-- Migrationen, Konfig-Änderungen, API-Brüche. Leer lassen, wenn keine. -->

## Screenshots / Protokolle

<!-- Nur bei UI- oder Log-Änderungen. -->
