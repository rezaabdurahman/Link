/// <reference types="cypress" />

describe('Friend Search in Chat', () => {
  beforeEach(() => {
    // Set up mocks and login
    cy.mockFriendSearch()
    cy.loginAsTestUser()
    
    // Visit the chat page
    cy.visit('/chat')
  })

  it('should display existing conversations on page load', () => {
    // Wait for conversations to load
    cy.wait('@conversations')
    
    // Should show existing conversation
    cy.get('[data-testid="chat-list"]').should('be.visible')
    cy.contains('David Wilson').should('be.visible')
    cy.contains('Hey, how are you?').should('be.visible')
  })

  it('should show friend search results when typing a query', () => {
    // Type in search input
    cy.get('input[placeholder*="Search"]').type('alice')
    
    // Wait for search API call
    cy.wait('@friendSearch')
    
    // Should show mixed results (existing chats + friend search results)
    cy.get('[data-testid="chat-list"]').within(() => {
      // Should still show existing conversation if it matches
      cy.contains('David Wilson').should('be.visible')
      
      // Should show friend search results
      cy.contains('Alice Johnson').should('be.visible')
      cy.contains('Loves hiking and photography').should('be.visible')
    })
  })

  it('should show loading state while searching for friends', () => {
    // Intercept with delay to test loading state
    cy.intercept('GET', '**/api/friends/search**', {
      delay: 1000,
      statusCode: 200,
      body: {
        friends: [],
        total: 0,
        page: 1,
        limit: 20
      }
    }).as('slowSearch')
    
    // Type in search input
    cy.get('input[placeholder*="Search"]').type('test query')
    
    // Should show loading skeleton
    cy.get('[role="region"][aria-label="Search results loading"]').should('be.visible')
    cy.get('.animate-pulse').should('be.visible')
    
    // Wait for search to complete
    cy.wait('@slowSearch')
    
    // Loading should disappear
    cy.get('[role="region"][aria-label="Search results loading"]').should('not.exist')
  })

  it('should filter existing chats and show friend results', () => {
    // Type a query that matches both existing chat and friend search
    cy.get('input[placeholder*="Search"]').type('john')
    
    cy.wait('@friendSearch')
    
    // Should show filtered results
    cy.get('[data-testid="chat-list"]').within(() => {
      // Should show Alice Johnson from search results
      cy.contains('Alice Johnson').should('be.visible')
      
      // If David Wilson doesn't match "john", it shouldn't be visible
      cy.contains('David Wilson').should('not.exist')
    })
  })

  it('should open new friend chat when clicking on search result', () => {
    // Search for a friend
    cy.get('input[placeholder*="Search"]').type('alice')
    cy.wait('@friendSearch')
    
    // Click on Alice Johnson from search results
    cy.contains('Alice Johnson').click()
    
    // Should attempt to create a new conversation
    cy.wait('@createConversation')
    
    // Should open conversation modal
    cy.get('[data-testid="conversation-modal"]').should('be.visible')
    cy.contains('Alice Johnson').should('be.visible')
  })

  it('should show empty state when no results found', () => {
    // Mock empty search results
    cy.intercept('GET', '**/api/friends/search**', {
      statusCode: 200,
      body: {
        friends: [],
        total: 0,
        page: 1,
        limit: 20
      }
    }).as('emptySearch')
    
    // Search for something that won't match existing chats
    cy.get('input[placeholder*="Search"]').type('nonexistent')
    cy.wait('@emptySearch')
    
    // Should show empty state
    cy.contains('No conversations found matching "nonexistent"').should('be.visible')
  })

  it('should debounce search input', () => {
    // Type multiple characters quickly
    cy.get('input[placeholder*="Search"]')
      .type('a')
      .type('l')
      .type('i')
      .type('c')
      .type('e')
    
    // Should only make one API call after debounce delay
    cy.wait('@friendSearch')
    
    // Verify search was called with final query
    cy.get('@friendSearch').should('have.been.calledOnce')
  })

  it('should show different result types in mixed results', () => {
    // Search for a query
    cy.get('input[placeholder*="Search"]').type('test')
    cy.wait('@friendSearch')
    
    cy.get('[data-testid="chat-list"]').within(() => {
      // Existing conversations should be prioritized/marked differently
      cy.get('[data-testid="chat-item"]').should('exist')
      
      // Friend search results should be distinguishable
      // (Pseudo-chats would show "Start a conversation" as last message)
      cy.contains('Start a conversation').should('exist')
    })
  })

  it('should clear search results when search input is cleared', () => {
    // Search for something
    cy.get('input[placeholder*="Search"]').type('alice')
    cy.wait('@friendSearch')
    
    // Verify search results are shown
    cy.contains('Alice Johnson').should('be.visible')
    
    // Clear the search
    cy.get('input[placeholder*="Search"]').clear()
    
    // Should go back to showing only existing conversations
    cy.contains('Alice Johnson').should('not.exist')
    cy.contains('David Wilson').should('be.visible')
  })

  it('should handle search API errors gracefully', () => {
    // Mock API error
    cy.intercept('GET', '**/api/friends/search**', {
      statusCode: 500,
      body: { error: 'Internal server error' }
    }).as('searchError')
    
    // Search for something
    cy.get('input[placeholder*="Search"]').type('alice')
    cy.wait('@searchError')
    
    // Should still show existing conversations
    cy.contains('David Wilson').should('be.visible')
    
    // Should not crash or show error to user
    // (Error is logged to console but UI remains functional)
    cy.get('[data-testid="chat-list"]').should('be.visible')
  })

  it('should maintain sort order with mixed results', () => {
    // Change sort to "time"
    cy.get('[data-testid="rank-toggle"]').click()
    cy.contains('time').click()
    
    // Search for friends
    cy.get('input[placeholder*="Search"]').type('test')
    cy.wait('@friendSearch')
    
    // Results should be sorted by time (existing conversations first, then friends)
    cy.get('[data-testid="chat-item"]').first().should('contain', 'David Wilson')
  })
})

// Additional test for mobile viewport behavior
describe('Friend Search in Chat - Mobile', () => {
  beforeEach(() => {
    cy.viewport(375, 812) // iPhone X viewport
    cy.mockFriendSearch()
    cy.loginAsTestUser()
    cy.visit('/chat')
  })

  it('should work properly on mobile viewport', () => {
    // Search should work the same on mobile
    cy.get('input[placeholder*="Search"]').type('alice')
    cy.wait('@friendSearch')
    
    // Results should be visible and clickable
    cy.contains('Alice Johnson').should('be.visible')
    cy.contains('Alice Johnson').click()
    
    // Modal should open and be properly sized for mobile
    cy.wait('@createConversation')
    cy.get('[data-testid="conversation-modal"]').should('be.visible')
  })
})
