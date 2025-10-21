describe('Nav Menu', () => {
  it('renders and toggles side', () => {
    cy.visit('/')

    // Should render nav menu on left by default
    cy.get('[data-testid="nav-menu"]').should('exist').and('have.class', 'left-0')

    // Click Move Nav to switch to right side
    cy.contains('button', 'Move Nav').click()
    cy.get('[data-testid="nav-menu"]').should('have.class', 'right-0')
  })
})
