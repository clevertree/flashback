describe('Nav transitions', () => {
  it('has transition classes and side can be changed in Settings', () => {
    cy.visit('/')

    // Nav aside should have transition-transform class
    cy.get('[data-testid="nav-menu"]').should('have.class', 'transition-transform')

    // Main should have transition-all class and left margin initially
    cy.get('main').should('have.class', 'transition-all')
      .and('have.class', 'ml-56')

    // Open Settings and switch to RIGHT side
    cy.contains('button', 'Settings').click()
    cy.contains('button', 'RIGHT').click()
    cy.get('main').should('have.class', 'mr-56')
  })
})
