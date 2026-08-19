import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(undefined);

export const LanguageProvider = ({ children }) => {
  const detectLanguage = () => {
    const savedLang = localStorage.getItem('portfolio_lang');
    if (savedLang && ['es', 'en', 'fr', 'de', 'pt'].includes(savedLang)) {
      return savedLang;
    }
    const browserLang = navigator.language.split('-')[0];
    if (['es', 'en', 'fr', 'de', 'pt'].includes(browserLang)) {
      return browserLang;
    }
    return 'es';
  };

  const [currentLang, setCurrentLang] = useState(detectLanguage());

  React.useEffect(() => {
    document.documentElement.lang = currentLang;
  }, [currentLang]);

  const setLanguage = (lang) => {
    setCurrentLang(lang);
    localStorage.setItem('portfolio_lang', lang);
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LocalizedText = (props) => {
  const { currentLang } = useLanguage();
  return <>{props[currentLang]}</>;
};
