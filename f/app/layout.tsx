import '@solana/wallet-adapter-react-ui/styles.css'
import '../styles/globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <head />
      <body className="min-h-screen bg-black text-white">
        {children}
      </body>
    </html>
  )
}
