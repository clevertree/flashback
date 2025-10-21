import React from "react";

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
          if (autoPlay) {
            v.muted = true
          }
          await v.play()
        } catch (e) {
          console.warn('Autoplay/play failed:', e)
        }
      }
      const onLoadedMeta = () => tryPlay()
      const onCanPlay = () => tryPlay()
      const onError = (ev: Event) => {
        console.error('Video error event', ev)
      }
      v.addEventListener('loadedmetadata', onLoadedMeta, { once: true })
      v.addEventListener('canplay', onCanPlay, { once: true })
      v.addEventListener('error', onError)
      // attempt immediate play too
      tryPlay()
      v.load()
      return () => {
        v.removeEventListener('loadedmetadata', onLoadedMeta)
        v.removeEventListener('canplay', onCanPlay)
        v.removeEventListener('error', onError)
      }
    }
  }, [source, autoPlay])

  return (
    <section id="video" className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
      <h2 className="text-2xl font-semibold mb-4">📺 Media Player</h2>
      <div className="aspect-video bg-black rounded flex items-center justify-center text-gray-400">
        <video data-testid="video-player" ref={vidRef} className="w-full h-full" controls playsInline preload="auto" crossOrigin="anonymous" />
      </div>
      <p className="text-xs text-gray-400 mt-2">This player will accept incoming streams for playback. For media files, playback is defaulted.</p>
    </section>
  )
}