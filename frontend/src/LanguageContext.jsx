import React, { createContext, useState, useContext } from 'react';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('pt-BR');

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'pt-BR' ? 'en' : 'pt-BR');
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export const getLocalizedText = (val, currentLang) => {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object' || Array.isArray(val)) return val;

  if (val[currentLang] !== undefined) return val[currentLang];
  if (val['pt-BR'] !== undefined) return val['pt-BR'];

  const keys = Object.keys(val);
  if (keys.length > 0) return val[keys[0]];

  return ''; // Safe fallback to avoid returning raw objects to DOM
};
