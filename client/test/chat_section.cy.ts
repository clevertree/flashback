describe('Chat Section', () => {
  it('is hidden until connected', () => {
    cy.visit('/')
    cy.get('#chat').should('not.exist')
  })
})
