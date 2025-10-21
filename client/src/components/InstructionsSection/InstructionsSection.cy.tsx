import React from 'react'
import { mount } from 'cypress/react18'

import InstructionsSection from "@components/InstructionsSection/InstructionsSection";

describe('InstructionsSection component', () => {
  it('renders instructions', () => {
    mount(<InstructionsSection />)
    cy.contains('Instructions').should('exist')
    cy.contains('Connect to Server',{ matchCase: false })
  })
})
