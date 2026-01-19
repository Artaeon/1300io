import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Impressum() {
    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
                    <ArrowLeft size={18} />
                    Zurück
                </Link>

                <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Impressum</h1>

                    <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
                        <section>
                            <h2 className="font-semibold text-gray-900 mb-2">Angaben gemäß § 5 ECG</h2>
                            <p>
                                <strong>Stoicera GesbR</strong><br />
                                Allerheiligen im Mühlkreis 7<br />
                                4320 Perg<br />
                                Österreich
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 mb-2">Kontakt</h2>
                            <p>
                                E-Mail: <a href="mailto:office@stoicera.com" className="text-blue-600 hover:underline">office@stoicera.com</a><br />
                                Telefon: +43 (0) XXX XXX XXX
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 mb-2">Unternehmensgegenstand</h2>
                            <p>
                                Entwicklung und Betrieb von Software-Lösungen für Immobilienprüfungen
                                nach ÖNORM B 1300. Dienstleistungen im Bereich Softwareentwicklung und IT-Beratung.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 mb-2">Haftungsausschluss</h2>
                            <p>
                                Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung
                                für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten
                                sind ausschließlich deren Betreiber verantwortlich.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-semibold text-gray-900 mb-2">Urheberrecht</h2>
                            <p>
                                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
                                Seiten unterliegen dem österreichischen Urheberrecht. Die Vervielfältigung,
                                Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen
                                des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen
                                Autors bzw. Erstellers.
                            </p>
                        </section>

                        <section className="text-xs text-gray-500 pt-4 border-t">
                            <p>Stand: Januar 2026</p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
