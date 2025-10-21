import React from 'react'
import { mount } from 'cypress/react18'
import NavMenu from '@components/NavMenu/index'

describe('NavMenu component', () => {
  it('renders items and calls onClick', () => {
    const clicks: string[] = []
    mount(
      <NavMenu
        side="left"
        items={[
          { label: 'Connection', onClick: () => clicks.push('Connection') },
          { label: 'Chat', onClick: () => clicks.push('Chat') },
        ]}
      />
    )
    cy.get('[data-testid="nav-menu"]').should('exist')
    cy.contains('button', 'Connection').click()
    cy.contains('button', 'Chat').click()
    cy.wrap(clicks).should('deep.equal', ['Connection', 'Chat'])
  })
})
