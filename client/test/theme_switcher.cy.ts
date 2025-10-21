describe('Theme Switcher', () => {
  it('switches between stacked and tabbed', () => {
    cy.visit('/')

    // Initially Stacked: no tab bar visible (we added tabs only when tabbed)
    cy.contains('button', 'Connection').should('not.exist')

    // Switch to Tabbed
    cy.contains('button', 'Tabbed').click()

    // Tab bar should appear
    cy.contains('button', 'Connection').should('exist')
    cy.contains('button', 'Chat').should('exist')
    cy.contains('button', 'Clients').should('exist')
    cy.contains('button', 'Instructions').should('exist')

    // Switch back to Stacked
    cy.contains('button', 'Stacked').click()
    cy.contains('button', 'Connection').should('not.exist')
  })
})
