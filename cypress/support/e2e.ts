// Import commands.js using ES2015 syntax:
import './commands';

declare global {
  namespace Cypress {
    interface Chainable {
      login(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', () => {
  cy.visit('/login');
  cy.get('[data-cy=email-input]').type(Cypress.env('TEST_USER_EMAIL'));
  cy.get('[data-cy=password-input]').type(Cypress.env('TEST_USER_PASSWORD'));
  cy.get('[data-cy=login-submit]').click();
});
