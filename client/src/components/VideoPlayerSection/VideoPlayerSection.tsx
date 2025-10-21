"use client"
import React from 'react'

export interface VideoPlayerSectionProps {
  autoPlay: boolean
  source?: string
}

export default function VideoPlayerSection({ autoPlay, source }: VideoPlayerSectionProps) {
  const vidRef = React.useRef<HTMLVideoElement | null>(null)

  React.useEffect(() => {
    const v = vidRef.current
    if (!v) return
    if (source) {
      v.src = source
      const tryPlay = async () => {
        try {
          // Some browsers require muted + playsInline for autoplay
          if (autoPlay) {
            v.muted = true
          }
          await v.play()
        } catch (e) {
          // ignore autoplay errors; user can press play
          // console.warn('Autoplay prevented:', e)
        }
      }
      // load and attempt play when metadata is ready
      const onCanPlay = () => tryPlay()
      v.addEventListener('canplay', onCanPlay, { once: true })
      v.load()
      return () => {
        v.removeEventListener('canplay', onCanPlay)
      }
    }
  }, [source, autoPlay])

  return (
    <section id="video" className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
      <h2 className="text-2xl font-semibold mb-4">📺 Media Player</h2>
      <div className="aspect-video bg-black rounded flex items-center justify-center text-gray-400">
        <video data-testid="video-player" ref={vidRef} className="w-full h-full" controls playsInline preload="auto" />
      </div>
      <p className="text-xs text-gray-400 mt-2">This player will accept incoming streams for playback. For media files, playback is defaulted.</p>
    </section>
  )
}
