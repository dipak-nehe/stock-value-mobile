/** The app and the site are bilingual; screen and page objects take the language their texts are in. */
export type Lang = 'en' | 'es';

/** The English or the Spanish version of a text. */
export const say = (lang: Lang, en: string, es: string): string => (lang === 'es' ? es : en);
