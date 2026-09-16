'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import {
  BANNER_THEMES,
  SITE_BANNERS_KEY,
  bannerDismissKey,
  isExternalBannerUrl,
  parseSiteBanners,
  type BannerTheme,
  type SiteBanner,
} from '@/lib/site-banners'

const THEME_ICONS: Record<BannerTheme, typeof AlertTriangle> = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  danger: AlertOctagon,
}

/**
 * A single banner's visuals. Exported so the admin editor can preview a banner
 * with the real thing instead of a look-alike that can drift out of sync.
 */
export function SiteBannerRow({
  banner,
  onDismiss,
}: {
  banner: SiteBanner
  onDismiss?: () => void
}) {
  const theme = BANNER_THEMES[banner.theme] ?? BANNER_THEMES.warning
  const Icon = THEME_ICONS[banner.theme] ?? AlertTriangle
  const external = isExternalBannerUrl(banner.linkUrl)

  return (
    <div style={{ background: theme.bg, color: theme.fg }}>
      <div className="container mx-auto px-4 py-3 flex items-start gap-3">
        {/* This wrapper is exactly one line of text tall and matches the
            paragraph's font size, so centring the circle inside it puts the
            circle's middle on the middle of the FIRST line — and keeps it
            there when the message wraps onto several lines. */}
        <span className="shrink-0 flex items-center h-[1.625em] text-xs md:text-sm">
          <span
            className="flex items-center justify-center w-7 h-7 rounded-full"
            style={{ background: theme.iconBg }}
          >
            <Icon size={15} strokeWidth={2.5} />
          </span>
        </span>

        {/* md:leading-relaxed is not redundant: Tailwind's md:text-sm ships its
            own line-height and would otherwise override the base leading-relaxed
            at desktop only, leaving the line box shorter than the icon wrapper
            above and knocking the alignment out by ~1.4px. */}
        <p className="flex-1 text-xs md:text-sm leading-relaxed md:leading-relaxed min-w-0 font-medium">
          {banner.label && (
            <span className="font-black tracking-widest uppercase mr-2 text-[10px] md:text-xs">
              {banner.label}
            </span>
          )}
          {banner.message}
          {banner.linkUrl && banner.linkLabel && (
            <a
              href={banner.linkUrl}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="ml-2 inline-block font-bold underline underline-offset-2 hover:opacity-75 transition-opacity duration-150"
            >
              {banner.linkLabel}
            </a>
          )}
        </p>

        {banner.dismissible && onDismiss && (
          // Same one-line-tall wrapper as the icon, so the X centres on the
          // first line too instead of hanging below it.
          <span className="shrink-0 flex items-center h-[1.625em] text-xs md:text-sm">
            <button
              onClick={onDismiss}
              aria-label={`Dismiss ${banner.label || 'notice'}`}
              // Negative margin keeps the glyph visually flush with the edge
              // while the padding gives it a ~35px touch target on phones.
              className="-mr-1.5 p-2.5 rounded-md opacity-60 hover:opacity-100 transition-opacity duration-150"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Admin-managed notice bar pinned to the bottom of the homepage.
 *
 * Renders nothing until the settings have loaded, so a banner never flashes in
 * and then disappears. Dismissals are per-visitor and per-session, matching how
 * the old hard-coded ILP notice behaved.
 */
/** Must outlast the longest exit transition in globals.css (.site-banner-slot). */
const EXIT_MS = 380

export default function SiteBanners() {
  const [banners, setBanners] = useState<SiteBanner[] | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [leaving, setLeaving] = useState<string[]>([])
  const [entered, setEntered] = useState(false)
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  useEffect(() => {
    let cancelled = false

    const apply = (rawValue: string | null) => {
      if (cancelled) return
      const loaded = parseSiteBanners(rawValue)
      setBanners(loaded)
      // Read dismissals only for the banners actually in play, so stale keys
      // from edited or deleted banners simply stop mattering.
      try {
        setDismissed(loaded.map(bannerDismissKey).filter((key) => sessionStorage.getItem(key)))
      } catch {
        // Private-mode storage: everything just stays visible.
      }
    }

    fetch(`/api/admin/settings?key=${SITE_BANNERS_KEY}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const row = data?.settings?.find((s: { key: string }) => s.key === SITE_BANNERS_KEY)
        apply(row ? row.value : null)
      })
      // An unreachable settings API falls back to the built-in notice rather
      // than silently dropping a mandatory advisory.
      .catch(() => apply(null))

    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = (banner: SiteBanner) => {
    if (leaving.includes(banner.id)) return

    const key = bannerDismissKey(banner)
    // Persist first, so a visitor who navigates mid-animation still has it closed.
    try {
      sessionStorage.setItem(key, '1')
    } catch {
      // Dismissal just won't survive a page change.
    }

    const el = slotRefs.current[banner.id]
    if (el) {
      // height:auto cannot animate, so freeze the current height as the start
      // value and force a reflow before the collapsing class lands.
      el.style.height = `${el.offsetHeight}px`
      void el.offsetHeight
    }

    setLeaving((prev) => [...prev, banner.id])
    // A timer rather than transitionend: under prefers-reduced-motion there is
    // no transition to end, and the banner still has to unmount.
    timers.current.push(
      window.setTimeout(
        () => setDismissed((prev) => (prev.includes(key) ? prev : [...prev, key])),
        EXIT_MS
      )
    )
  }

  const visible = (banners ?? []).filter(
    (banner) => banner.enabled && !dismissed.includes(bannerDismissKey(banner))
  )

  // Two frames: the first paints the off-screen start state, the second flips
  // to the end state so the browser actually has something to animate from.
  useEffect(() => {
    if (visible.length === 0 || entered) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [visible.length, entered])

  if (visible.length === 0) return null

  // Taken from the top banner and held steady while one is collapsing, since a
  // leaving banner stays in `visible` until its animation finishes.
  const topTheme = BANNER_THEMES[visible[0].theme] ?? BANNER_THEMES.warning

  return (
    <div
      className={`site-banner-bar fixed bottom-0 left-0 right-0 z-40 overflow-y-auto${
        entered ? ' site-banner-bar--in' : ''
      }`}
      style={{ boxShadow: `0 -4px 32px ${topTheme.shadow}` }}
    >
      {visible.map((banner) => (
        <div
          key={banner.id}
          ref={(el) => {
            slotRefs.current[banner.id] = el
          }}
          className={`site-banner-slot${
            leaving.includes(banner.id) ? ' site-banner-slot--out' : ''
          }`}
        >
          <SiteBannerRow banner={banner} onDismiss={() => dismiss(banner)} />
        </div>
      ))}
    </div>
  )
}
