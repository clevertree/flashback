import React from 'react'
import { mount } from 'cypress/react18'
import ChatSection, { ChatMessage } from '@components/ChatSection/index'

describe('ChatSection component', () => {
  it('renders messages for current channel and sends', () => {
    const msgs: ChatMessage[] = [
      { from_ip: '1.1.1.1', from_port: 1000, message: 'hi', timestamp: new Date().toISOString(), channel: 'general' },
      { from_ip: '2.2.2.2', from_port: 2000, message: 'off-topic', timestamp: new Date().toISOString(), channel: 'random' },
    ]
    const actions = { sent: false }
    mount(
      <ChatSection
        connected={true}
        clientIp="1.1.1.1"
        clientPort={1000}
        availableChannels={["general","random"]}
        currentChannel="general"
        newChannelInput=""
        chatMessages={msgs}
        messageInput={"hello"}
        setCurrentChannel={() => {}}
        setNewChannelInput={() => {}}
        setMessageInput={() => {}}
        onAddChannel={() => {}}
        onSend={() => { actions.sent = true }}
        formatTimestamp={(s) => s}
      />
    )
    cy.contains('💬 Group Chat').should('exist')
    cy.contains('hi').should('exist')
    cy.contains('off-topic').should('not.exist')
    cy.contains('button','Send').click()
    cy.wrap(actions).its('sent').should('eq', true)
  })
})
