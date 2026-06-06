import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import { getTranslation } from '../translations';

const LanguageContext = createContext();

const STORAGE_KEY = 'iheza_language';

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  });

  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = useCallback((key, fallback) => {
    const translations = getTranslation(language);
    const value = translations[key];
    if (value !== undefined && value !== null) {
      return value;
    }
    // Fallback to English if key not found in current language
    const enTranslations = getTranslation('en');
    const enValue = enTranslations[key];
    if (enValue !== undefined && enValue !== null) {
      return enValue;
    }
    // Return the key itself as last resort
    return fallback || key;
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'tr' : 'en');
  }, [language, setLanguage]);

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t,
    isEnglish: language === 'en',
    isTurkish: language === 'tr',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
