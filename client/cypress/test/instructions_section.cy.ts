describe('InstructionsSection Component', () => {
  it('renders the instructions section', () => {
    cy.visit('/')
    cy.get('[data-testid="instructions-section"]').should('exist')
  })

  it('displays instruction headings and content', () => {
    cy.visit('/')
    // TODO: Verify heading text and instruction content are displayed
  })

  it('displays instructions before connection', () => {
    cy.visit('/')
    // TODO: Verify instructions appear in initial UI state
  })

  it('contains helpful guidance for user', () => {
    cy.visit('/')
    // TODO: Verify specific instruction text content
  })
})
