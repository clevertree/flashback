describe('Connection Form', () => {
  it('renders inputs and connect button', () => {
    cy.visit('/')
    cy.get('#connection').within(() => {
      cy.contains('Connection Settings')
      cy.get('input[placeholder="127.0.0.1"]').should('exist')
      cy.get('input[placeholder="8080"]').should('exist')
      cy.get('input[placeholder="Random port"]').should('exist')
      cy.contains('button', 'Connect to Server').should('exist')
    })
  })
})
