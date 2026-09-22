import React, { createContext, useState, useContext } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { useBroker } from './BrokerContext';

const ConciergeContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useConcierge = () => useContext(ConciergeContext);

export const ConciergeProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Olá! Sou o Concierge Exclusivo de João Pessoa. Posso ajudar você a encontrar o imóvel ideal com base nas suas preferências de estilo de vida e objetivos de investimento. O que você procura hoje?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { broker } = useBroker();

  const toggleDrawer = () => setIsOpen(!isOpen);

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const newUserMessage = { role: 'user', text };
    const newHistory = [...chatHistory, newUserMessage];
    setChatHistory(newHistory);
    setIsLoading(true);

    try {
      const askConcierge = httpsCallable(functions, 'askConcierge');
      console.log('Sending broker context to AI:', broker);
      const result = await askConcierge({ chatHistory: newHistory, brokerContext: broker });

      const aiResponse = { role: 'ai', text: result.data.response };
      setChatHistory(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error asking concierge:", error);
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Desculpe, ocorreu um erro ao comunicar com o servidor.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConciergeContext.Provider value={{ isOpen, setIsOpen, inputValue, setInputValue, toggleDrawer, chatHistory, isLoading, sendMessage }}>
      {children}
    </ConciergeContext.Provider>
  );
};
