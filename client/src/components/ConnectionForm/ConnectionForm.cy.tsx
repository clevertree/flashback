import React from 'react'
import { mount } from 'cypress/react18'

import ConnectionForm from "@components/ConnectionForm/ConnectionForm";

describe('ConnectionForm component', () => {
  it('disables inputs and button when connected', () => {
    const noop = () => {}
    mount(
      <ConnectionForm
        serverIp="127.0.0.1"
        serverPort="8080"
        clientIp="127.0.0.1"
        clientPort="5555"
        connected={true}
        status="Connected"
        error=""
        setServerIp={noop}
        setServerPort={noop}
        setClientIp={noop}
        setClientPort={noop}
        onConnect={noop}
      />
    )
    cy.contains('button', 'Connected').should('be.disabled')
    cy.get('input[placeholder="127.0.0.1"]').should('be.disabled')
    cy.get('input[placeholder="8080"]').should('be.disabled')
  })
})
