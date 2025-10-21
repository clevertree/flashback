describe('Video Player can play MP4 stream', () => {
  it('loads and plays an external MP4 URL', () => {
    cy.visit('/')

    const url = 'https://file-examples.com/storage/feefe0499e68f797f9c8b17/2017/04/file_example_MP4_480_1_5MG.mp4'

    // Set video src and trigger load + play
    cy.get('[data-testid="video-player"]').then(($video) => {
      const v = $video[0] as HTMLVideoElement
      v.muted = true // help autoplay in CI
      v.src = url
      v.load()
      v.play().catch(() => {/* ignore autoplay prevention */})
    })

    // Wait for canplay and ensure readyState is sufficient
    cy.get('[data-testid="video-player"]', { timeout: 30000 })
      .should(($v) => {
        const el = $v[0] as HTMLVideoElement
        expect(el.readyState).to.be.gte(2) // HAVE_CURRENT_DATA
      })

    // Ensure playback actually advances time
    cy.get('[data-testid="video-player"]').then(($video) => {
      const start = ($video[0] as HTMLVideoElement).currentTime
      // Wait a bit and check time progressed
      cy.wait(1500)
      cy.get('[data-testid="video-player"]').should(($v2) => {
        const now = ($v2[0] as HTMLVideoElement).currentTime
        expect(now).to.be.greaterThan(start)
      })
    })
  })
})
