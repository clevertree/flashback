describe('DCC Chatroom', () => {
  it('is not visible until a peer is selected', () => {
    cy.visit('/')
    cy.get('#dcc').should('not.exist')
  })
})
