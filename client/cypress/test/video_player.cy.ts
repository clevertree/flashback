describe('Video Player Section', () => {
  it('renders a video element', () => {
    cy.visit('/')
    cy.get('[data-testid="video-player"]').should('exist')
  })
})
