import React from 'react'
import { mount } from 'cypress/react18'
import ClientsList, { ClientInfo } from '@components/ClientsList/index'

describe('ClientsList component', () => {
  it('renders clients and triggers onDccConnect', () => {
    const clients: ClientInfo[] = [
      { ip: '127.0.0.1', port: 5001 },
      { ip: '127.0.0.1', port: 5002 },
    ]
    const calls: ClientInfo[] = []
    mount(
      <ClientsList
        clients={clients}
        selfIp={'127.0.0.1'}
        selfPort={5001}
        onDccConnect={(c) => {
          calls.push(c)
        }}
      />
    )
    cy.contains('Connected Clients').should('exist')
    cy.contains('button', 'Connect').click()
    cy.wrap(calls).its('length').should('eq', 1)
    cy.wrap(calls).should('deep.equal', [{ ip: '127.0.0.1', port: 5002 }])
  })
})
