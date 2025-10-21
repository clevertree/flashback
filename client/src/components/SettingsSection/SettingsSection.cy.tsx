import React from 'react'
import { mount } from 'cypress/react18'
import SettingsSection from '@components/SettingsSection/index'

describe('SettingsSection component', () => {
  it('toggles nav side and autoplay', () => {
    const state = { side: 'left' as 'left'|'right', auto: true }
    mount(
      <SettingsSection
        navSide={state.side}
        autoPlayMedia={state.auto}
        onChangeNavSide={(s) => (state.side = s)}
        onToggleAutoPlay={(v) => (state.auto = v)}
      />
    )
    cy.contains('button','RIGHT').click()
    cy.wrap(state).its('side').should('eq', 'right')
    cy.get('input[type="checkbox"]').uncheck({ force: true })
    cy.wrap(state).its('auto').should('eq', false)
  })
})
