describe('Nav transitions', () => {
  it('has transition classes and animates side change', () => {
    cy.visit('/')

    // Nav aside should have transition-transform class
    cy.get('[data-testid="nav-menu"]').should('have.class', 'transition-transform')

    // Main should have transition-all class and left margin initially
    cy.get('main').should('have.class', 'transition-all')
      .and('have.class', 'ml-56')

    // Toggle side; main should switch to right margin
    cy.contains('button', 'Move Nav').click()
    cy.get('main').should('have.class', 'mr-56')
  })
})
