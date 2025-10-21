import React from 'react'
import { mount } from 'cypress/react18'
import VideoPlayerSection from '@components/VideoPlayerSection/index'

describe('VideoPlayerSection component', () => {
  it('sets video source when provided', () => {
    const src = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4'
    mount(<VideoPlayerSection autoPlay={false} source={src} />)
    cy.get('video[data-testid="video-player"]').should('have.attr', 'src', src)
  })
})
