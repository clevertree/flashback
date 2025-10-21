describe('Settings Section', () => {
  it('allows changing nav side and toggling media auto-play', () => {
    cy.visit('/')

    // Navigate to Settings
    cy.contains('button', 'Settings').click()

    // Toggle nav side
    cy.get('main').should('have.class', 'ml-56')
    cy.contains('button', 'RIGHT').click()
    cy.get('main').should('have.class', 'mr-56')

    // Toggle media autoplay checkbox
    cy.get('#settings').within(() => {
      cy.get('input[type="checkbox"]').first().click({ force: true })
    })
  })
})
