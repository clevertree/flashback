describe('Clients List', () => {
  it('shows header and empty state when no clients', () => {
    cy.visit('/')
    cy.contains('Connected Clients (0)').should('exist')
    cy.contains('No clients connected yet. Connect to see other clients.').should('exist')
  })
})
