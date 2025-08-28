describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should show validation errors for empty form submission', () => {
    cy.get('[data-cy=login-submit]').click();
    cy.get('[data-cy=email-error]').should('be.visible');
    cy.get('[data-cy=password-error]').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('[data-cy=email-input]').type('invalid@example.com');
    cy.get('[data-cy=password-input]').type('wrongpassword');
    cy.get('[data-cy=login-submit]').click();
    cy.get('[data-cy=login-error]').should('be.visible');
  });

  it('should successfully log in with valid credentials', () => {
    cy.get('[data-cy=email-input]').type(Cypress.env('TEST_USER_EMAIL'));
    cy.get('[data-cy=password-input]').type(Cypress.env('TEST_USER_PASSWORD'));
    cy.get('[data-cy=login-submit]').click();
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.get('[data-cy=user-menu]').should('be.visible');
  });

  it('should maintain session after page reload', () => {
    // Login first
    cy.get('[data-cy=email-input]').type(Cypress.env('TEST_USER_EMAIL'));
    cy.get('[data-cy=password-input]').type(Cypress.env('TEST_USER_PASSWORD'));
    cy.get('[data-cy=login-submit]').click();
    
    // Reload page
    cy.reload();
    
    // Should still be logged in
    cy.get('[data-cy=user-menu]').should('be.visible');
  });
});
