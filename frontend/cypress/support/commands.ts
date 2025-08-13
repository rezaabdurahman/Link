/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login as a test user
       * @example cy.loginAsTestUser()
       */
      loginAsTestUser(): Chainable<void>

      /**
       * Custom command to mock friend search API
       * @example cy.mockFriendSearch()
       */
      mockFriendSearch(): Chainable<void>
    }
  }
}

// Login command for testing
Cypress.Commands.add('loginAsTestUser', () => {
  // Set local storage to simulate logged in user
  cy.window().then((win) => {
    win.localStorage.setItem('authToken', 'test-token-123')
    win.localStorage.setItem('user', JSON.stringify({
      id: 'test-user-id',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com'
    }))
  })
})

// Mock friend search API responses
Cypress.Commands.add('mockFriendSearch', () => {
  cy.intercept('GET', '**/api/friends/search**', {
    statusCode: 200,
    body: {
      friends: [
        {
          id: 'friend-1',
          first_name: 'Alice',
          last_name: 'Johnson',
          email: 'alice@example.com',
          profile_picture: '/mock-avatar-1.jpg',
          bio: 'Loves hiking and photography'
        },
        {
          id: 'friend-2', 
          first_name: 'Bob',
          last_name: 'Smith',
          email: 'bob@example.com',
          profile_picture: '/mock-avatar-2.jpg',
          bio: 'Into rock climbing and coffee'
        },
        {
          id: 'friend-3',
          first_name: 'Carol',
          last_name: 'Davis',
          email: 'carol@example.com',
          profile_picture: '/mock-avatar-3.jpg',
          bio: 'Designer and yoga enthusiast'
        }
      ],
      total: 3,
      page: 1,
      limit: 20
    }
  }).as('friendSearch')

  // Mock conversations API
  cy.intercept('GET', '**/api/conversations**', {
    statusCode: 200,
    body: {
      data: [
        {
          id: 'conv-1',
          type: 'direct',
          participants: [
            {
              id: 'existing-friend-1',
              first_name: 'David',
              last_name: 'Wilson',
              profile_picture: '/existing-avatar-1.jpg'
            }
          ],
          last_message: {
            id: 'msg-1',
            content: 'Hey, how are you?',
            sender_id: 'existing-friend-1',
            created_at: new Date().toISOString(),
            type: 'text'
          },
          unread_count: 1,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      total: 1,
      page: 1,
      limit: 50
    }
  }).as('conversations')

  // Mock conversation creation
  cy.intercept('POST', '**/api/conversations', {
    statusCode: 201,
    body: {
      id: 'new-conv-1',
      type: 'direct',
      participants: [
        {
          id: 'friend-1',
          first_name: 'Alice',
          last_name: 'Johnson',
          profile_picture: '/mock-avatar-1.jpg'
        }
      ],
      last_message: null,
      unread_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }).as('createConversation')
})

export {}
