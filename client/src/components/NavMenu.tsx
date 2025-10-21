"use client"
import React, { useEffect, useState } from 'react'
import type { NavSide } from '../config'

export interface NavMenuProps {
  side: NavSide
  items?: { label: string; onClick: () => void }[]
}

export default function NavMenu({ side, items = [] }: NavMenuProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <aside
      role="navigation"
      aria-label="Primary"
      data-testid="nav-menu"
      className={`fixed top-0 ${side === 'left' ? 'left-0' : 'right-0'} h-full w-56 bg-gray-900/90 border-${
        side === 'left' ? 'r' : 'l'
      } border-gray-700 p-4 z-40 transition-transform duration-300 ${
        mounted ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full'
      }`}
    >
      <div className="text-white font-bold text-lg mb-4">Flashback</div>
      <nav className="space-y-2">
        {items.length === 0 ? (
          <div className="text-gray-400 text-sm">No menu items</div>
        ) : (
          items.map((it, idx) => (
            <button
              key={idx}
              className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={it.onClick}
            >
              {it.label}
            </button>
          ))
        )}
      </nav>
    </aside>
  )
}
