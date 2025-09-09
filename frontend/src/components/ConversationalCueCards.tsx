import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Chat, User, Message } from '../types';
import { 
  generateCueCards, 
  generateMessageFromCue, 
  buildUserContext, 
  determineCueCardMode,
  getCachedCueCards,
  cacheCueCardsLocally,
  type CueCard,
  type GenerateCueCardsRequest
} from '../services/summarygenClient';

interface ConversationalCueCardsProps {
  chat: Chat;
  user: User | null;
  messages: Message[];
  onSuggestionClick: (suggestion: string) => void;
}

interface CueSuggestion {
  id: string;
  prompt: string;
  message: string;
  category: 'question' | 'activity' | 'follow-up' | 'interest' | 'plans' | 'linkbot' | 'emoji';
  type?: 'user' | 'linkbot';
  relevance_score?: number;
}

const ConversationalCueCards: React.FC<ConversationalCueCardsProps> = ({ 
  chat, 
  user, 
  messages,
  onSuggestionClick 
}): JSX.Element => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [suggestions, setSuggestions] = useState<CueSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFailedOperation, setLastFailedOperation] = useState<'generate' | 'message' | null>(null);

  // Generate fallback suggestions as backup
  const getFallbackSuggestions = useCallback((): CueSuggestion[] => {
    if (!user) {
      return [
        { id: 'fallback1', prompt: "How's your day?", message: "How's your day going so far?", category: 'question', type: 'user' },
        { id: 'fallback2', prompt: 'Weekend plans', message: "Any fun plans for the weekend?", category: 'plans', type: 'user' },
        { id: 'fallback3', prompt: 'Coffee meetup', message: "Want to grab coffee sometime this week?", category: 'activity', type: 'user' }
      ];
    }

    const fallbackSuggestions: CueSuggestion[] = [];
    
    // Interest-based fallbacks
    if (user.interests.includes('coffee') && fallbackSuggestions.length < 3) {
      fallbackSuggestions.push({
        id: 'coffee-fallback',
        prompt: 'Coffee spot',
        message: "I know a great coffee spot you'd love!",
        category: 'activity',
        type: 'user'
      });
    }
    
    // Fill remaining slots with generic suggestions
    const genericFallbacks: CueSuggestion[] = [
      { id: 'generic-fallback1', prompt: 'Ask about interests', message: "What's been keeping you busy lately?", category: 'question', type: 'user' },
      { id: 'generic-fallback2', prompt: 'Weekend check-in', message: "Hope you're having a great weekend!", category: 'question', type: 'user' },
      { id: 'generic-fallback3', prompt: 'Plan something', message: "We should hang out soon! Any ideas?", category: 'plans', type: 'user' }
    ];
    
    const remaining = 3 - fallbackSuggestions.length;
    fallbackSuggestions.push(...genericFallbacks.slice(0, remaining));
    
    return fallbackSuggestions.slice(0, 3);
  }, [user]);

  // Generate AI-powered cue cards with error boundary
  const generateAICueCards = useCallback(async (isRetry = false) => {
    if (!user || !chat.id || loading) return;
    
    setLoading(true);
    if (!isRetry) {
      setError(null);
      setLastFailedOperation(null);
    }
    
    try {
      // Check for cached cue cards first
      const cached = getCachedCueCards(chat.id);
      if (cached && cached.length > 0) {
        const cachedSuggestions: CueSuggestion[] = cached.map(card => ({
          id: card.id,
          prompt: card.prompt_text,
          message: card.prompt_text,
          category: card.category as CueSuggestion['category'],
          type: 'user', // CueCard doesn't have linkbot category
          relevance_score: card.relevance_score
        }));
        setSuggestions(cachedSuggestions);
        setLoading(false);
        return;
      }
      
      // Determine generation mode based on conversation history
      const lastMessageTime = messages.length > 0 ? messages[messages.length - 1].timestamp.getTime() : undefined;
      const mode = determineCueCardMode(
        messages.map(m => ({ timestamp: m.timestamp.getTime() })), 
        lastMessageTime
      );
      
      // Build user context
      const userContext = buildUserContext(user);
      
      // Prepare recent messages for API
      const recentMessages = messages.slice(-10).map(msg => ({
        id: msg.id,
        sender_id: msg.senderId,
        content: msg.content,
        timestamp: Math.floor(msg.timestamp.getTime() / 1000), // Convert to Unix timestamp
        metadata: {}
      }));
      
      // Generate cue cards via AI
      const request: GenerateCueCardsRequest = {
        conversation_id: chat.id,
        recent_messages: recentMessages,
        user_context: userContext,
        card_count: 3,
        mode
      };
      
      const response = await generateCueCards(request);
      
      // Convert API response to component format
      const aiSuggestions: CueSuggestion[] = response.cue_cards.map(card => ({
        id: card.id,
        prompt: card.prompt_text,
        message: card.prompt_text,
        category: card.category as CueSuggestion['category'],
        type: 'user', // CueCard API doesn't return linkbot category
        relevance_score: card.relevance_score
      }));
      
      setSuggestions(aiSuggestions);
      
      // Cache the results locally
      cacheCueCardsLocally(chat.id, response.cue_cards);
      
    } catch (error) {
      console.error('Failed to generate AI cue cards:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to generate suggestions: ${errorMessage}`);
      setLastFailedOperation('generate');
      
      // Increment retry count for exponential backoff
      setRetryCount(prev => prev + 1);
      
      // Fall back to static suggestions
      setSuggestions(getFallbackSuggestions());
    } finally {
      setLoading(false);
    }
  }, [user, chat.id, messages, loading, getFallbackSuggestions]);

  // Handle cue card click with AI message generation and error boundary
  const handleCueCardClick = useCallback(async (suggestion: CueSuggestion) => {
    if (!user || loadingCardId === suggestion.id) return;
    
    setLoadingCardId(suggestion.id);
    setError(null); // Clear any previous errors
    
    try {
      // Try to generate a personalized message using AI
      const selectedCard: CueCard = {
        id: suggestion.id,
        prompt_text: suggestion.prompt,
        category: (suggestion.category === 'linkbot' ? 'activity' : suggestion.category) as CueCard['category'],
        relevance_score: suggestion.relevance_score || 0.8
      };
      
      const messageResponse = await generateMessageFromCue({
        conversation_id: chat.id,
        selected_card: selectedCard,
        apply_tonality_adjustment: true
      });
      
      // Use the AI-generated message
      onSuggestionClick(messageResponse.message);
      
    } catch (error) {
      console.error('Failed to generate AI message:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to generate message: ${errorMessage}`);
      setLastFailedOperation('message');
      
      // Fall back to the original suggestion text
      onSuggestionClick(suggestion.message);
    } finally {
      setLoadingCardId(null);
    }
  }, [user, chat.id, loadingCardId, onSuggestionClick]);

  // Load cue cards on component mount and when dependencies change
  useEffect(() => {
    if (!suggestions.length) {
      generateAICueCards();
    }
  }, [generateAICueCards, suggestions.length]);
  
  // Retry mechanism with exponential backoff
  const handleRetry = useCallback(() => {
    if (lastFailedOperation === 'generate') {
      // Exponential backoff: wait 2^retryCount seconds (max 8 seconds)
      const delay = Math.min(Math.pow(2, retryCount) * 1000, 8000);
      setTimeout(() => {
        generateAICueCards(true);
      }, delay);
    }
  }, [lastFailedOperation, retryCount, generateAICueCards]);
  
  // Reset error state when chat changes
  useEffect(() => {
    setError(null);
    setRetryCount(0);
    setLastFailedOperation(null);
  }, [chat.id]);
  
  // Initialize with fallback suggestions immediately for better UX
  useEffect(() => {
    if (suggestions.length === 0 && !loading) {
      setSuggestions(getFallbackSuggestions());
    }
  }, [getFallbackSuggestions, suggestions.length, loading]);

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
      return 'bg-accent-copper text-white border-0';
    } else {
      return 'bg-gray-200 text-gray-700 border-0';
    }
  };
  
  const isCardLoading = (cardId: string): boolean => {
    return loadingCardId === cardId;
  };

  // Error state with retry option
  if (error && suggestions.length === 0) {
    return (
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center">
            <span className="text-sm text-red-500 mr-2">⚠️</span>
            <div>
              <span className="text-sm text-red-600">AI suggestions unavailable</span>
              <p className="text-xs text-gray-500">Using fallback suggestions</p>
            </div>
          </div>
          {lastFailedOperation === 'generate' && retryCount < 3 && (
            <button
              onClick={handleRetry}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
            >
              Retry ({3 - retryCount} left)
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Loading state
  if (loading && suggestions.length === 0) {
    return (
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="animate-spin h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">
            {retryCount > 0 ? `Retrying... (${retryCount + 1}/3)` : 'Generating suggestions...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 border-t border-gray-100">
      {/* Error banner for non-critical errors */}
      {error && suggestions.length > 0 && (
        <div className="px-4 py-2 bg-yellow-50 border-l-4 border-yellow-400">
          <div className="flex items-center">
            <span className="text-yellow-600 text-xs">⚠️ {error}</span>
            {lastFailedOperation && retryCount < 3 && (
              <button
                onClick={handleRetry}
                className="ml-2 px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
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
              onClick={() => handleCueCardClick(suggestion)}
              disabled={isCardLoading(suggestion.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${getCategoryColor(suggestion)}`}
              style={{ minWidth: '120px' }}
            >
              {isCardLoading(suggestion.id) ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-3 w-3" />
                </div>
              ) : (
                suggestion.prompt
              )}
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
