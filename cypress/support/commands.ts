// -- This is a parent command --
Cypress.Commands.add('login', (email, password) => { 
  cy.get('[data-cy=email-input]').type(email);
  cy.get('[data-cy=password-input]').type(password);
  cy.get('[data-cy=login-submit]').click();
});
