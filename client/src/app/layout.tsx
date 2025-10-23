import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flashback',
  description: 'Connect to a server and view connected clients',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
