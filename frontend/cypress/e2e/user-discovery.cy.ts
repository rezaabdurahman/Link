describe('User Discovery Flow', () => {
  beforeEach(() => {
    // Visit the discovery page (assuming user is already logged in)
    cy.visit('/discovery');
    
    // Wait for the page to load
    cy.get('[data-testid="discovery-page"]').should('be.visible');
  });

  describe('Page Layout and Initial Load', () => {
    it('should display the discovery page with header and user grid', () => {
      // Check header elements
      cy.get('[data-testid="discovery-header"]').should('be.visible');
      cy.get('[data-testid="search-input"]').should('be.visible');
      cy.get('[data-testid="layout-toggle"]').should('be.visible');
      
      // Check main content area
      cy.get('[data-testid="user-grid"]').should('be.visible');
      
      // Should show loading state initially
      cy.get('[data-testid="loading-skeleton"]').should('be.visible');
      
      // Wait for users to load
      cy.get('[data-testid="user-card"]').should('have.length.at.least', 1);
      cy.get('[data-testid="loading-skeleton"]').should('not.exist');
    });

    it('should display user cards with correct information', () => {
      cy.get('[data-testid="user-card"]').first().within(() => {
        // Should show user image
        cy.get('img[alt]').should('be.visible');
        
        // Should show user name
        cy.get('[data-testid="user-name"]').should('be.visible').and('not.be.empty');
        
        // Should show distance
        cy.get('[data-testid="user-distance"]').should('contain', 'miles away');
        
        // Should show add friend button
        cy.get('[data-testid="add-friend-btn"]').should('be.visible');
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search for users by name', () => {
      const searchTerm = 'Alice';
      
      // Type in search box
      cy.get('[data-testid="search-input"]')
        .type(searchTerm)
        .should('have.value', searchTerm);
      
      // Wait for search results
      cy.get('[data-testid="loading-skeleton"]').should('be.visible');
      cy.get('[data-testid="loading-skeleton"]').should('not.exist');
      
      // Should show filtered results
      cy.get('[data-testid="user-card"]').should('have.length.at.least', 1);
      cy.get('[data-testid="user-name"]').first().should('contain', searchTerm);
    });

    it('should show empty state when no results found', () => {
      const searchTerm = 'NonexistentUser123';
      
      cy.get('[data-testid="search-input"]').type(searchTerm);
      
      // Wait for search to complete
      cy.get('[data-testid="loading-skeleton"]').should('be.visible');
      cy.get('[data-testid="loading-skeleton"]').should('not.exist');
      
      // Should show empty state
      cy.get('[data-testid="empty-state"]').should('be.visible');
      cy.get('[data-testid="empty-state"]').should('contain', 'No people found');
    });

    it('should clear search when clear button is clicked', () => {
      // Type search term
      cy.get('[data-testid="search-input"]').type('test search');
      
      // Click clear button
      cy.get('[data-testid="clear-search-btn"]').click();
      
      // Search input should be empty
      cy.get('[data-testid="search-input"]').should('have.value', '');
      
      // Should show all users again
      cy.get('[data-testid="user-card"]').should('have.length.at.least', 1);
    });
  });

  describe('Layout Toggle', () => {
    it('should toggle between grid and vertical layouts', () => {
      // Should start in grid layout
      cy.get('[data-testid="user-grid"]').should('have.class', 'smart-grid-layout');
      
      // Click layout toggle
      cy.get('[data-testid="layout-toggle"]').click();
      
      // Should switch to vertical layout
      cy.get('[data-testid="user-grid"]').should('have.class', 'vertical-layout');
      
      // User cards should be arranged vertically
      cy.get('[data-testid="user-card"]').first().should('have.class', 'vertical-card');
      
      // Toggle back to grid
      cy.get('[data-testid="layout-toggle"]').click();
      cy.get('[data-testid="user-grid"]').should('have.class', 'smart-grid-layout');
    });

    it('should remember layout preference on page reload', () => {
      // Switch to vertical layout
      cy.get('[data-testid="layout-toggle"]').click();
      cy.get('[data-testid="user-grid"]').should('have.class', 'vertical-layout');
      
      // Reload page
      cy.reload();
      
      // Should maintain vertical layout
      cy.get('[data-testid="user-grid"]').should('have.class', 'vertical-layout');
    });
  });

  describe('User Interactions', () => {
    it('should open user profile modal when user card is clicked', () => {
      // Click on first user card
      cy.get('[data-testid="user-card"]').first().click();
      
      // Profile modal should open
      cy.get('[data-testid="profile-modal"]').should('be.visible');
      
      // Modal should contain user information
      cy.get('[data-testid="profile-modal"]').within(() => {
        cy.get('[data-testid="profile-name"]').should('be.visible');
        cy.get('[data-testid="profile-bio"]').should('be.visible');
        cy.get('[data-testid="profile-interests"]').should('be.visible');
        cy.get('[data-testid="profile-image"]').should('be.visible');
      });
      
      // Should be able to close modal
      cy.get('[data-testid="close-modal-btn"]').click();
      cy.get('[data-testid="profile-modal"]').should('not.exist');
    });

    it('should send friend request when add friend button is clicked', () => {
      // Click add friend button on first user
      cy.get('[data-testid="user-card"]').first().within(() => {
        cy.get('[data-testid="add-friend-btn"]').click();
      });
      
      // Should show success toast
      cy.get('[data-testid="toast"]').should('be.visible');
      cy.get('[data-testid="toast"]').should('contain', 'Friend request sent');
      
      // Button should change state
      cy.get('[data-testid="user-card"]').first().within(() => {
        cy.get('[data-testid="add-friend-btn"]').should('contain', 'Request Sent');
        cy.get('[data-testid="add-friend-btn"]').should('be.disabled');
      });
    });

    it('should handle video playback on user cards', () => {
      // Find a user card with video
      cy.get('[data-testid="user-card"]').each(($card) => {
        if ($card.find('[data-testid="profile-video"]').length > 0) {
          cy.wrap($card).within(() => {
            // Video should be present
            cy.get('[data-testid="profile-video"]').should('be.visible');
            
            // Should have play indicator when paused
            cy.get('[data-testid="video-play-indicator"]').should('be.visible');
            
            // Hover over card should start playing video
            cy.get('[data-testid="user-card"]').trigger('mouseenter');
            
            // Video should start playing (play indicator should disappear)
            cy.get('[data-testid="video-play-indicator"]').should('not.be.visible');
          });
          
          return false; // Exit the loop
        }
      });
    });
  });

  describe('Smart Grid Functionality', () => {
    it('should display users in smart grid with prominent cards', () => {
      // Should have grid chunks
      cy.get('[data-testid="grid-chunk"]').should('have.length.at.least', 1);
      
      // Each chunk should have a prominent user (2x2)
      cy.get('[data-testid="grid-chunk"]').each(($chunk) => {
        cy.wrap($chunk).within(() => {
          cy.get('[data-testid="prominent-user-card"]').should('have.length', 1);
          cy.get('[data-testid="regular-user-card"]').should('have.length.at.most', 5);
        });
      });
    });

    it('should alternate prominent user positions between chunks', () => {
      // First chunk should have prominent user in top-left
      cy.get('[data-testid="grid-chunk"]').first().within(() => {
        cy.get('[data-testid="prominent-user-card"]')
          .should('have.css', 'grid-column', '1 / 3')
          .should('have.css', 'grid-row', '1 / 3');
      });
      
      // Second chunk (if exists) should have prominent user in top-right
      cy.get('[data-testid="grid-chunk"]').eq(1).then(($chunk) => {
        if ($chunk.length > 0) {
          cy.wrap($chunk).within(() => {
            cy.get('[data-testid="prominent-user-card"]')
              .should('have.css', 'grid-column', '2 / 4')
              .should('have.css', 'grid-row', '1 / 3');
          });
        }
      });
    });
  });

  describe('Infinite Scrolling', () => {
    it('should load more users when scrolling to bottom', () => {
      // Get initial count of user cards
      cy.get('[data-testid="user-card"]').then(($cards) => {
        const initialCount = $cards.length;
        
        // Scroll to bottom
        cy.scrollTo('bottom');
        
        // Should show loading indicator
        cy.get('[data-testid="loading-more"]').should('be.visible');
        
        // Should load more users
        cy.get('[data-testid="user-card"]').should('have.length.greaterThan', initialCount);
        
        // Loading indicator should disappear
        cy.get('[data-testid="loading-more"]').should('not.exist');
      });
    });

    it('should show end message when no more users to load', () => {
      // Keep scrolling until no more users
      function scrollAndCheck() {
        cy.scrollTo('bottom');
        cy.wait(1000); // Wait for potential loading
        
        cy.get('body').then(($body) => {
          if ($body.find('[data-testid="loading-more"]').length > 0) {
            scrollAndCheck(); // Recursively scroll if still loading
          } else {
            // Should show end message
            cy.get('[data-testid="end-of-results"]').should('be.visible');
            cy.get('[data-testid="end-of-results"]').should('contain', 'You\'ve seen everyone nearby');
          }
        });
      }
      
      scrollAndCheck();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      // Intercept API calls and simulate network error
      cy.intercept('POST', '/api/search/unified', { forceNetworkError: true }).as('searchError');
      
      // Trigger search
      cy.get('[data-testid="search-input"]').type('test');
      
      // Wait for error
      cy.wait('@searchError');
      
      // Should show error message
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="error-message"]').should('contain', 'Something went wrong');
      
      // Should have retry button
      cy.get('[data-testid="retry-btn"]').should('be.visible');
    });

    it('should recover from errors when retry is clicked', () => {
      // Simulate error first, then success
      cy.intercept('POST', '/api/search/unified', { forceNetworkError: true }).as('searchError');
      
      cy.get('[data-testid="search-input"]').type('test');
      cy.wait('@searchError');
      
      // Now mock successful response
      cy.intercept('POST', '/api/search/unified', { fixture: 'users.json' }).as('searchSuccess');
      
      // Click retry
      cy.get('[data-testid="retry-btn"]').click();
      
      // Should recover and show users
      cy.wait('@searchSuccess');
      cy.get('[data-testid="user-card"]').should('have.length.at.least', 1);
      cy.get('[data-testid="error-message"]').should('not.exist');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      // Should be able to tab through interactive elements
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'search-input');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'layout-toggle');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid').and('match', /user-card|add-friend-btn/);
    });

    it('should have proper ARIA labels and roles', () => {
      cy.get('[data-testid="search-input"]')
        .should('have.attr', 'aria-label', 'Search for people near you');
      
      cy.get('[data-testid="layout-toggle"]')
        .should('have.attr', 'aria-label')
        .should('have.attr', 'role', 'button');
      
      cy.get('[data-testid="user-grid"]')
        .should('have.attr', 'role', 'grid');
      
      cy.get('[data-testid="user-card"]').first()
        .should('have.attr', 'role', 'gridcell');
    });

    it('should support screen readers', () => {
      cy.get('[data-testid="user-card"]').first().within(() => {
        // Should have descriptive text for screen readers
        cy.get('[aria-label]').should('exist');
        cy.get('[data-testid="user-name"]').should('have.attr', 'aria-level', '3');
      });
    });
  });

  describe('Performance', () => {
    it('should load initial content quickly', () => {
      const startTime = Date.now();
      
      cy.visit('/discovery');
      
      cy.get('[data-testid="user-card"]').should('have.length.at.least', 1).then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000); // Should load within 3 seconds
      });
    });

    it('should handle large numbers of users without performance issues', () => {
      // Mock a large dataset
      cy.intercept('POST', '/api/search/unified', { fixture: 'large-user-set.json' }).as('largeDataset');
      
      cy.visit('/discovery');
      cy.wait('@largeDataset');
      
      // Should still be responsive
      cy.get('[data-testid="search-input"]').type('test');
      cy.get('[data-testid="search-input"]').should('have.value', 'test');
      
      // Layout toggle should still work smoothly
      cy.get('[data-testid="layout-toggle"]').click();
      cy.get('[data-testid="user-grid"]').should('have.class', 'vertical-layout');
    });
  });
});