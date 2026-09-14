import React from 'react';
import PropertySuggestionCard from './PropertySuggestionCard';

const ChatBubble = ({ message }) => {
  const isAI = message.role === 'ai';

  // Parse text for [RECOMMENDATION: slug] tags
  const text = message.text;
  const regex = /\[RECOMMENDATION:\s*([^\]]+)\]/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    // Add the recommendation component
    parts.push({ type: 'recommendation', slug: match[1].trim() });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <div className={`flex w-full ${isAI ? 'justify-start' : 'justify-end'} mb-4`}>
      <div
        className={`max-w-[85%] p-4 rounded-2xl ${
          isAI
            ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
            : 'bg-black text-white rounded-tr-sm'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap font-sans">
          {parts.length > 0 ? parts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={index}>{part.content}</span>;
            } else if (part.type === 'recommendation') {
              return <PropertySuggestionCard key={index} slug={part.slug} />;
            }
            return null;
          }) : (
            <span>{text}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
