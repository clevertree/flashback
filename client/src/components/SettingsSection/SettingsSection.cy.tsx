import React from 'react'
import { mount } from 'cypress/react18'

import SettingsSection from "@components/SettingsSection/SettingsSection";

describe('SettingsSection component', () => {
  it('toggles nav side and autoplay', () => {
    const state = { side: 'left' as 'left'|'right', auto: true, connectOnStartup: true, autoReconnectPeers: true, fileRootDirectory: '' }
    mount(
      <SettingsSection
        navSide={state.side}
        autoPlayMedia={state.auto}
        connectOnStartup={state.connectOnStartup}
        autoReconnectPeers={state.autoReconnectPeers}
        fileRootDirectory={state.fileRootDirectory}
        onChangeNavSide={(s) => (state.side = s)}
        onToggleAutoPlay={(v) => (state.auto = v)}
        onToggleConnectOnStartup={(v) => (state.connectOnStartup = v)}
        onToggleAutoReconnectPeers={(v) => (state.autoReconnectPeers = v)}
        onChangeFileRootDirectory={(path) => (state.fileRootDirectory = path)}
      />
    )
    cy.contains('button','RIGHT').click()
    cy.wrap(state).its('side').should('eq', 'right')
    cy.get('input[type="checkbox"]').uncheck({ force: true })
    cy.wrap(state).its('auto').should('eq', false)
  })
})
