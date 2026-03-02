import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Datenschutz() {
    return (
        <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <Link to="/" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6">
                    <ArrowLeft size={18} />
                    Zurück
                </Link>

                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Datenschutzerklärung</h1>

                    <div className="space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">1. Verantwortlicher</h2>
                            <p>
                                Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br /><br />
                                <strong>Stoicera GesbR</strong><br />
                                Allerheiligen im Mühlkreis 7<br />
                                4320 Perg, Österreich<br />
                                E-Mail: <a href="mailto:office@stoicera.com" className="text-blue-600 dark:text-blue-400 hover:underline">office@stoicera.com</a>
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">2. Erhobene Daten</h2>
                            <p>
                                Bei der Nutzung von PropSecure werden folgende personenbezogene Daten verarbeitet:
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>E-Mail-Adresse und Name bei der Registrierung</li>
                                <li>Prüfprotokolle und dokumentierte Mängel</li>
                                <li>Hochgeladene Fotos von Gebäudeschäden</li>
                                <li>IP-Adressen und Zugriffszeitpunkte (Server-Logs)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">3. Zweck der Verarbeitung</h2>
                            <p>
                                Die Datenverarbeitung erfolgt zur:
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Bereitstellung der Prüfungssoftware nach ÖNORM B 1300</li>
                                <li>Erstellung und Speicherung von Prüfberichten</li>
                                <li>Benutzerauthentifizierung und Kontosicherheit</li>
                                <li>Erfüllung gesetzlicher Dokumentationspflichten</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">4. Rechtsgrundlage</h2>
                            <p>
                                Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO
                                (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
                                an der Sicherheit und Funktionsfähigkeit unserer Dienste).
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">5. Speicherdauer</h2>
                            <p>
                                Prüfprotokolle werden gemäß gesetzlicher Aufbewahrungspflichten für
                                mindestens 10 Jahre gespeichert. Benutzerkonten können auf Anfrage
                                gelöscht werden.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">6. Ihre Rechte</h2>
                            <p>Sie haben das Recht auf:</p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Auskunft über Ihre gespeicherten Daten</li>
                                <li>Berichtigung unrichtiger Daten</li>
                                <li>Löschung Ihrer Daten (unter Beachtung gesetzlicher Aufbewahrungspflichten)</li>
                                <li>Einschränkung der Verarbeitung</li>
                                <li>Datenübertragbarkeit</li>
                                <li>Beschwerde bei der Datenschutzbehörde</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">7. Kontakt</h2>
                            <p>
                                Bei Fragen zum Datenschutz wenden Sie sich bitte an:<br />
                                <a href="mailto:office@stoicera.com" className="text-blue-600 dark:text-blue-400 hover:underline">office@stoicera.com</a>
                            </p>
                        </section>

                        <section className="text-xs text-gray-500 dark:text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <p>Stand: Januar 2026</p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
