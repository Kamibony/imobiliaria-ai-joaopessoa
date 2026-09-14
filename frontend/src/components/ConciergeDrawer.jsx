import React, { useState, useRef, useEffect } from 'react';
import { useConcierge } from '../ConciergeContext';
import ChatBubble from './ChatBubble';

const ConciergeDrawer = () => {
  const { isOpen, toggleDrawer, chatHistory, isLoading, sendMessage } = useConcierge();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={toggleDrawer}
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-serif text-2xl text-black m-0">O Exclusivo</h2>
            <p className="text-xs text-[#c5a880] uppercase tracking-widest mt-1">Concierge IA</p>
          </div>
          <button
            onClick={toggleDrawer}
            className="text-gray-400 hover:text-black transition-colors bg-transparent border-none p-2"
          >
            ✕
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {chatHistory.map((msg, index) => (
            <ChatBubble key={index} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-sm p-4 text-sm animate-pulse">
                Digitando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-gray-100 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Descreva seu imóvel ideal..."
              className="w-full pl-4 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-black focus:bg-white transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square p-0 rounded-full bg-black text-white hover:bg-[#c5a880] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center border-none"
            >
              ↑
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ConciergeDrawer;
