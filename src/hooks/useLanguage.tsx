import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type Language = 'es' | 'en' | 'fr' | 'de' | 'pt';

interface LanguageContextProps {
  currentLang: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const detectLanguage = (): Language => {
    const savedLang = localStorage.getItem('portfolio_lang');
    if (savedLang && ['es', 'en', 'fr', 'de', 'pt'].includes(savedLang)) {
      return savedLang as Language;
    }
    const browserLang = navigator.language.split('-')[0];
    if (['es', 'en', 'fr', 'de', 'pt'].includes(browserLang)) {
      return browserLang as Language;
    }
    return 'es'; // Default to Spanish
  };

  const [currentLang, setCurrentLang] = useState<Language>(detectLanguage());

  React.useEffect(() => {
    document.documentElement.lang = currentLang;
  }, [currentLang]);

  const setLanguage = (lang: Language) => {
    setCurrentLang(lang);
    localStorage.setItem('portfolio_lang', lang);
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextProps => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// LocalizedText component for easy inline translations
interface LocalizedTextProps {
  es: string;
  en: string;
  fr: string;
  de: string;
  pt: string;
}

export const LocalizedText: React.FC<LocalizedTextProps> = (props) => {
  const { currentLang } = useLanguage();
  return <>{props[currentLang]}</>;
};
