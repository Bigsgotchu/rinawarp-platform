describe('Terminal Functionality', () => {
  beforeEach(() => {
    // Login and navigate to terminal
    cy.login();
    cy.visit('/terminal');
  });

  it('should properly initialize terminal', () => {
    // Check terminal container exists
    cy.get('[data-cy=terminal-container]').should('be.visible');
    
    // Check xterm.js canvas is rendered
    cy.get('.xterm-screen').should('be.visible');
    
    // Verify terminal prompt is shown
    cy.get('.xterm-screen').should('contain', '$');
  });

  it('should execute basic commands', () => {
    // Type and execute 'pwd' command
    cy.get('[data-cy=terminal-input]').type('pwd{enter}');
    
    // Should show current directory
    cy.get('.xterm-screen').should('contain', '/');
    
    // Type and execute 'echo "test"' command
    cy.get('[data-cy=terminal-input]').type('echo "test"{enter}');
    
    // Should show output
    cy.get('.xterm-screen').should('contain', 'test');
  });

  it('should support terminal customization', () => {
    // Open settings
    cy.get('[data-cy=terminal-settings]').click();
    
    // Change font size
    cy.get('[data-cy=font-size-input]').clear().type('16');
    cy.get('[data-cy=apply-settings]').click();
    
    // Verify font size changed
    cy.get('.xterm-screen').should('have.css', 'font-size', '16px');
  });

  it('should handle multiple terminals', () => {
    // Create new terminal
    cy.get('[data-cy=new-terminal]').click();
    
    // Should have two terminals
    cy.get('[data-cy=terminal-container]').should('have.length', 2);
    
    // Switch between terminals
    cy.get('[data-cy=terminal-tab]').first().click();
    cy.get('[data-cy=terminal-tab]').last().click();
  });

  it('should support AI assistance mode', () => {
    // Enable AI mode
    cy.get('[data-cy=ai-mode-toggle]').click();
    
    // Type a question
    cy.get('[data-cy=terminal-input]').type('How do I check disk usage?{enter}');
    
    // Should receive AI response
    cy.get('.xterm-screen').should('contain', 'df -h');
  });
});
