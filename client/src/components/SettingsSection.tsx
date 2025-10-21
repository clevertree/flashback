"use client"
import React from 'react'
import type { NavSide } from '../config'

export interface SettingsSectionProps {
  navSide: NavSide
  autoPlayMedia: boolean
  onChangeNavSide: (side: NavSide) => void
  onToggleAutoPlay: (val: boolean) => void
}

export default function SettingsSection({ navSide, autoPlayMedia, onChangeNavSide, onToggleAutoPlay }: SettingsSectionProps) {
  return (
    <section id="settings" className="bg-gray-800 rounded-lg p-6 shadow-lg mt-8">
      <h2 className="text-2xl font-semibold mb-4">Settings</h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Navigation</h3>
          <div className="inline-flex rounded border border-gray-600 overflow-hidden" role="group" aria-label="Nav side">
            {(['left','right'] as NavSide[]).map((side) => (
              <button
                key={side}
                onClick={() => onChangeNavSide(side)}
                className={`px-3 py-1 text-sm ${navSide === side ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                {side.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Media</h3>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPlayMedia} onChange={(e) => onToggleAutoPlay(e.target.checked)} />
            Auto-play media streams
          </label>
        </div>
      </div>
    </section>
  )
}
