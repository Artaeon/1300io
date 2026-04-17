import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AGB() {
    return (
        <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6"
                >
                    <ArrowLeft size={18} />
                    Zurück
                </Link>

                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Allgemeine Geschäftsbedingungen
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mb-8">
                        Stand: April 2026
                    </p>

                    <div className="space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">1. Geltungsbereich</h2>
                            <p>
                                Diese AGB regeln die Nutzung der Software 1300.io (nachfolgend „Dienst“)
                                der Stoicera GesbR, Allerheiligen im Mühlkreis 7, 4320 Perg, Österreich
                                (nachfolgend „Anbieter“) durch registrierte Nutzer (nachfolgend „Kunde“).
                                Abweichende Bedingungen des Kunden werden nicht anerkannt, sofern der
                                Anbieter ihrer Geltung nicht ausdrücklich schriftlich zustimmt.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">2. Leistungsumfang</h2>
                            <p>
                                Der Anbieter stellt eine webbasierte Software zur Durchführung und
                                Dokumentation von Sicherheitsbegehungen nach ÖNORM B 1300 bereit. Der
                                Funktionsumfang ergibt sich aus der jeweils aktuellen Produktbeschreibung.
                                Der Anbieter ist berechtigt, den Funktionsumfang im Rahmen der technischen
                                Weiterentwicklung anzupassen, sofern dies für den Kunden zumutbar ist.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">3. Registrierung und Zugang</h2>
                            <p>
                                Die Nutzung des Dienstes setzt eine Registrierung voraus. Der Kunde ist
                                verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen und
                                seine Zugangsdaten vertraulich zu behandeln. Jede Weitergabe an Dritte
                                ist untersagt. Der Kunde haftet für alle Handlungen, die über sein Konto
                                vorgenommen werden.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">4. Verfügbarkeit</h2>
                            <p>
                                Der Anbieter ist bemüht, eine möglichst hohe Verfügbarkeit zu
                                gewährleisten, schuldet diese jedoch nicht als Erfolg. Wartungsarbeiten,
                                höhere Gewalt und andere vom Anbieter nicht zu vertretende Umstände
                                können zu temporären Einschränkungen führen. Eine konkret zugesicherte
                                Verfügbarkeit ergibt sich nur aus einem gesonderten SLA.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">5. Pflichten des Kunden</h2>
                            <p>
                                Der Kunde ist verpflichtet, den Dienst im Rahmen der geltenden Gesetze
                                zu nutzen. Es ist insbesondere untersagt, Inhalte hochzuladen, die gegen
                                Rechte Dritter verstoßen, automatisierte Abfragen in einem Umfang
                                durchzuführen, der den Betrieb beeinträchtigt, oder Sicherheitsmaßnahmen
                                zu umgehen. Für die Richtigkeit der im Dienst erfassten Daten
                                (insbesondere Prüfprotokolle) ist der Kunde selbst verantwortlich.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">6. Haftung</h2>
                            <p>
                                Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit
                                sowie nach Maßgabe des Produkthaftungsgesetzes. Für leichte Fahrlässigkeit
                                haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten und
                                begrenzt auf den vertragstypisch vorhersehbaren Schaden. Eine Haftung
                                für mittelbare Schäden, entgangenen Gewinn oder Datenverluste ist,
                                soweit gesetzlich zulässig, ausgeschlossen.
                            </p>
                            <p className="mt-2">
                                Die im Dienst generierten Prüfberichte ersetzen nicht die fachliche
                                Beurteilung durch eine qualifizierte Person. Der Anbieter übernimmt
                                keine Gewähr für die Rechtskonformität der auf Basis der Berichte
                                getroffenen Maßnahmen.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">7. Datenschutz</h2>
                            <p>
                                Die Verarbeitung personenbezogener Daten erfolgt gemäß der
                                <Link to="/datenschutz" className="text-blue-600 dark:text-blue-400 hover:underline"> Datenschutzerklärung</Link>.
                                Der Kunde bleibt Eigentümer der von ihm hochgeladenen Daten und räumt
                                dem Anbieter lediglich die zur Erbringung der Leistung notwendigen
                                Nutzungsrechte ein.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">8. Laufzeit und Kündigung</h2>
                            <p>
                                Der Vertrag wird auf unbestimmte Zeit geschlossen und kann von beiden
                                Seiten jederzeit zum Ende des Monats gekündigt werden, sofern im
                                Einzelvertrag nichts anderes vereinbart wurde. Das Recht zur
                                außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
                                Nach Vertragsende werden die Daten des Kunden binnen 30 Tagen gelöscht,
                                sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">9. Schlussbestimmungen</h2>
                            <p>
                                Es gilt österreichisches Recht unter Ausschluss des UN-Kaufrechts.
                                Ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem
                                Vertragsverhältnis ist, soweit gesetzlich zulässig, der Sitz des
                                Anbieters. Sollten einzelne Bestimmungen unwirksam sein, bleibt die
                                Wirksamkeit der übrigen unberührt.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
