window.klaroConfig = {
  version: 1,
  elementID: 'klaro',
  styling: { theme: ['light'] },
  translations: {
    de: {
      consentModal: {
        title: 'Datenschutz-Einstellungen',
        description: 'Wir verwenden Cookies, um dein Erlebnis zu verbessern.',
      },
      ok: 'Alle akzeptieren',
      save: 'Speichern',
      decline: 'Ablehnen',
    },
  },
  apps: [
    {
      name: 'google-analytics',
      title: 'Google Analytics',
      purposes: ['statistics'],
      cookies: ['_ga', '_gid'],
      required: false,
    },
  ],
};
