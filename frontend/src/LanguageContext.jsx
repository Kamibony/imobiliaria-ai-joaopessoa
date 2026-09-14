import React, { createContext, useState, useContext, useEffect } from 'react';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('appLanguage') || 'pt-BR';
  });

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'pt-BR' ? 'en' : 'pt-BR'));
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => useContext(LanguageContext);

// Helper function to extract correct string based on context language
// eslint-disable-next-line react-refresh/only-export-components
export const getLocalizedText = (field, currentLanguage) => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[currentLanguage] || field['pt-BR'] || Object.values(field)[0] || '';
};
