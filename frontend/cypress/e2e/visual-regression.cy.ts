/// <reference types="cypress" />

describe('Visual Regression Tests', () => {
  beforeEach(() => {
    // Mock authentication and set up test user
    cy.loginAsTestUser()
    cy.mockFriendSearch()
  })

  it('should capture visual snapshots of main app pages', () => {
    // Homepage/Discovery page
    cy.visit('/')
    cy.get('[data-testid="main-content"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Homepage - Discovery', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // Chat page
    cy.visit('/chat')
    cy.get('[data-testid="chat-container"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Chat Page', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // User Profile page  
    cy.visit('/profile')
    cy.get('[data-testid="profile-container"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('User Profile', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })
  })

  it('should capture login and signup pages', () => {
    // Clear authentication for unauthenticated pages
    cy.clearLocalStorage()
    
    // Login page
    cy.visit('/login')
    cy.get('[data-testid="login-form"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Login Page', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // Signup page
    cy.visit('/signup')
    cy.get('[data-testid="signup-form"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Signup Page', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })
  })

  it('should capture onboarding flow states', () => {
    // Clear storage and visit onboarding
    cy.clearLocalStorage()
    
    // Mock different onboarding states
    cy.visit('/onboarding/welcome')
    cy.get('[data-testid="onboarding-welcome"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Onboarding - Welcome', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // Profile setup step
    cy.visit('/onboarding/profile')
    cy.get('[data-testid="profile-setup"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Onboarding - Profile Setup', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // Interests step
    cy.visit('/onboarding/interests') 
    cy.get('[data-testid="interests-setup"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Onboarding - Interests', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })
  })

  it('should capture component interaction states', () => {
    cy.visit('/')
    
    // Test different modal/overlay states
    cy.get('[data-testid="user-menu-trigger"]').click()
    cy.get('[data-testid="user-menu"]').should('be.visible')
    cy.percySnapshot('User Menu Open', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // Test search functionality
    cy.visit('/chat')
    cy.get('[data-testid="search-input"]').type('test search')
    cy.get('[data-testid="search-results"]').should('be.visible')
    cy.percySnapshot('Chat Search Active', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // Test error states (if available)
    cy.intercept('GET', '**/api/**', { statusCode: 500, body: { error: 'Server error' } })
    cy.reload()
    cy.get('[data-testid="error-message"]', { timeout: 10000 }).should('be.visible')
    cy.percySnapshot('Error State', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })
  })

  it('should capture responsive breakpoints', () => {
    cy.visit('/')
    
    // Mobile view
    cy.viewport(414, 896)
    cy.get('[data-testid="main-content"]').should('be.visible')
    cy.percySnapshot('Mobile View', {
      widths: [414],
      minHeight: 896
    })

    // Tablet view
    cy.viewport(768, 1024)
    cy.get('[data-testid="main-content"]').should('be.visible')
    cy.percySnapshot('Tablet View', {
      widths: [768],
      minHeight: 1024
    })

    // Desktop view
    cy.viewport(1200, 1024)
    cy.get('[data-testid="main-content"]').should('be.visible')
    cy.percySnapshot('Desktop View', {
      widths: [1200],
      minHeight: 1024
    })
  })

  it('should capture dark/light theme variations', () => {
    cy.visit('/')
    
    // Light theme (default)
    cy.percySnapshot('Light Theme', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })

    // Dark theme (if implemented)
    cy.get('[data-testid="theme-toggle"]').click()
    cy.get('body').should('have.class', 'dark')
    cy.percySnapshot('Dark Theme', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })
  })
})
