"use client"
import React from 'react'

export interface VideoPlayerSectionProps {
  autoPlay: boolean
  source?: string
}

export default function VideoPlayerSection({ autoPlay, source }: VideoPlayerSectionProps) {
  return (
    <section id="video" className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
      <h2 className="text-2xl font-semibold mb-4">📺 Media Player</h2>
      <div className="aspect-video bg-black rounded flex items-center justify-center text-gray-400">
        <video data-testid="video-player" className="w-full h-full" controls autoPlay={autoPlay} src={source} />
      </div>
      <p className="text-xs text-gray-400 mt-2">This player will accept incoming streams for playback. For media files, playback is defaulted.</p>
    </section>
  )
}
