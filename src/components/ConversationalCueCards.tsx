import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Chat, User } from '../types';

interface ConversationalCueCardsProps {
  chat: Chat;
  user: User | null;
  onSuggestionClick: (suggestion: string) => void;
}

interface CueSuggestion {
  id: string;
  prompt: string;
  message: string;
  category: 'question' | 'activity' | 'follow-up' | 'interest' | 'plans' | 'linkbot';
  type?: 'user' | 'linkbot';
}

const ConversationalCueCards: React.FC<ConversationalCueCardsProps> = ({ 
  chat, 
  user, 
  onSuggestionClick 
}): JSX.Element => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Generate contextual suggestions based on user and chat
  const generateSuggestions = (): CueSuggestion[] => {
    const suggestions: CueSuggestion[] = [];
    
    if (!user) {
      // Generic suggestions for unknown users
      return [
        { id: '1', prompt: 'Ask about their day', message: "How's your day going so far?", category: 'question', type: 'user' },
        { id: '2', prompt: 'Share weekend plans', message: "Any fun plans for the weekend?", category: 'plans', type: 'user' },
        { id: '3', prompt: 'Coffee meetup', message: "Want to grab coffee sometime this week?", category: 'activity', type: 'user' },
        { id: 'linkbot1', prompt: 'Book a restaurant', message: "@linkbot book a restaurant that fits our calendar", category: 'linkbot', type: 'linkbot' }
      ];
    }

    // Interest-based suggestions
    if (user.interests.includes('coffee')) {
      suggestions.push({
        id: 'coffee1',
        prompt: 'Coffee spot recommendation',
        message: "I know a great coffee spot you'd love! Want to check it out together?",
        category: 'activity',
        type: 'user'
      });
    }

    if (user.interests.includes('indie films')) {
      suggestions.push({
        id: 'films1',
        prompt: 'Movie night suggestion',
        message: "There's an indie film festival coming up - want to go together?",
        category: 'activity',
        type: 'user'
      });
    }

    if (user.interests.includes('hiking')) {
      suggestions.push({
        id: 'hiking1',
        prompt: 'Weekend hike',
        message: "Perfect weather for a hike this weekend! Know any good trails?",
        category: 'activity',
        type: 'user'
      });
    }

    if (user.interests.includes('yoga')) {
      suggestions.push({
        id: 'yoga1',
        prompt: 'Yoga class invite',
        message: "I'm going to a yoga class tomorrow morning - want to join?",
        category: 'activity',
        type: 'user'
      });
    }

    if (user.interests.includes('photography')) {
      suggestions.push({
        id: 'photo1',
        prompt: 'Photography walk',
        message: "Want to do a photography walk around the city this weekend?",
        category: 'activity',
        type: 'user'
      });
    }

    // Location-based suggestions
    if (user.location.proximityKm < 1) {
      suggestions.push({
        id: 'nearby1',
        prompt: 'Meet nearby',
        message: "We're so close! Want to meet up for a quick walk?",
        category: 'activity',
        type: 'user'
      });
    }

    // Mutual friends suggestions
    if (user.mutualFriends.length > 0) {
      suggestions.push({
        id: 'mutual1',
        prompt: 'Mutual friend connection',
        message: `I see we both know ${user.mutualFriends[0]}! Small world!`,
        category: 'question',
        type: 'user'
      });
    }

    // Friendship status suggestions
    if (!chat.isFriend) {
      suggestions.push({
        id: 'connect1',
        prompt: 'Get to know better',
        message: "I'd love to get to know you better! What's your favorite thing about the city?",
        category: 'question',
        type: 'user'
      });
    }

    // Generic conversation starters
    const genericSuggestions: CueSuggestion[] = [
      { id: 'generic1', prompt: 'Share something interesting', message: "I saw something today that reminded me of you!", category: 'follow-up', type: 'user' },
      { id: 'generic2', prompt: 'Ask about interests', message: "What's been keeping you busy lately?", category: 'question', type: 'user' },
      { id: 'generic3', prompt: 'Weekend check-in', message: "Hope you're having a great weekend! What are you up to?", category: 'question', type: 'user' },
      { id: 'generic4', prompt: 'Compliment and question', message: "I love your energy! What's your secret to staying so positive?", category: 'question', type: 'user' },
      { id: 'generic5', prompt: 'Plan something fun', message: "We should definitely hang out soon! Any ideas on what you'd like to do?", category: 'plans', type: 'user' }
    ];

    // LinkBot suggestions
    const linkbotSuggestions: CueSuggestion[] = [
      { id: 'linkbot1', prompt: 'Book a restaurant', message: "@linkbot book a restaurant that fits our calendar", category: 'linkbot', type: 'linkbot' }
    ];

    // Mix personalized, generic, and LinkBot suggestions
    const remainingSlots = 5 - suggestions.length;
    const availableSuggestions = [...genericSuggestions, ...linkbotSuggestions];
    suggestions.push(...availableSuggestions.slice(0, remainingSlots));

    return suggestions.slice(0, 5);
  };

  const [suggestions] = useState<CueSuggestion[]>(generateSuggestions());

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    checkScrollButtons();
  }, [suggestions]);

  const getCategoryColor = (suggestion: CueSuggestion): string => {
    if (suggestion.type === 'linkbot' || suggestion.category === 'linkbot') {
      // LinkBot cards: copper fill
      return 'bg-accent-copper text-white border-0';
    } else {
      // User cards: charcoal fill with no outline
      return 'bg-accent-charcoal text-white border-0';
    }
  };

  return (
    <div className="px-4 py-2 border-t border-gray-100">
      
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={12} className="text-gray-600" />
          </button>
        )}
        
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide"
          onScroll={checkScrollButtons}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => onSuggestionClick(suggestion.message)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-sm ${getCategoryColor(suggestion)}`}
              style={{ minWidth: '120px' }}
            >
              {suggestion.prompt}
            </button>
          ))}
        </div>
        
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={12} className="text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ConversationalCueCards;
