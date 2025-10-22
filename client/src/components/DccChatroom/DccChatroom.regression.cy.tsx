import React from 'react'
import DccChatroom from './DccChatroom'

// Note: These are high-level regression specs that document expected behavior and can be enabled
// once the mocking harness for Tauri modules is finalized. For now, they are skipped.

describe('DccChatroom regression (planned)', () => {
  const peer = { ip: '127.0.0.1', port: 50002 }

  it.skip('creates .part in OS temp or configured tempDir when choosing Open with OS', () => {
    // Mount with an incoming offer; clicking Open with OS should select a save target
    cy.mount(<DccChatroom peer={peer} onClose={() => {}} incomingOffer={{ name: 'video.mp4', size: 1024 }} />)

    // Click Open with OS
    cy.contains('button', 'Open with OS').click()

    // Expectations (when mocks are wired):
    // - dialog.save called and returns C:\\Out\\video.mp4
    // - path.tempDir returns C:\\Temp (unless config.tempDir is set)
    // - fs.removeFile called for C:\\Temp\\video.mp4.part
  })

  it.skip('updates receiver progress above 0% using total-size fallbacks and finalizes on Save', () => {
    cy.mount(<DccChatroom peer={peer} onClose={() => {}} incomingOffer={{ name: 'clip.bin', size: 2048 }} />)

    // Choose Save to trigger streaming-to-disk path
    cy.contains('button', 'Save to…').click()

    // Simulate chunk BroadcastChannel messages and assert progress UI increments
    // Expect finalize to rename .part to final path
  })

  it.skip('opens with OS after finalize when selecting Open with OS', () => {
    cy.mount(<DccChatroom peer={peer} onClose={() => {}} incomingOffer={{ name: 'music.mp3', size: 4096 }} />)
    cy.contains('button', 'Open with OS').click()
    // Expect shell open/show invoked with final path after finalize
  })

  it.skip('plays back in VideoPlayerSection when stream completes and autoPlayMedia is true', () => {
    cy.mount(<DccChatroom peer={peer} onClose={() => {}} incomingOffer={{ name: 'movie.mkv', size: 4096 }} onPlayback={() => {}} />)
    // Simulate completion with a Blob URL and assert playback handler invoked
  })
})
