import React from 'react'
import { mount } from 'cypress/react18'

import DccChatroom from "@components/DccChatroom/DccChatroom";

describe('DccChatroom component', () => {
  it('shows incoming file offer UI and does not call real invoke when mocked', () => {
    const mockInvoke = cy.stub().resolves('ok') as unknown as (cmd: string, args?: any) => Promise<any>

    mount(
      <DccChatroom
        peer={{ ip: '127.0.0.1', port: 5002 }}
        onClose={() => {}}
        onPlayback={() => {}}
        incomingOffer={{ name: 'test.mp4', size: 1234 }}
        invokeFn={mockInvoke}
      />
    )

    cy.contains('Incoming file:').should('exist')
    cy.contains('test.mp4').should('exist')

    // Buttons should be disabled until a URL is available
    cy.contains('button','Open with OS').should('be.disabled')
    cy.contains('button','Save to OS').should('be.disabled')
    cy.contains('button','Playback').should('be.disabled')
  })
})
