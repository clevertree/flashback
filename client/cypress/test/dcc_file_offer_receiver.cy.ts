describe('DCC file offer (receiver UI)', () => {
  it('shows receiver options panel on incoming file offer (stubbed)', () => {
    cy.visit('/')

    // Simulate receiving a DCC file offer from a peer
    const from_ip = '127.0.0.2'
    const from_port = 55555
    const name = 'sample.mp4'
    const size = 123456

    cy.window().then((win: any) => {
      // Open DCC chat with the peer and simulate file offer
      win.debugReceiveFileOffer(from_ip, from_port, name, size)
    })

    // DCC section should appear
    cy.get('#dcc').should('exist')

    // Incoming file panel should render
    cy.contains('Incoming file:').should('exist')
    cy.contains('sample.mp4').should('exist')

    // Actions exist (may be disabled until stream URL exists)
    cy.contains('button', 'Playback').should('exist')
  })
})
