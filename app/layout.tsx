import type { Metadata } from 'next'
import { Bebas_Neue, Outfit, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Showtime',
  description: 'Your private movie watchlist',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${bebasNeue.variable} ${outfit.variable} ${dmSerifDisplay.variable} font-body bg-void text-primary antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  )
}
