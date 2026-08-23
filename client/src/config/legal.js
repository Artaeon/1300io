const splitAddress = (value) =>
    value
        .split('|')
        .map((line) => line.trim())
        .filter(Boolean);

export const legal = {
    name: import.meta.env.VITE_LEGAL_NAME || 'Ihre Organisation',
    addressLines: splitAddress(
        import.meta.env.VITE_LEGAL_ADDRESS || 'Anschrift in der Umgebung konfigurieren',
    ),
    email: import.meta.env.VITE_LEGAL_EMAIL || 'kontakt@example.com',
    phone: import.meta.env.VITE_LEGAL_PHONE || '',
};
