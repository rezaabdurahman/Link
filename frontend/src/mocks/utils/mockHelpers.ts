import { currentUser } from '../../data/mockData';

// Helper to generate UUID
export const generateId = (): string => crypto.randomUUID();

// Helper to get current timestamp
export const now = (): string => new Date().toISOString();

// Helper to calculate expiration time
export const getExpirationTime = (hours: number = 24): string => {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + hours);
  return expiration.toISOString();
};

// SECURITY: Helper to safely extract and validate user ID
export const extractUserId = (req: any): string | null => {
  const authHeader = req.headers.get('Authorization');
  const userIdHeader = req.headers.get('X-User-ID');
  
  console.log('🔍 MSW: Extracting user ID from headers:', {
    authHeader: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
    userIdHeader: userIdHeader || 'none'
  });
  
  // SECURITY: In development/demo, validate dev token format
  if (authHeader && authHeader.includes('dev-token-')) {
    const token = authHeader.replace('Bearer ', '');
    if (token.startsWith('dev-token-') && token.length > 10) {
      const userId = token.replace('dev-token-', '');
      console.log('✅ MSW: Extracted user ID from dev token:', userId);
      return userId;
    }
  }
  
  // SECURITY: Fallback to X-User-ID only in development/demo
  if (userIdHeader && userIdHeader.match(/^[a-zA-Z0-9-]+$/)) {
    console.log('✅ MSW: Using X-User-ID header:', userIdHeader);
    return userIdHeader;
  }
  
  // For demo mode, if no valid auth found, use default demo user
  const isDemo = (typeof window !== 'undefined' && 
                 (window as any).__vite_import_meta_env__?.VITE_APP_MODE === 'demo') ||
                 (import.meta?.env?.VITE_APP_MODE === 'demo') ||
                 (import.meta?.env?.VITE_ENABLE_MOCKING === 'true');
  
  if (isDemo || (!authHeader && !userIdHeader)) {
    const defaultUserId = currentUser.id; // Use currentUser as default demo user
    console.log('🎭 MSW: Using default demo user ID for demo mode:', defaultUserId);
    return defaultUserId;
  }
  
  console.warn('❌ MSW: No valid user ID found in request');
  return null;
};

// Helper to parse pagination parameters
export const parsePaginationParams = (url: URL): { limit: number; offset: number } => {
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');
  
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;
  const offset = offsetParam ? Math.max(parseInt(offsetParam, 10), 0) : 0;
  
  return { limit, offset };
};

// Helper to simulate network delay (optional for more realistic mocking)
export const simulateDelay = (ms: number = 200): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
