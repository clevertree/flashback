describe('Responsive Nav', () => {
  it('auto-hides nav at width <= 800 and shows at > 800, adjusting main margins', () => {
    cy.viewport(1000, 800)
    cy.visit('/')
    // >800: nav visible and main offset by ml-56 by default
    cy.get('[data-testid="nav-menu"]').should('exist')
    cy.get('main').should('have.class', 'ml-56')

    // <=800: nav hidden and main has no ml-56/mr-56
    cy.viewport(800, 800)
    cy.wait(100) // wait for resize listener
    cy.get('[data-testid="nav-menu"]').should('not.exist')
    cy.get('main').should('not.have.class', 'ml-56').and('not.have.class', 'mr-56')
  })
})
