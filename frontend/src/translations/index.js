import en from './en';
import tr from './tr';

const translations = {
  en,
  tr
};

export const getTranslation = (language) => {
  return translations[language] || translations.en;
};

export const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Kiswahili' }
];

export default translations;
