import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/styles/index.scss'
import { FAVICON_DATA_URI } from './favicon'

/** Google Fontsの読み込み先。書体はdesign-system.mdで決めている。 */
const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;700&family=Shippori+Mincho:wght@700&family=Zen+Kurenaido&family=IBM+Plex+Mono:wght@400;600&display=swap'

/** タイトルとファビコン。シリーズのページはタイトルをそのシリーズの`siteTitle`で上書きする。 */
export const metadata: Metadata = {
  title: 'RASHISAメトリクス',
  icons: { icon: [{ url: FAVICON_DATA_URI, type: 'image/png', sizes: '32x32' }] },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

/**
 * HTMLの外枠。フォントの読み込みとグローバルSCSSはここだけで行う。
 *
 * @param props
 * @param props.children ページ本体。
 * @returns 描画結果。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body>{children}</body>
    </html>
  )
}
