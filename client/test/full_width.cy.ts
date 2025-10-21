describe('Full-width layout', () => {
  it('uses most of the viewport width when nav is visible', () => {
    cy.viewport(1200, 800)
    cy.visit('/')
    cy.get('main').then(($main) => {
      const mainWidth = ($main[0] as HTMLElement).clientWidth
      expect(mainWidth).to.be.greaterThan(1100) // near full width, margins apply via offset not width
    })
    cy.get('#video').then(($video) => {
      const videoWidth = ($video[0] as HTMLElement).clientWidth
      expect(videoWidth).to.be.greaterThan(900)
    })
  })
})
