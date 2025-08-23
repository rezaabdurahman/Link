describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });
  });

  describe('Login Flow', () => {
    beforeEach(() => {
      cy.visit('/login');
    });

    it('should display login form with all required fields', () => {
      cy.get('[data-testid="login-form"]').should('be.visible');
      cy.get('[data-testid="email-input"]').should('be.visible');
      cy.get('[data-testid="password-input"]').should('be.visible');
      cy.get('[data-testid="login-button"]').should('be.visible');
      cy.get('[data-testid="signup-link"]').should('be.visible');
    });

    it('should show validation errors for invalid input', () => {
      // Submit empty form
      cy.get('[data-testid="login-button"]').click();
      
      // Should show validation errors
      cy.get('[data-testid="email-error"]').should('contain', 'Email is required');
      cy.get('[data-testid="password-error"]').should('contain', 'Password is required');
      
      // Enter invalid email
      cy.get('[data-testid="email-input"]').type('invalid-email');
      cy.get('[data-testid="password-input"]').type('123');
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="email-error"]').should('contain', 'Please enter a valid email');
      cy.get('[data-testid="password-error"]').should('contain', 'Password must be at least 6 characters');
    });

    it('should successfully log in with valid credentials', () => {
      // Mock successful login response
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
              first_name: 'Test',
              last_name: 'User'
            },
            token: 'mock-jwt-token'
          }
        }
      }).as('loginRequest');

      // Fill in valid credentials
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="login-button"]').click();

      // Should make login request
      cy.wait('@loginRequest');

      // Should redirect to discovery page
      cy.url().should('include', '/discovery');
      
      // Should show user is logged in
      cy.get('[data-testid="user-avatar"]').should('be.visible');
    });

    it('should handle login errors gracefully', () => {
      // Mock failed login response
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        }
      }).as('loginError');

      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('wrongpassword');
      cy.get('[data-testid="login-button"]').click();

      cy.wait('@loginError');

      // Should show error message
      cy.get('[data-testid="error-toast"]').should('be.visible');
      cy.get('[data-testid="error-toast"]').should('contain', 'Invalid email or password');
      
      // Should remain on login page
      cy.url().should('include', '/login');
    });

    it('should toggle password visibility', () => {
      cy.get('[data-testid="password-input"]').should('have.attr', 'type', 'password');
      
      // Click toggle button
      cy.get('[data-testid="password-toggle"]').click();
      cy.get('[data-testid="password-input"]').should('have.attr', 'type', 'text');
      
      // Click again to hide
      cy.get('[data-testid="password-toggle"]').click();
      cy.get('[data-testid="password-input"]').should('have.attr', 'type', 'password');
    });

    it('should navigate to signup page when signup link is clicked', () => {
      cy.get('[data-testid="signup-link"]').click();
      cy.url().should('include', '/signup');
    });
  });

  describe('Signup Flow', () => {
    beforeEach(() => {
      cy.visit('/signup');
    });

    it('should display signup form with all required fields', () => {
      cy.get('[data-testid="signup-form"]').should('be.visible');
      cy.get('[data-testid="first-name-input"]').should('be.visible');
      cy.get('[data-testid="last-name-input"]').should('be.visible');
      cy.get('[data-testid="email-input"]').should('be.visible');
      cy.get('[data-testid="password-input"]').should('be.visible');
      cy.get('[data-testid="confirm-password-input"]').should('be.visible');
      cy.get('[data-testid="signup-button"]').should('be.visible');
      cy.get('[data-testid="login-link"]').should('be.visible');
    });

    it('should validate all form fields', () => {
      // Submit empty form
      cy.get('[data-testid="signup-button"]').click();
      
      cy.get('[data-testid="first-name-error"]').should('contain', 'First name is required');
      cy.get('[data-testid="last-name-error"]').should('contain', 'Last name is required');
      cy.get('[data-testid="email-error"]').should('contain', 'Email is required');
      cy.get('[data-testid="password-error"]').should('contain', 'Password is required');
      
      // Test password confirmation
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="confirm-password-input"]').type('differentpassword');
      cy.get('[data-testid="signup-button"]').click();
      
      cy.get('[data-testid="confirm-password-error"]').should('contain', 'Passwords do not match');
    });

    it('should successfully create account with valid information', () => {
      // Mock successful signup response
      cy.intercept('POST', '/api/auth/register', {
        statusCode: 201,
        body: {
          success: true,
          data: {
            user: {
              id: 'user-456',
              email: 'newuser@example.com',
              first_name: 'John',
              last_name: 'Doe'
            },
            token: 'mock-jwt-token'
          }
        }
      }).as('signupRequest');

      // Fill in valid information
      cy.get('[data-testid="first-name-input"]').type('John');
      cy.get('[data-testid="last-name-input"]').type('Doe');
      cy.get('[data-testid="email-input"]').type('newuser@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="confirm-password-input"]').type('password123');
      
      cy.get('[data-testid="signup-button"]').click();

      cy.wait('@signupRequest');

      // Should redirect to onboarding or discovery
      cy.url().should('match', /\/(onboarding|discovery)/);
    });

    it('should handle signup errors appropriately', () => {
      // Mock email already exists error
      cy.intercept('POST', '/api/auth/register', {
        statusCode: 409,
        body: {
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email already exists'
          }
        }
      }).as('signupError');

      cy.get('[data-testid="first-name-input"]').type('John');
      cy.get('[data-testid="last-name-input"]').type('Doe');
      cy.get('[data-testid="email-input"]').type('existing@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="confirm-password-input"]').type('password123');
      
      cy.get('[data-testid="signup-button"]').click();

      cy.wait('@signupError');

      // Should show error message
      cy.get('[data-testid="error-toast"]').should('be.visible');
      cy.get('[data-testid="error-toast"]').should('contain', 'An account with this email already exists');
    });

    it('should navigate to login page when login link is clicked', () => {
      cy.get('[data-testid="login-link"]').click();
      cy.url().should('include', '/login');
    });
  });

  describe('Authentication State Management', () => {
    it('should redirect unauthenticated users to login', () => {
      // Try to access protected route
      cy.visit('/discovery');
      
      // Should redirect to login
      cy.url().should('include', '/login');
    });

    it('should redirect authenticated users away from auth pages', () => {
      // Mock authentication state
      cy.window().then((win) => {
        win.localStorage.setItem('authToken', 'mock-token');
      });

      // Mock user data endpoint
      cy.intercept('GET', '/api/auth/me', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            id: 'user-123',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User'
          }
        }
      }).as('userMe');

      // Try to visit login while authenticated
      cy.visit('/login');
      
      // Should redirect to discovery
      cy.url().should('include', '/discovery');
    });

    it('should handle token refresh automatically', () => {
      // Mock initial authentication
      cy.window().then((win) => {
        win.localStorage.setItem('authToken', 'expired-token');
      });

      // Mock token refresh
      cy.intercept('POST', '/api/auth/refresh', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            token: 'new-token'
          }
        }
      }).as('tokenRefresh');

      // Mock protected endpoint that triggers refresh
      cy.intercept('GET', '/api/auth/me', {
        statusCode: 401,
        body: { success: false, error: { code: 'TOKEN_EXPIRED' } }
      }).as('expiredToken');

      cy.visit('/discovery');

      // Should automatically refresh token
      cy.wait('@tokenRefresh');
      
      // Should remain on protected page
      cy.url().should('include', '/discovery');
    });

    it('should logout and redirect to login on token refresh failure', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('authToken', 'expired-token');
      });

      // Mock failed token refresh
      cy.intercept('POST', '/api/auth/refresh', {
        statusCode: 401,
        body: { success: false, error: { code: 'REFRESH_TOKEN_INVALID' } }
      }).as('refreshFailed');

      cy.intercept('GET', '/api/auth/me', {
        statusCode: 401,
        body: { success: false, error: { code: 'TOKEN_EXPIRED' } }
      }).as('expiredToken');

      cy.visit('/discovery');

      cy.wait('@refreshFailed');

      // Should redirect to login
      cy.url().should('include', '/login');
      
      // Should clear authentication data
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.be.null;
      });
    });
  });

  describe('Logout Flow', () => {
    beforeEach(() => {
      // Set up authenticated state
      cy.window().then((win) => {
        win.localStorage.setItem('authToken', 'mock-token');
      });

      cy.intercept('GET', '/api/auth/me', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            id: 'user-123',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User'
          }
        }
      }).as('userMe');

      cy.visit('/discovery');
      cy.wait('@userMe');
    });

    it('should logout user and redirect to login', () => {
      // Mock logout endpoint
      cy.intercept('POST', '/api/auth/logout', {
        statusCode: 200,
        body: { success: true, message: 'Logout successful' }
      }).as('logoutRequest');

      // Open user menu and click logout
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();

      cy.wait('@logoutRequest');

      // Should redirect to login
      cy.url().should('include', '/login');
      
      // Should clear authentication data
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.be.null;
      });
    });

    it('should handle logout errors gracefully', () => {
      // Mock logout error
      cy.intercept('POST', '/api/auth/logout', {
        statusCode: 500,
        body: { success: false, error: { message: 'Logout failed' } }
      }).as('logoutError');

      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();

      cy.wait('@logoutError');

      // Should still logout locally and redirect
      cy.url().should('include', '/login');
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.be.null;
      });
    });
  });

  describe('Remember Me Functionality', () => {
    it('should persist authentication across browser sessions', () => {
      // Mock login with remember me
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
              first_name: 'Test',
              last_name: 'User'
            },
            token: 'mock-jwt-token'
          }
        }
      }).as('loginRequest');

      cy.visit('/login');
      
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="password-input"]').type('password123');
      cy.get('[data-testid="remember-me-checkbox"]').check();
      cy.get('[data-testid="login-button"]').click();

      cy.wait('@loginRequest');
      cy.url().should('include', '/discovery');

      // Simulate browser restart by clearing session storage but keeping local storage
      cy.window().then((win) => {
        win.sessionStorage.clear();
      });

      // Revisit the app
      cy.visit('/');
      
      // Should still be authenticated
      cy.url().should('include', '/discovery');
    });
  });

  describe('Password Reset Flow', () => {
    it('should handle forgot password flow', () => {
      cy.visit('/login');
      
      // Click forgot password link
      cy.get('[data-testid="forgot-password-link"]').click();
      cy.url().should('include', '/forgot-password');
      
      // Mock password reset request
      cy.intercept('POST', '/api/auth/forgot-password', {
        statusCode: 200,
        body: { success: true, message: 'Password reset email sent' }
      }).as('forgotPassword');
      
      // Enter email
      cy.get('[data-testid="email-input"]').type('test@example.com');
      cy.get('[data-testid="reset-button"]').click();
      
      cy.wait('@forgotPassword');
      
      // Should show success message
      cy.get('[data-testid="success-message"]').should('contain', 'Password reset email sent');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      cy.visit('/login');
    });

    it('should be keyboard navigable', () => {
      // Tab through form elements
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'email-input');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'password-input');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'login-button');
    });

    it('should have proper ARIA labels and form associations', () => {
      cy.get('[data-testid="email-input"]')
        .should('have.attr', 'aria-label', 'Email Address')
        .should('have.attr', 'type', 'email');
      
      cy.get('[data-testid="password-input"]')
        .should('have.attr', 'aria-label', 'Password')
        .should('have.attr', 'type', 'password');
      
      // Error messages should be associated with inputs
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="email-input"]')
        .should('have.attr', 'aria-describedby')
        .and('contain', 'email-error');
    });

    it('should support screen readers for error messages', () => {
      cy.get('[data-testid="login-button"]').click();
      
      cy.get('[data-testid="email-error"]')
        .should('have.attr', 'role', 'alert')
        .should('have.attr', 'aria-live', 'polite');
    });
  });
});