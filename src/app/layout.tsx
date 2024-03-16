import 'styles/globals.css'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SRT TRANSLATOR',
  description: 'This is a service that translates SRT files into DeepL',
  icons: '/favicon.ico'
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ja'>
      <body>{children}</body>
    </html>
  )
}
