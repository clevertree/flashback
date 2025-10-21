"use client"
import React from 'react'
import type { ThemeType } from '../config'

export interface ThemeSwitcherProps {
  theme: ThemeType
  onChange: (theme: ThemeType) => void
}

export default function ThemeSwitcher({ theme, onChange }: ThemeSwitcherProps) {
  return (
    <div className="inline-flex rounded border border-gray-600 overflow-hidden" data-testid="theme-switcher">
      {(['stacked', 'tabbed'] as ThemeType[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1 text-sm ${
            theme === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  )
}
