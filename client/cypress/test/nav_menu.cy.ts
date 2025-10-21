describe('Nav Menu', () => {
  it('renders and can scroll to sections via links', () => {
    cy.visit('/')

    // Should render nav menu on left by default
    cy.get('[data-testid="nav-menu"]').should('exist').and('have.class', 'left-0')

    // Clicking Settings should scroll down
    cy.window().then((win) => {
      const startY = win.scrollY
      cy.contains('button', 'Settings').click()
      cy.wait(200)
      cy.window().its('scrollY').should('be.greaterThan', startY)
    })
  })
})
