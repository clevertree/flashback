describe('Tab persistence', () => {
  it('remembers last active tab in tabbed theme', () => {
    cy.visit('/')

    // Switch to Tabbed
    cy.contains('button', 'Tabbed').click()

    // Click Chat tab
    cy.contains('button', 'Chat').click()
    cy.contains('button', 'Chat').should('have.attr', 'aria-selected', 'true')

    // Reload and ensure Chat is still active
    cy.reload()

    // Ensure still in Tabbed theme
    cy.contains('button', 'Connection').should('exist')

    // Chat should remain selected
    cy.contains('button', 'Chat').should('have.attr', 'aria-selected', 'true')
  })
})
