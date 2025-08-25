import { http, HttpResponse } from 'msw';
import { nearbyUsers } from '../../data/mockData';
import { UnifiedSearchRequest, UnifiedSearchResponse } from '../../services/unifiedSearchClient';

// Search handlers
export const handlers = [
  // POST /search - Unified search endpoint (specific URL)
  http.post('http://localhost:8080/search', async ({ request }) => {
    console.log('🔍 MSW: Handler matched for localhost:8080/search');
    try {
      const searchRequest = await request.json() as UnifiedSearchRequest;
      console.log('🔍 MSW: Received search request:', searchRequest);
      
      // Filter nearbyUsers based on search criteria
      let filteredUsers = [...nearbyUsers];
      
      // Apply availability filter
      if (searchRequest.filters?.available_only) {
        filteredUsers = filteredUsers.filter(user => user.isAvailable);
      }
      
      // Apply interest filter
      if (searchRequest.filters?.interests && searchRequest.filters.interests.length > 0) {
        filteredUsers = filteredUsers.filter(user => 
          user.interests.some(interest => 
            searchRequest.filters!.interests!.some(filterInterest => 
              interest.toLowerCase().includes(filterInterest.toLowerCase())
            )
          )
        );
      }
      
      // Apply text query filter (search in name, bio, interests)
      if (searchRequest.query && searchRequest.query.trim()) {
        const query = searchRequest.query.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          `${user.first_name} ${user.last_name}`.toLowerCase().includes(query) ||
          user.bio.toLowerCase().includes(query) ||
          user.interests.some(interest => interest.toLowerCase().includes(query))
        );
      }
      
      // Apply pagination
      const limit = searchRequest.pagination?.limit || 50;
      const offset = searchRequest.pagination?.offset || 0;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);
      
      console.log(`🔍 MSW: Returning ${paginatedUsers.length} users out of ${filteredUsers.length} total matches`);
      
      const response: UnifiedSearchResponse = {
        users: paginatedUsers,
        total: filteredUsers.length,
        hasMore: (offset + limit) < filteredUsers.length,
        scope: searchRequest.scope || 'discovery',
        query: searchRequest.query,
        metadata: {
          searchTime: Math.floor(Math.random() * 50) + 10, // Mock search time 10-60ms
          source: 'database',
        }
      };
      
      return HttpResponse.json(response);
    } catch (error) {
      console.error('🔍 MSW: Search error:', error);
      return HttpResponse.json(
        {
          message: 'Search failed',
          code: 'SEARCH_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }),
  
  // POST /search - Unified search endpoint (wildcard fallback)
  http.post('*/search', async ({ request }) => {
    console.log('🔍 MSW: Handler matched for */search fallback');
    try {
      const searchRequest = await request.json() as UnifiedSearchRequest;
      console.log('🔍 MSW: Received search request:', searchRequest);
      
      // Filter nearbyUsers based on search criteria
      let filteredUsers = [...nearbyUsers];
      
      // Apply availability filter
      if (searchRequest.filters?.available_only) {
        filteredUsers = filteredUsers.filter(user => user.isAvailable);
      }
      
      // Apply interest filter
      if (searchRequest.filters?.interests && searchRequest.filters.interests.length > 0) {
        filteredUsers = filteredUsers.filter(user => 
          user.interests.some(interest => 
            searchRequest.filters!.interests!.some(filterInterest => 
              interest.toLowerCase().includes(filterInterest.toLowerCase())
            )
          )
        );
      }
      
      // Apply text query filter (search in name, bio, interests)
      if (searchRequest.query && searchRequest.query.trim()) {
        const query = searchRequest.query.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          `${user.first_name} ${user.last_name}`.toLowerCase().includes(query) ||
          user.bio.toLowerCase().includes(query) ||
          user.interests.some(interest => interest.toLowerCase().includes(query))
        );
      }
      
      // Apply pagination
      const limit = searchRequest.pagination?.limit || 50;
      const offset = searchRequest.pagination?.offset || 0;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);
      
      console.log(`🔍 MSW: Returning ${paginatedUsers.length} users out of ${filteredUsers.length} total matches`);
      
      const response: UnifiedSearchResponse = {
        users: paginatedUsers,
        total: filteredUsers.length,
        hasMore: (offset + limit) < filteredUsers.length,
        scope: searchRequest.scope || 'discovery',
        query: searchRequest.query,
        metadata: {
          searchTime: Math.floor(Math.random() * 50) + 10, // Mock search time 10-60ms
          source: 'database',
        }
      };
      
      return HttpResponse.json(response);
    } catch (error) {
      console.error('🔍 MSW: Search error:', error);
      return HttpResponse.json(
        {
          message: 'Search failed',
          code: 'SEARCH_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  }),
];