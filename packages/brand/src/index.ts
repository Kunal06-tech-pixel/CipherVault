export const brand = Object.freeze({
  productName: 'Keywall',
  slug: 'keywall',
  packageScope: '@keywall',
  supportEmail: 'security@keywall.local',
  smtpFrom: 'security@keywall.local',
  seo: {
    title: 'Keywall - zero-knowledge password manager',
    description: 'Keywall is a production-beta zero-knowledge password manager with client-side encryption and ciphertext-only sync.',
  },
  pwa: {
    name: 'Keywall',
    shortName: 'Keywall',
    themeColor: '#0A0C0B',
    description: 'Zero-knowledge password manager',
  },
  extension: {
    name: 'Keywall',
    description: 'Zero-knowledge password autofill for Keywall.',
    openCommand: 'open-keywall',
  },
  copy: {
    betaLabel: 'Controlled production beta',
    launchCta: 'Launch app',
    createAccountCta: 'Create account',
    privacyClaim: 'Keys stay on your device. Servers synchronize ciphertext only.',
  },
})

export const protocolCompatibility = Object.freeze({
  legacySlug: 'ciphervault',
  note: 'Protocol and storage identifiers intentionally keep the legacy slug so existing encrypted beta data remains readable.',
})

export type Brand = typeof brand
