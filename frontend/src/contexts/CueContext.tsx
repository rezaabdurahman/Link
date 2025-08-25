import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  CueResponse, 
  CueMatchResponse,
  createCue as apiCreateCue,
  updateCue as apiUpdateCue,
  deleteCue as apiDeleteCue,
  getCurrentUserCue,
  getCueMatches,
  markMatchAsViewed,
  hasCueMatchWith,
  CueError,
  CreateCueRequest,
  UpdateCueRequest
} from '../services/cueClient';
import { useAuth } from './AuthContext';

interface CueContextType {
  // Current user's cue state
  currentCue: CueResponse | null;
  loading: boolean;
  error: string | null;
  
  // Matches state
  matches: CueMatchResponse[];
  matchesLoading: boolean;
  matchesError: string | null;
  
  // Actions
  createCue: (request: CreateCueRequest) => Promise<void>;
  updateCue: (request: UpdateCueRequest) => Promise<void>;
  deleteCue: () => Promise<void>;
  refreshCue: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  markMatchViewed: (matchId: string) => Promise<void>;
  checkMatchWith: (userId: string) => Promise<boolean>;
  
  // Utility
  hasActiveCue: boolean;
  unviewedMatchesCount: number;
}

const CueContext = createContext<CueContextType | undefined>(undefined);

export const useCue = (): CueContextType => {
  const context = useContext(CueContext);
  if (!context) {
    throw new Error('useCue must be used within a CueProvider');
  }
  return context;
};

interface CueProviderProps {
  children: React.ReactNode;
}

export const CueProvider: React.FC<CueProviderProps> = ({ children }) => {
  // Auth context
  const { isAuthenticated, isInitialized } = useAuth();
  
  // Current cue state
  const [currentCue, setCurrentCue] = useState<CueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Matches state
  const [matches, setMatches] = useState<CueMatchResponse[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  // Fetch current user's cue
  const refreshCue = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const cue = await getCurrentUserCue();
      setCurrentCue(cue);
    } catch (err) {
      if (err instanceof CueError && err.code === 404) {
        // No active cue found - this is normal
        setCurrentCue(null);
      } else {
        console.error('Error fetching current cue:', err);
        setError(err instanceof CueError ? err.message : 'Failed to fetch cue');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user's cue matches
  const refreshMatches = useCallback(async () => {
    setMatchesLoading(true);
    setMatchesError(null);
    
    try {
      const response = await getCueMatches();
      setMatches(response.matches);
    } catch (err) {
      console.error('Error fetching cue matches:', err);
      setMatchesError(err instanceof CueError ? err.message : 'Failed to fetch matches');
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  // Create a new cue
  const createCue = useCallback(async (request: CreateCueRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const newCue = await apiCreateCue(request);
      setCurrentCue(newCue);
      // Refresh matches as new cue might generate new matches
      refreshMatches();
    } catch (err) {
      const errorMessage = err instanceof CueError ? err.message : 'Failed to create cue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshMatches]);

  // Update existing cue
  const updateCue = useCallback(async (request: UpdateCueRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedCue = await apiUpdateCue(request);
      setCurrentCue(updatedCue);
      // Refresh matches as updated cue might generate new matches
      refreshMatches();
    } catch (err) {
      const errorMessage = err instanceof CueError ? err.message : 'Failed to update cue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshMatches]);

  // Delete current cue
  const deleteCue = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await apiDeleteCue();
      setCurrentCue(null);
      // Clear matches when cue is deleted
      setMatches([]);
    } catch (err) {
      const errorMessage = err instanceof CueError ? err.message : 'Failed to delete cue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark a match as viewed
  const markMatchViewed = useCallback(async (matchId: string) => {
    try {
      await markMatchAsViewed(matchId);
      // Update local state to mark match as viewed
      setMatches(prev => prev.map(match => 
        match.id === matchId ? { ...match, is_viewed: true } : match
      ));
    } catch (err) {
      console.error('Error marking match as viewed:', err);
      // Don't throw here as this is not critical for UX
    }
  }, []);

  // Check if current user has a match with another user
  const checkMatchWith = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const response = await hasCueMatchWith(userId);
      return response.has_match;
    } catch (err) {
      console.error('Error checking match with user:', err);
      return false;
    }
  }, []);

  // Load initial data on mount - only when authenticated
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      refreshCue();
      refreshMatches();
    }
  }, [refreshCue, refreshMatches, isInitialized, isAuthenticated]);

  // Computed values
  const hasActiveCue = currentCue !== null && currentCue.is_active;
  const unviewedMatchesCount = matches.filter(match => !match.is_viewed).length;

  const value: CueContextType = {
    // State
    currentCue,
    loading,
    error,
    matches,
    matchesLoading,
    matchesError,
    
    // Actions
    createCue,
    updateCue,
    deleteCue,
    refreshCue,
    refreshMatches,
    markMatchViewed,
    checkMatchWith,
    
    // Computed
    hasActiveCue,
    unviewedMatchesCount,
  };

  return (
    <CueContext.Provider value={value}>
      {children}
    </CueContext.Provider>
  );
};