'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import {
  Users, Star, Clock, ArrowRight, Car, MapPin,
  Shield, ChevronRight, CheckCircle, Zap, ChevronDown,
  AlertTriangle, X,
} from 'lucide-react'
import { fetchAllTours, fetchAllTourRatingStats, type RatingStats } from '@/lib/db'
import type { TourPackage } from '@/lib/db'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type HomeGuards = {
  target?: EventTarget | null
  wheel?: (e: WheelEvent) => void
  touchstart?: (e: TouchEvent) => void
  touchend?: (e: TouchEvent) => void
  click?: (e: MouseEvent) => void
}

declare global {
  interface Window {
    __homeScrollGuards?: HomeGuards
  }
}

const HERO_IMAGES = [
  'https://images.pexels.com/photos/1172064/pexels-photo-1172064.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/5040304/pexels-photo-5040304.jpeg', 
  'https://images.pexels.com/photos/14522408/pexels-photo-14522408.jpeg?auto=compress&cs=tinysrgb&w=1600', // aerial green trees on mountain
  'https://images.pexels.com/photos/2743281/pexels-photo-2743281.jpeg?auto=compress&cs=tinysrgb&w=1600',  
  'https://www.goodfreephotos.com/albums/other-landscapes/mountains-and-pond-landscape-with-majestic-scenery.jpg',
  'https://i0.wp.com/picjumbo.com/wp-content/uploads/beautiful-nature-mountain-scenery-with-flowers-free-photo.jpg?w=2210&quality=70',

]

const TOUR_IMAGES = [
  'https://images.pexels.com/photos/1172064/pexels-photo-1172064.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/258109/pexels-photo-258109.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://www.goodfreephotos.com/albums/other-landscapes/mountains-and-pond-landscape-with-majestic-scenery.jpg',
  'https://images.pexels.com/photos/2743281/pexels-photo-2743281.jpeg?auto=compress&cs=tinysrgb&w=1600',
]

const STATS = [
  { value: 5000, label: 'Happy Travelers', suffix: '+', decimal: false },
  { value: 1000, label: 'Rides Completed', suffix: '+', decimal: false },
  { value: 50, label: 'Verified Drivers', suffix: '+', decimal: false },
  { value: 4.8, label: 'Avg. Rating', suffix: '★', decimal: true },
]

const HOW_IT_WORKS = [
  { Icon: Car, step: '01', title: 'Book Online', desc: 'Choose your taxi or tour package and confirm in minutes — no calls, no hassle.' },
  { Icon: Shield, step: '02', title: 'We Confirm', desc: 'Instant confirmation — transparent pricing. Zero hidden fees.' },
  { Icon: MapPin, step: '03', title: 'We Pick You Up', desc: "Driver arrives on time at Donyi Polo Airport. Sit back and enjoy Arunachal Pradesh." },
]

export default function HomeClient() {
  const [featuredTours, setFeaturedTours] = useState<TourPackage[]>([])
  const [ratingStats, setRatingStats] = useState<Record<string, RatingStats>>({})
  const [loadingTours, setLoadingTours] = useState(true)
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null)
  const [cardImgIdx, setCardImgIdx] = useState<Record<string, number>>({})
  const [heroIndex, setHeroIndex] = useState(0)
  const [showILPNotice, setShowILPNotice] = useState<boolean | null>(null)
  const touchStartX = useRef<number>(0)
  const mainRef = useRef<HTMLDivElement>(null)
  const overlayPathsRef = useRef<SVGPathElement[]>([])
  const overlaySvgRef = useRef<SVGSVGElement>(null)
  const bookTlRef     = useRef<gsap.core.Timeline | null>(null)
  const confirmTlRef  = useRef<gsap.core.Timeline | null>(null)
  const pickupTlRef   = useRef<gsap.core.Timeline | null>(null)
  const cardsRef = useRef<HTMLElement[]>([])

  // Keep homepage deterministic on refresh/back-forward cache:
  // always start from hero instead of browser-restored deep scroll positions.
  useLayoutEffect(() => {
    const resetScrollTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    resetScrollTop()
    const rafId = window.requestAnimationFrame(resetScrollTop)
    const timeoutId = window.setTimeout(resetScrollTop, 120)

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resetScrollTop()
    }
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  useEffect(() => {
    setShowILPNotice(!sessionStorage.getItem('ilp-notice-dismissed'))
  }, [])

  const dismissILPNotice = () => {
    setShowILPNotice(false)
    sessionStorage.setItem('ilp-notice-dismissed', '1')
  }

  useEffect(() => {
    const id = setInterval(() => setHeroIndex(i => (i + 1) % HERO_IMAGES.length), 12000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    Promise.all([fetchAllTours(), fetchAllTourRatingStats()]).then(([tours, stats]) => {
      setFeaturedTours(tours.slice(0, 4))
      setRatingStats(stats)
      setLoadingTours(false)
    })
  }, [])

  // Preload all tour carousel images as soon as data arrives so the
  // hero → featured-tours transition has images warm in the HTTP cache.
  useEffect(() => {
    if (!featuredTours.length) return
    const links: HTMLLinkElement[] = []
    featuredTours.forEach((tour, i) => {
      const images = tour.image_urls?.length
        ? tour.image_urls
        : tour.image_url ? [tour.image_url]
        : [TOUR_IMAGES[i % TOUR_IMAGES.length]]
      images.forEach((url, imgIdx) => {
        // First image of each tour is highest priority (it's what shows first)
        // Use <link rel="preload"> for browser-priority hint + image() for cache warm
        for (const w of [828, 1080, 1920]) {
          const optimized = `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=75`
          const img = new window.Image()
          img.src = optimized
          if (imgIdx === 0 && i < 2 && w === 1080) {
            const link = document.createElement('link')
            link.rel = 'preload'
            link.as = 'image'
            link.href = optimized
            link.fetchPriority = 'high'
            document.head.appendChild(link)
            links.push(link)
          }
        }
      })
    })
    return () => { links.forEach(l => l.remove()) }
  }, [featuredTours])

  // ── Main scroll + entrance animations ──
  useEffect(() => {
    let ctx: gsap.Context | null = null

    const startAnims = () => {
      ctx = gsap.context(() => {
        // Set initial 3D state for hero cards
        gsap.set('.hero-img-main', { transformPerspective: 1200, rotateY: -8, rotateX: 2, z: 0 })

        // Initially hide all hero and stats elements and disable interaction
        gsap.set('.hero-badge, .hero-line, .hero-btns > *, .hero-sub, .hero-mini-stat, .hero-img-main, .stat-item', { opacity: 0, pointerEvents: 'none' })

        // Hero entrance — animate TO visible state
        const tl = gsap.timeline({ delay: 0.08 })
        tl
          .to('.hero-badge', { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }, 0)
          .to('.hero-line', { y: 0, opacity: 1, stagger: 0.1, duration: 0.62, ease: 'power3.out' }, 0.28)
          .to('.hero-btns > *', { y: 0, opacity: 1, pointerEvents: 'auto', stagger: 0.1, duration: 0.38, ease: 'power2.out' }, 0.4)
          .to('.hero-sub', { y: 0, opacity: 1, duration: 0.36, ease: 'power2.out' }, 0.58)
          .to('.hero-mini-stat', { y: 0, opacity: 1, pointerEvents: 'auto', stagger: 0.06, duration: 0.3, ease: 'power2.out' }, 0.7)
          .to('.hero-img-main', { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 0.52)

        // Stats — animate in and counter on load
        gsap.to('.stat-item', { y: 0, opacity: 1, stagger: 0.09, duration: 0.5, ease: 'power2.out', delay: 0.9 })
        gsap.delayedCall(0.9, () => {
          document.querySelectorAll('.stat-number').forEach((el, i) => {
            const stat = STATS[i]
            if (!stat) return
            const proxy = { val: 0 }
            gsap.to(proxy, {
              val: stat.value, duration: 2, ease: 'power2.out',
              onUpdate() {
                ;(el as HTMLElement).textContent = stat.decimal
                  ? proxy.val.toFixed(1)
                  : Math.floor(proxy.val).toString()
              },
            })
          })
        })

        // Pre-hide per-section elements — animated in by doStep on arrival
        gsap.set('.tours-heading > *', { opacity: 0, y: 20 })
        gsap.set('.step-card', { opacity: 0, y: 70, rotateX: -18, scale: 0.94 })
        gsap.set('.step-connector', { opacity: 0, scale: 0.5 })
        gsap.set('.step-ring-arc', { strokeDashoffset: 153.9 })
        gsap.set('.cta-item', { opacity: 0, y: 32 })
        gsap.set('.cta-diag-line', { scaleY: 0, transformOrigin: '50% 50%' })
        gsap.set('.cta-edge-line', { scaleX: 0, transformOrigin: '50% 50%' })
        gsap.set('.cta-glow-orb', { scale: 0.55, opacity: 0 })
        gsap.set('.cta-dot-grid', { opacity: 0 })

      }, mainRef)
    }

    const onSplashFinished = () => {
      startAnims()
      window.removeEventListener('splashFinished', onSplashFinished)
    }

    if ((window as any).__splashFinished) {
      startAnims()
    } else {
      window.addEventListener('splashFinished', onSplashFinished)
    }

    return () => {
      ctx?.revert()
      window.removeEventListener('splashFinished', onSplashFinished)
    }
  }, [])

  // ── Fully controlled single-step scroll — entire homepage ──
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    const trY = [100, 100]
    let stepIdx = 0
    let transitioning = false
    let headerAutoHideTimer: ReturnType<typeof setTimeout> | null = null

    const isMobile = () => window.innerWidth < 768

    const getGroups = (): number[][] => {
      const len = cardsRef.current.length
      if (isMobile()) return Array.from({ length: len }, (_, i) => [i])
      const groups: number[][] = []
      for (let i = 0; i < len; i += 2) {
        const g = [i]
        if (i + 1 < len) g.push(i + 1)
        groups.push(g)
      }
      return groups
    }

    type S = { t: 'hero' | 'steps' | 'cta' } | { t: 'tours'; gi: number }
    const buildSteps = (): S[] => {
      const groups = getGroups()
      return [{ t: 'hero' }, ...groups.map((_, i): S => ({ t: 'tours', gi: i })), { t: 'steps' }, { t: 'cta' }]
    }

    const showGroup = (gIdx: number, fromRight = true) => {
      const groups = getGroups()
      const group = groups[gIdx]
      if (!group) return
      const cardEnterDuration = 0.48
      const cardStagger = 0.1
      const bgFadeDelay = cardEnterDuration + Math.max(0, group.length - 1) * cardStagger + 0.08
      const startX = fromRight ? window.innerWidth : -window.innerWidth
      // Cross-fade background images — fade out all, then fade in this group's pair
      gsap.to('.tours-bg-img', { opacity: 0, duration: 0.4, overwrite: 'auto' })
      group.forEach((cardIdx, i) => {
        const card = cardsRef.current[cardIdx]
        if (!card) return
        gsap.killTweensOf(card)
        gsap.set(card, { pointerEvents: 'auto', zIndex: 1 }) // Ensure cards are clickable and on top
        gsap.fromTo(card,
          { x: startX, opacity: 0 },
          { x: 0, opacity: 1, duration: cardEnterDuration, delay: i * cardStagger, ease: 'power3.out', overwrite: true }
        )
        const bgEl = document.querySelector<HTMLElement>(`.tours-bg-img[data-tour-idx="${cardIdx}"]`)
        if (bgEl) gsap.to(bgEl, { opacity: 1, duration: 0.7, delay: bgFadeDelay, overwrite: 'auto' })
      })
    }

    const hideGroup = (gIdx: number, toLeft = true) => {
      const groups = getGroups()
      const group = groups[gIdx]
      if (!group) return
      const endX = toLeft ? -window.innerWidth : window.innerWidth
      group.forEach((cardIdx) => {
        const card = cardsRef.current[cardIdx]
        if (!card) return
        gsap.killTweensOf(card)
        gsap.set(card, { pointerEvents: 'none' })
        gsap.to(card, { x: endX, opacity: 0, duration: 0.38, ease: 'power3.in', overwrite: true })
      })
    }

    const resetAllCards = () => {
      cardsRef.current.forEach((card) => {
        gsap.killTweensOf(card)
        gsap.set(card, { x: window.innerWidth, opacity: 0, pointerEvents: 'none' })
      })
      gsap.set('.tours-bg-img', { opacity: 0 })
    }

    // ── Header helpers ──
    const header = document.querySelector('header') as HTMLElement | null
    const flashRay = document.querySelector('[data-header-flash-ray]') as HTMLElement | null
    const playHeaderFlashRay = () => {
      if (!flashRay) return
      gsap.killTweensOf(flashRay)
      gsap.set(flashRay, { xPercent: -115, opacity: 0 })
      gsap.timeline()
        .to(flashRay, { opacity: 1, duration: 0.08, ease: 'power1.out' })
        .to(flashRay, { xPercent: 135, duration: 0.8, ease: 'power3.out' }, 0)
        .to(flashRay, { opacity: 0, duration: 0.12, ease: 'power1.in' }, 0.74)
    }
    const hideHeader = () => {
      if (!header) return
      gsap.killTweensOf(header)
      gsap.set(header, { opacity: 1 })
      gsap.to(header, { yPercent: -110, duration: 0.46, ease: 'power3.inOut' })
    }
    const isInteractiveTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      if (el.closest('a, button, input, textarea, select, label, summary, [role="button"], [data-no-header-peek]')) return true
      // Also treat divs/spans with cursor:pointer as interactive (e.g. tour cards, step cards)
      let cur: HTMLElement | null = el
      while (cur && cur !== document.body) {
        if (window.getComputedStyle(cur).cursor === 'pointer') return true
        cur = cur.parentElement
      }
      return false
    }
    const showHeaderTemporarily = () => {
      if (!header) return
      // Keep hero behavior unchanged (header stays available there).
      if (stepIdx === 0 || transitioning) return
      if (headerAutoHideTimer) {
        clearTimeout(headerAutoHideTimer)
        headerAutoHideTimer = null
      }
      gsap.killTweensOf(header)
      gsap.set(header, { opacity: 1 })
      gsap.to(header, { yPercent: 0, duration: 0.55, ease: 'power2.out' })
      headerAutoHideTimer = setTimeout(() => {
        if (!header.matches(':hover')) hideHeader()
        headerAutoHideTimer = null
      }, 4800)
    }

    const handleHeaderMouseEnter = () => {
      if (headerAutoHideTimer) {
        clearTimeout(headerAutoHideTimer)
        headerAutoHideTimer = null
      }
    }
    const handleHeaderMouseLeave = () => {
      if (stepIdx === 0 || transitioning) return
      if (headerAutoHideTimer) {
        clearTimeout(headerAutoHideTimer)
        headerAutoHideTimer = null
      }
      headerAutoHideTimer = setTimeout(() => {
        if (!header?.matches(':hover')) hideHeader()
        headerAutoHideTimer = null
      }, 4800)
    }
    // ── SVG overlay ──
    const renderTr = (fromBottom: boolean) => {
      overlayPathsRef.current.forEach((path, i) => {
        if (!path) return
        const y = trY[i]
        path.setAttribute('d', fromBottom ? `M 0 ${y} H 100 V 100 H 0 Z` : `M 0 ${y} H 100 V 0 H 0 Z`)
      })
    }
    renderTr(true)

    // ── Main element translate (virtual scroll) ──
    const mainEl = mainRef.current
    if (mainEl) gsap.set(mainEl, { y: 0 })
    const moveToSection = (offsetY: number, instant: boolean, onDone?: () => void) => {
      if (!mainEl) { onDone?.(); return }
      if (instant) { gsap.set(mainEl, { y: -offsetY }); onDone?.() }
      else gsap.to(mainEl, { y: -offsetY, duration: 0.49, ease: 'power3.inOut', onComplete: onDone })
    }

    // ── SVG wipe helper ──
    const playSvgWipe = (forward: boolean, onMid: () => void, onDone: () => void, onWipeReachesTop?: () => void) => {
      const svg = overlaySvgRef.current
      trY[0] = forward ? 100 : 0; trY[1] = forward ? 100 : 0
      renderTr(forward)
      if (svg) gsap.set(svg, { opacity: 1 })
      const tl = gsap.timeline({ onUpdate: () => renderTr(forward), defaults: { ease: 'power3.inOut', duration: 0.9 } })
      if (!forward && header) {
        gsap.killTweensOf(header)
        gsap.set(header, { opacity: 1, yPercent: -110 })
        tl.to(header, { yPercent: 0, duration: 1.07, ease: 'power3.out' }, 0)
      }
      tl.to(trY, { 0: forward ? 0 : 100 }, 0)
      tl.to(trY, { 1: forward ? 0 : 100 }, 0.16)
      // Fire when wipe bar reaches the header's bottom edge (~8% from top ≈ t=0.65s)
      if (forward && onWipeReachesTop) tl.call(onWipeReachesTop, [], 0.65)
      tl.call(() => {
        onMid()
        if (svg) gsap.to(svg, { opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: () => {
          trY[0] = 100; trY[1] = 100; renderTr(true); gsap.set(svg, { opacity: 1 })
          if (!forward) gsap.delayedCall(0.65, playHeaderFlashRay)
          onDone()
        }})
        else onDone()
      }, [], 1.64)
    }

    // ── Step transition handler ──
    const doStep = (from: S, to: S, fwd: boolean) => {
      const toursEl = document.querySelector<HTMLElement>('.tours-section')
      const stepsEl = document.querySelector<HTMLElement>('.steps-section')
      const lastSlide = document.querySelector<HTMLElement>('.last-slide-wrapper')

      if (from.t === 'hero' && to.t === 'tours') {
        playSvgWipe(true,
          () => {
            gsap.set('.tours-heading > *', { opacity: 0, y: 20 })
            moveToSection(toursEl?.offsetTop ?? 0, true) // Instant move to tours section
          },
          () => {
            gsap.to('.tours-heading > *', { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' })
            resetAllCards()
            gsap.delayedCall(0.15, () => { showGroup(0); gsap.delayedCall(0.4, () => { transitioning = false }) })
          },
          hideHeader  // fires the moment the wipe bar reaches the header bottom
        )
      } else if (from.t === 'tours' && to.t === 'hero') {
        playSvgWipe(false,
          () => { moveToSection(0, true); resetAllCards() }, // Instant move to hero section
          () => { transitioning = false }
        )
      } else if (from.t === 'hero' && to.t === 'steps') {
        // No-tours path: hero jumps straight to the How-It-Works section.
        playSvgWipe(true,
          () => {
            gsap.set('.step-card', { y: 70, opacity: 0, rotateX: -18, scale: 0.94 })
            gsap.set('.step-connector', { opacity: 0, scale: 0.5 })
            gsap.set('.step-ring-arc', { strokeDashoffset: 153.9 })
            moveToSection(stepsEl?.offsetTop ?? 0, true)
          },
          () => {
            gsap.to('.step-card', { y: 0, opacity: 1, rotateX: 0, scale: 1, transformPerspective: 800, stagger: 0.14, duration: 0.75, ease: 'back.out(1.4)' })
            gsap.to('.step-connector', { opacity: 1, scale: 1, stagger: 0.14, duration: 0.5, ease: 'back.out(1.7)', delay: 0.3 })
            gsap.to('.step-ring-arc', { strokeDashoffset: 0, stagger: 0.18, duration: 1.3, ease: 'power3.out', delay: 0.45 })
            gsap.delayedCall(0.4, () => { transitioning = false })
          },
          hideHeader
        )
      } else if (from.t === 'steps' && to.t === 'hero') {
        // No-tours path: How-It-Works wipes back to hero in one step.
        playSvgWipe(false,
          () => { moveToSection(0, true) },
          () => { transitioning = false }
        )
      } else if (from.t === 'tours' && to.t === 'tours') {
        const fromGi = (from as { t: 'tours'; gi: number }).gi
        const toGi   = (to   as { t: 'tours'; gi: number }).gi
        hideGroup(fromGi, fwd)
        showGroup(toGi, fwd) // showGroup handles its own stagger
        gsap.delayedCall(0.5, () => { transitioning = false })
      } else if (from.t === 'tours' && to.t === 'steps') {
        gsap.set('.step-card', { y: 70, opacity: 0, rotateX: -18, scale: 0.94 })
        gsap.set('.step-connector', { opacity: 0, scale: 0.5 })
        gsap.set('.step-ring-arc', { strokeDashoffset: 153.9 })
        moveToSection(stepsEl?.offsetTop ?? 0, false, () => {
          gsap.to('.step-card', { y: 0, opacity: 1, rotateX: 0, scale: 1, transformPerspective: 800, stagger: 0.14, duration: 0.75, ease: 'back.out(1.4)' })
          gsap.to('.step-connector', { opacity: 1, scale: 1, stagger: 0.14, duration: 0.5, ease: 'back.out(1.7)', delay: 0.3 })
          gsap.to('.step-ring-arc', { strokeDashoffset: 0, stagger: 0.18, duration: 1.3, ease: 'power3.out', delay: 0.45 })
          gsap.delayedCall(0.4, () => { transitioning = false })
        })
      } else if (from.t === 'steps' && to.t === 'tours') {
        hideHeader()
        gsap.to('.step-card', { y: 30, opacity: 0, stagger: 0.06, duration: 0.3, ease: 'power2.in' })
        const groups = getGroups()
        gsap.delayedCall(0.25, () => {
          gsap.set('.tours-heading > *', { opacity: 0, y: 20 })
          // Hide all tour cards before sliding back to tours so we never
          // see a card already parked at x:0 during the section transition.
          resetAllCards()
          moveToSection(toursEl?.offsetTop ?? 0, false, () => {
            gsap.to('.tours-heading > *', { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' })
            showGroup(groups.length - 1, false) // showGroup handles its own stagger
            gsap.delayedCall(0.5, () => { transitioning = false })
          })
        })
      } else if (from.t === 'steps' && to.t === 'cta') {
        // Reset all CTA reveal targets so the entrance choreography replays on every arrival
        gsap.set('.cta-item', { y: 40, opacity: 0 })
        gsap.set('.cta-diag-line', { scaleY: 0, transformOrigin: '50% 50%' })
        gsap.set('.cta-edge-line', { scaleX: 0, transformOrigin: '50% 50%' })
        gsap.set('.cta-glow-orb', { scale: 0.55, opacity: 0 })
        gsap.set('.cta-dot-grid', { opacity: 0 })
        const shine = document.querySelector<HTMLElement>('[data-cta-shine]')
        if (shine) { gsap.killTweensOf(shine); gsap.set(shine, { xPercent: -130 }) }
        moveToSection(lastSlide?.offsetTop ?? 0, false, () => {
          const tl = gsap.timeline()
          tl.to('.cta-edge-line',  { scaleX: 1, duration: 0.85, ease: 'power3.out' }, 0)
            .to('.cta-diag-line',  { scaleY: 1, stagger: 0.08, duration: 0.85, ease: 'power3.out' }, 0.08)
            .to('.cta-dot-grid',   { opacity: 0.05, duration: 0.7, ease: 'power2.out' }, 0.1)
            .to('.cta-glow-orb',   {
              scale: 1, opacity: 1, duration: 1, ease: 'power3.out',
              onComplete: () => {
                // Ambient breathing — kill any leftover tweens then start a fresh infinite yoyo
                gsap.killTweensOf('.cta-glow-orb')
                gsap.to('.cta-glow-orb', { scale: 1.08, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1 })
              },
            }, 0.2)
            .to('.cta-item',       { y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'power2.out' }, 0.35)
          if (shine) tl.to(shine, { xPercent: 130, duration: 1.05, ease: 'power2.inOut' }, 0.9)
          gsap.delayedCall(1.0, () => { transitioning = false })
        })
      } else if (from.t === 'cta' && to.t === 'steps') {
        // Stop CTA ambient loops so they don't keep running off-screen
        gsap.killTweensOf('.cta-glow-orb')
        const shine = document.querySelector<HTMLElement>('[data-cta-shine]')
        if (shine) gsap.killTweensOf(shine)
        gsap.set('.step-card', { y: -50, opacity: 0, rotateX: 14, scale: 0.94 })
        gsap.set('.step-connector', { opacity: 0, scale: 0.5 })
        gsap.set('.step-ring-arc', { strokeDashoffset: 153.9 })
        moveToSection(stepsEl?.offsetTop ?? 0, false, () => {
          gsap.to('.step-card', { y: 0, opacity: 1, rotateX: 0, scale: 1, transformPerspective: 800, stagger: 0.1, duration: 0.6, ease: 'back.out(1.3)' })
          gsap.to('.step-connector', { opacity: 1, scale: 1, stagger: 0.1, duration: 0.4, ease: 'back.out(1.7)', delay: 0.25 })
          gsap.to('.step-ring-arc', { strokeDashoffset: 0, stagger: 0.15, duration: 1.1, ease: 'power3.out', delay: 0.3 })
          gsap.delayedCall(0.35, () => { transitioning = false })
        })
      } else {
        transitioning = false
      }
    }

    // ── Navigate one step ──
    const navigate = (dir: 'fwd' | 'bwd') => {
      if (transitioning) return
      setExpandedTourId(null) // Reset expansion when scrolling between slides
      const steps = buildSteps()
      const nextIdx = dir === 'fwd' ? stepIdx + 1 : stepIdx - 1
      if (nextIdx < 0 || nextIdx >= steps.length) return
      const from = steps[stepIdx]
      const to   = steps[nextIdx]
      stepIdx = nextIdx
      transitioning = true
      doStep(from as S, to as S, dir === 'fwd')
    }

    // ── Input: wheel — one gesture = one step ──
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY > 2) navigate('fwd')
      else if (e.deltaY < -2) navigate('bwd')
    }

    // ── Input: touch ──
    let touchStartY = 0
    const handleTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY }
    const handleTouchEnd = (e: TouchEvent) => {
      const dy = touchStartY - e.changedTouches[0].clientY
      if (dy > 30) navigate('fwd')
      else if (dy < -30) navigate('bwd')
      else if (!isInteractiveTarget(e.target)) showHeaderTemporarily()
    }
    const handleClick = (e: MouseEvent) => {
      if (!isInteractiveTarget(e.target)) showHeaderTemporarily()
    }

    // Remove any stale handlers before attaching fresh ones.
    const stale = window.__homeScrollGuards
    if (stale) {
      if (stale.wheel) window.removeEventListener('wheel', stale.wheel)
      if (stale.touchstart) window.removeEventListener('touchstart', stale.touchstart)
      if (stale.touchend) window.removeEventListener('touchend', stale.touchend)
      if (stale.click) window.removeEventListener('click', stale.click)
      const staleTarget = stale.target as (EventTarget & {
        removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void
      }) | null | undefined
      if (staleTarget?.removeEventListener) {
        if (stale.wheel) staleTarget.removeEventListener('wheel', stale.wheel as EventListener)
        if (stale.touchstart) staleTarget.removeEventListener('touchstart', stale.touchstart as EventListener)
        if (stale.touchend) staleTarget.removeEventListener('touchend', stale.touchend as EventListener)
        if (stale.click) staleTarget.removeEventListener('click', stale.click as EventListener)
      }
    }

    if (mainEl) {
      mainEl.addEventListener('wheel', handleWheel, { passive: false })
      mainEl.addEventListener('touchstart', handleTouchStart, { passive: true })
      mainEl.addEventListener('touchend', handleTouchEnd, { passive: true })
      mainEl.addEventListener('click', handleClick, { passive: true })
    }
    window.__homeScrollGuards = {
      target: mainEl ?? null,
      wheel: handleWheel,
      touchstart: handleTouchStart,
      touchend: handleTouchEnd,
      click: handleClick,
    }
    const onMenuClosed = () => showHeaderTemporarily()

    if (header) {
      header.addEventListener('mouseenter', handleHeaderMouseEnter)
      header.addEventListener('mouseleave', handleHeaderMouseLeave)
      // Forward wheel events from the fixed header (outside mainEl) into the same handler
      header.addEventListener('wheel', handleWheel, { passive: false })
    }
    document.addEventListener('header:menu-closed', onMenuClosed)

    return () => {
      if (mainEl) {
        mainEl.removeEventListener('wheel', handleWheel)
        mainEl.removeEventListener('touchstart', handleTouchStart)
        mainEl.removeEventListener('touchend', handleTouchEnd)
        mainEl.removeEventListener('click', handleClick)
      }
      if (window.__homeScrollGuards?.wheel === handleWheel) {
        delete window.__homeScrollGuards
      }
      if (header) {
        header.removeEventListener('mouseenter', handleHeaderMouseEnter)
        header.removeEventListener('mouseleave', handleHeaderMouseLeave)
        header.removeEventListener('wheel', handleWheel)
      }
      document.removeEventListener('header:menu-closed', onMenuClosed)
      if (headerAutoHideTimer) clearTimeout(headerAutoHideTimer)
      if (header) gsap.set(header, { opacity: 1, yPercent: 0 })
      if (mainEl) gsap.set(mainEl, { y: 0 })
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  // ── Hero radar rings + 3D phone parallax ──
  useEffect(() => {
    const hero = document.querySelector('.hero-section') as HTMLElement | null
    if (!hero) return

    // Each ring expands from r=8 → r=310, fading out, staggered so they pulse continuously
    const ringEls = Array.from(document.querySelectorAll<SVGCircleElement>('.radar-ring'))
    const D = 5       // seconds per full ring expansion
    const N = ringEls.length
    const speedProxy = { v: 1 }

    const tweens = ringEls.map((ring, i) => {
      const t = gsap.fromTo(
        ring,
        { attr: { r: 8 }, opacity: 0.55 },
        { attr: { r: 310 }, opacity: 0, duration: D, ease: 'power1.out', repeat: -1 }
      )
      // Seek each ring to its phase offset so they're already staggered on load
      t.seek(i * (D / N))
      return t
    })

    // Smoothly animates all ring timeScales together via a proxy value
    const setSpeed = (target: number, dur: number, ease: string) => {
      gsap.to(speedProxy, {
        v: target, duration: dur, ease,
        onUpdate() { tweens.forEach(t => t.timeScale(speedProxy.v)) },
      })
    }

    let settleTimer: ReturnType<typeof setTimeout>
    let lastX = -9999
    let lastY = -9999

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (dx * dx + dy * dy < 75 * 75) return   // ignore movements shorter than 75px
      lastX = e.clientX
      lastY = e.clientY

      const rect = hero.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      gsap.to('.hero-img-main', { rotateY: -8 + x * -12, rotateX: 2 + y * 7, duration: 0.75, ease: 'power2.out' })
      // Speed up rings while mouse is moving, ease back to calm when it stops
      setSpeed(4.5, 0.25, 'power2.out')
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => setSpeed(1, 0.8, 'power2.inOut'), 120)
    }

    const onLeave = () => {
      clearTimeout(settleTimer)
      setSpeed(1, 0.8, 'power1.inOut')
    }

    hero.addEventListener('mousemove', onMove)
    hero.addEventListener('mouseleave', onLeave)
    return () => {
      hero.removeEventListener('mousemove', onMove)
      hero.removeEventListener('mouseleave', onLeave)
      clearTimeout(settleTimer)
      tweens.forEach(t => t.kill())
    }
  }, [])

  // ── Tour card setup for scroll-jacked reveal + 3D tilt ──
  useEffect(() => {
    if (loadingTours || featuredTours.length === 0) return
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.tour-card'))
    cardsRef.current = cards
    const mouseCleanup: Array<() => void> = []

    cards.forEach((card) => {
      const heading = card.querySelector<HTMLElement>('h3')
      const desc = card.querySelector<HTMLElement>('p')
      const meta = card.querySelector<HTMLElement>('.flex.items-center.justify-between')

      // Position all cards off-screen to the right (carousel mode)
      gsap.set(card, { x: window.innerWidth, opacity: 0, pointerEvents: 'none' })
      if (heading) gsap.set(heading, { opacity: 1 })
      if (desc)    gsap.set(desc,    { opacity: 1 })
      if (meta)    gsap.set(meta,    { opacity: 1 })

      // Desktop 3D tilt on hover
      const onMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        gsap.to(card, { rotateY: x * 7, rotateX: -y * 5, transformPerspective: 900, duration: 0.35, ease: 'power2.out' })
      }
      const onLeave = () => gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.6, ease: 'power2.out' })
      card.addEventListener('mousemove', onMove)
      card.addEventListener('mouseleave', onLeave)
      mouseCleanup.push(() => {
        card.removeEventListener('mousemove', onMove)
        card.removeEventListener('mouseleave', onLeave)
      })
    })

    return () => mouseCleanup.forEach(fn => fn())
  }, [loadingTours, featuredTours])

  useEffect(() => {
    const stepCards = Array.from(document.querySelectorAll<HTMLElement>('.step-card'))
    const cleanup: (() => void)[] = []
    stepCards.forEach(card => {
      const numEl = card.querySelector<HTMLElement>('.step-big-num')

      // 3D tilt + number brightness on hover
      const onMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        gsap.to(card, { rotateY: x * 10, rotateX: -y * 8, transformPerspective: 700, duration: 0.35, ease: 'power2.out' })
      }
      const onEnter = () => {
        if (numEl) gsap.to(numEl, { opacity: 0.85, filter: 'drop-shadow(0 0 18px rgba(255,218,0,0.75))', duration: 0.35, ease: 'power2.out' })
      }
      const onLeave = () => {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.7, ease: 'power2.out' })
        if (numEl) gsap.to(numEl, { opacity: 0.22, filter: 'drop-shadow(0 0 0px rgba(255,218,0,0))', duration: 0.5, ease: 'power2.out' })
      }

      // Click: press-down + card ripple + background shockwave
      const onPointerDown = (e: PointerEvent) => {
        gsap.killTweensOf(card, 'scale')
        gsap.to(card, { scale: 0.94, duration: 0.1, ease: 'power2.in', transformPerspective: 700 })

        // Bright flash on the number
        if (numEl) {
          gsap.killTweensOf(numEl)
          gsap.to(numEl, { opacity: 1, filter: 'drop-shadow(0 0 30px rgba(255,218,0,1))', duration: 0.07, ease: 'power3.in',
            onComplete: () => gsap.to(numEl, { opacity: 0.85, filter: 'drop-shadow(0 0 18px rgba(255,218,0,0.75))', duration: 0.45, ease: 'power2.out' }) })
        }

        // Card ripple
        const rect = card.getBoundingClientRect()
        const rx = e.clientX - rect.left
        const ry = e.clientY - rect.top
        const ripple = document.createElement('div')
        ripple.style.cssText = `position:absolute;left:${rx}px;top:${ry}px;width:0;height:0;border-radius:50%;pointer-events:none;z-index:30;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,218,0,0.38) 0%,transparent 70%)`
        card.style.overflow = 'hidden'
        card.appendChild(ripple)
        gsap.to(ripple, { width: 440, height: 440, opacity: 0, duration: 0.65, ease: 'power2.out', onComplete: () => ripple.remove() })

        // Section-wide shockwave ring
        const section = document.querySelector<HTMLElement>('.steps-section')
        if (section) {
          const sr = section.getBoundingClientRect()
          const sx = e.clientX - sr.left
          const sy = e.clientY - sr.top

          // Expanding ring
          const ring = document.createElement('div')
          ring.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;width:0;height:0;border-radius:50%;border:1.5px solid rgba(255,218,0,0.4);transform:translate(-50%,-50%);pointer-events:none;z-index:4`
          section.appendChild(ring)
          gsap.to(ring, { width: 1400, height: 1400, opacity: 0, duration: 1.4, ease: 'power2.out', onComplete: () => ring.remove() })

          // Secondary softer glow bloom
          const bloom = document.createElement('div')
          bloom.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;width:0;height:0;border-radius:50%;background:radial-gradient(circle,rgba(255,218,0,0.1) 0%,transparent 60%);transform:translate(-50%,-50%);pointer-events:none;z-index:4`
          section.appendChild(bloom)
          gsap.to(bloom, { width: 700, height: 700, opacity: 0, duration: 0.9, ease: 'power3.out', onComplete: () => bloom.remove() })
        }
      }
      const onPointerUp = () => gsap.to(card, { scale: 1, duration: 0.55, ease: 'elastic.out(1.1, 0.45)' })

      card.addEventListener('mousemove', onMove)
      card.addEventListener('mouseenter', onEnter)
      card.addEventListener('mouseleave', onLeave)
      card.addEventListener('pointerdown', onPointerDown)
      card.addEventListener('pointerup', onPointerUp)
      card.addEventListener('pointerleave', onPointerUp)
      cleanup.push(() => {
        card.removeEventListener('mousemove', onMove)
        card.removeEventListener('mouseenter', onEnter)
        card.removeEventListener('mouseleave', onLeave)
        card.removeEventListener('pointerdown', onPointerDown)
        card.removeEventListener('pointerup', onPointerUp)
        card.removeEventListener('pointerleave', onPointerUp)
      })
    })
    return () => cleanup.forEach(fn => fn())
  }, [])

  // ── CTA button 3D tilt on hover + press feedback ──
  useEffect(() => {
    const btns = Array.from(document.querySelectorAll<HTMLElement>('.cta-btn'))
    const cleanup: Array<() => void> = []
    btns.forEach((btn) => {
      const onMove = (e: MouseEvent) => {
        const rect = btn.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        gsap.to(btn, { rotateY: x * 9, rotateX: -y * 7, transformPerspective: 700, duration: 0.35, ease: 'power2.out' })
      }
      const onLeave = () => gsap.to(btn, { rotateY: 0, rotateX: 0, scale: 1, duration: 0.55, ease: 'power2.out' })
      const onDown = () => gsap.to(btn, { scale: 0.96, duration: 0.1, ease: 'power2.in' })
      const onUp   = () => gsap.to(btn, { scale: 1, duration: 0.45, ease: 'elastic.out(1.1, 0.5)' })
      btn.addEventListener('mousemove', onMove)
      btn.addEventListener('mouseleave', onLeave)
      btn.addEventListener('pointerdown', onDown)
      btn.addEventListener('pointerup', onUp)
      btn.addEventListener('pointerleave', onUp)
      cleanup.push(() => {
        btn.removeEventListener('mousemove', onMove)
        btn.removeEventListener('mouseleave', onLeave)
        btn.removeEventListener('pointerdown', onDown)
        btn.removeEventListener('pointerup', onUp)
        btn.removeEventListener('pointerleave', onUp)
      })
    })
    return () => cleanup.forEach(fn => fn())
  }, [])

  const playBookAnim = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const overlay = card.querySelector<HTMLElement>('.bk-anim-overlay')
    const content = card.querySelector<HTMLElement>('.bk-card-content')
    if (!overlay || !content) return
    const svg = overlay.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    bookTlRef.current?.kill()

    const q = gsap.utils.selector(svg)

    // Reset all SVG elements
    gsap.set(overlay,             { opacity: 0, pointerEvents: 'none' })
    gsap.set(q('.bk-phone'),      { strokeDashoffset: 435 })
    gsap.set(q('.bk-notch'),      { opacity: 0 })
    gsap.set(q('.bk-spk'),        { opacity: 0 })
    gsap.set(q('.bk-home'),       { opacity: 0 })
    gsap.set(q('.bk-screen'),     { opacity: 0 })
    gsap.set(q('.bk-title'),      { opacity: 0 })
    gsap.set(q('.bk-from-pin'),   { opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-from'),       { strokeDashoffset: 60 })
    gsap.set(q('.bk-route'),      { opacity: 0 })
    gsap.set(q('.bk-to-pin'),     { opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-to'),         { strokeDashoffset: 60 })
    gsap.set(q('.bk-date'),       { opacity: 0, scale: 0.7, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-time'),       { opacity: 0, scale: 0.7, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-vt'),         { opacity: 0, scale: 0.7, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-vt-car'),     { opacity: 0 })
    gsap.set(q('.bk-vt-line'),    { opacity: 0 })
    gsap.set(q('.bk-price'),      { opacity: 0, y: 8 })
    gsap.set(q('.bk-btn'),        { opacity: 0, scale: 0.7, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-btntxt'),     { opacity: 0 })
    gsap.set(q('.bk-tap'),        { opacity: 0, scale: 1, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-load'),       { opacity: 0, scale: 1, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-conn'),       { strokeDashoffset: 64 })
    gsap.set(q('.bk-minicar'),    { x: 94, y: 78, opacity: 0 })
    gsap.set(q('.bk-confcard'),   { strokeDashoffset: 440 })
    gsap.set(q('.bk-confbar'),    { scaleX: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-booked'),     { opacity: 0, y: 8 })
    gsap.set(q('.bk-ring'),       { opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.bk-check'),      { strokeDashoffset: 60 })
    gsap.set(q('.bk-ref'),        { opacity: 0 })
    gsap.set(q('.bk-dot'),        { x: 0, y: 0, opacity: 0, scale: 1 })

    const tl = gsap.timeline()
    bookTlRef.current = tl

    tl
      // 0. Fade card content
      .to(content, { opacity: 0, scale: 0.93, duration: 0.28, ease: 'power2.in' })
      .set(overlay, { pointerEvents: 'auto' })
      .to(overlay, { opacity: 1, duration: 0.25, ease: 'power2.out' })
      // 1. Phone hardware
      .to(q('.bk-phone'),  { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' })
      .to(q('.bk-screen'), { opacity: 1, duration: 0.2 }, '-=0.18')
      .to(q('.bk-notch'),  { opacity: 1, duration: 0.15 }, '-=0.15')
      .to(q('.bk-spk'),    { opacity: 1, duration: 0.1 }, '-=0.1')
      .to(q('.bk-home'),   { opacity: 0.6, duration: 0.1 }, '-=0.08')
      // 2. App title
      .to(q('.bk-title'),  { opacity: 1, duration: 0.2 }, '-=0.05')
      // 3. From & To with pins (route)
      .to(q('.bk-from-pin'), { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2.2)' })
      .to(q('.bk-from'),     { strokeDashoffset: 0, duration: 0.28, ease: 'power2.out' }, '-=0.1')
      .to(q('.bk-route'),    { opacity: 1, duration: 0.18 }, '-=0.12')
      .to(q('.bk-to-pin'),   { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2.2)' }, '-=0.06')
      .to(q('.bk-to'),       { strokeDashoffset: 0, duration: 0.28, ease: 'power2.out' }, '-=0.1')
      // 4. Date + Time + Vehicle
      .to(q('.bk-date'), { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(1.7)' })
      .to(q('.bk-time'), { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(1.7)' }, '-=0.14')
      .to(q('.bk-vt'),   { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(1.7)' }, '-=0.08')
      .to(q('.bk-vt-car'),  { opacity: 1, duration: 0.12 }, '-=0.1')
      .to(q('.bk-vt-line'), { opacity: 1, duration: 0.12 }, '-=0.08')
      // 5. Price reveal
      .to(q('.bk-price'), { opacity: 1, y: 0, duration: 0.28, ease: 'back.out(2)' })
      // 6. Book button + tap
      .to(q('.bk-btn'),    { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2.3)' })
      .to(q('.bk-btntxt'), { opacity: 1, duration: 0.15 }, '-=0.12')
      .to(q('.bk-tap'),    { opacity: 0.9, duration: 0.08 })
      .to(q('.bk-tap'),    { scale: 0.45, duration: 0.13, ease: 'power2.in' })
      .to(q('.bk-btn'),    { fill: 'rgba(255,218,0,0.55)', duration: 0.1 }, '-=0.05')
      .to(q('.bk-tap'),    { scale: 2.4, opacity: 0, duration: 0.32, ease: 'power2.out' })
      .to(q('.bk-btn'),    { fill: 'rgba(255,218,0,0.15)', duration: 0.28 }, '-=0.25')
      // 7. Loading dots + connection
      .to(q('.bk-load'), { opacity: 1, stagger: 0.08, duration: 0.1 }, '-=0.15')
      .to(q('.bk-load'), { scale: 1.5, opacity: 0.5, stagger: 0.08, duration: 0.22, repeat: 1, yoyo: true, ease: 'sine.inOut' })
      .to(q('.bk-conn'), { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut' }, '-=0.5')
      // 8. Mini-car drives across the signal line
      .to(q('.bk-minicar'), { opacity: 1, duration: 0.1 }, '-=0.55')
      .to(q('.bk-minicar'), { x: 158, duration: 0.55, ease: 'power2.inOut' }, '-=0.5')
      .to(q('.bk-minicar'), { opacity: 0, duration: 0.15 }, '-=0.05')
      .to(q('.bk-load'),    { opacity: 0, duration: 0.2 }, '-=0.15')
      // 9. Confirmation card materializes
      .to(q('.bk-confcard'), { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, '-=0.35')
      .to(q('.bk-confbar'),  { scaleX: 1, duration: 0.35, ease: 'power2.out' }, '-=0.3')
      .to(q('.bk-booked'),   { opacity: 1, y: 0, duration: 0.28, ease: 'back.out(2)' }, '-=0.18')
      // 10. Glow ring blooms + check draws
      .to(q('.bk-ring'),  { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)' }, '-=0.08')
      .to(q('.bk-check'), { strokeDashoffset: 0, duration: 0.45, ease: 'power3.out' }, '-=0.15')
      .to(q('.bk-ref'),   { opacity: 1, duration: 0.25 }, '-=0.15')
      // 11. Particles diffuse
      .to(q('.bk-dot'), { opacity: 1, stagger: 0.03, duration: 0.06 })
      .to(q('.bk-dot'), {
        x: (i: number) => Math.cos((i / 10) * Math.PI * 2) * 34,
        y: (i: number) => Math.sin((i / 10) * Math.PI * 2) * 34,
        opacity: 0, scale: 0.3, stagger: 0.03, duration: 0.65, ease: 'power2.out',
      }, '-=0.05')
      // 12. Hold + restore content
      .to(overlay,  { opacity: 0, duration: 0.35, ease: 'power2.in' }, '+=0.35')
      .set(overlay, { pointerEvents: 'none' })
      .to(content,  { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' })
      .set(content, { clearProps: 'scale' })
  }

  // ── Step 02: "We Confirm" — booking receipt unfolds, driver/price revealed, stamp slams down ──
  const playConfirmAnim = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const overlay = card.querySelector<HTMLElement>('.cf-anim-overlay')
    const content = card.querySelector<HTMLElement>('.cf-card-content')
    if (!overlay || !content) return
    const svg = overlay.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    confirmTlRef.current?.kill()
    const q = gsap.utils.selector(svg)

    // Reset
    gsap.set(overlay,             { opacity: 0, pointerEvents: 'none' })
    gsap.set(q('.cf-card'),       { strokeDashoffset: 600, scaleY: 0.02, transformOrigin: '50% 50%' })
    gsap.set(q('.cf-headbar'),    { scaleX: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.cf-label'),      { opacity: 0, y: 6 })
    gsap.set(q('.cf-div1'),       { strokeDashoffset: 150 })
    gsap.set(q('.cf-avatar'),     { opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.cf-head'),       { opacity: 0 })
    gsap.set(q('.cf-body'),       { opacity: 0 })
    gsap.set(q('.cf-name'),       { strokeDashoffset: 80 })
    gsap.set(q('.cf-star'),       { opacity: 0, scale: 0 })
    gsap.set(q('.cf-div2'),       { strokeDashoffset: 150 })
    gsap.set(q('.cf-car-info'),   { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' })
    gsap.set(q('.cf-vehicle'),    { strokeDashoffset: 82 })
    gsap.set(q('.cf-rupee'),      { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' })
    gsap.set(q('.cf-amount'),     { strokeDashoffset: 82 })
    gsap.set(q('.cf-hint'),       { opacity: 0 })
    gsap.set(q('.cf-stamp'),      { x: 215, y: 50, opacity: 0, scale: 2.6, rotation: -25, transformOrigin: '50% 50%' })
    gsap.set(q('.cf-stamp-ring'), { strokeDashoffset: 188 })
    gsap.set(q('.cf-stamp-chk'),  { strokeDashoffset: 40 })
    gsap.set(q('.cf-stamp-txt'),  { opacity: 0 })
    gsap.set(q('.cf-dot'),        { x: 0, y: 0, opacity: 0, scale: 1 })

    const tl = gsap.timeline()
    confirmTlRef.current = tl
    tl
      // 0. Fade content + show overlay
      .to(content,  { opacity: 0, scale: 0.93, duration: 0.28, ease: 'power2.in' })
      .set(overlay, { pointerEvents: 'auto' })
      .to(overlay,  { opacity: 1, duration: 0.25, ease: 'power2.out' })
      // 1. Receipt unfolds (scaleY then outline draws)
      .to(q('.cf-card'), { scaleY: 1, duration: 0.45, ease: 'power3.out' })
      .to(q('.cf-card'), { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, '-=0.25')
      .to(q('.cf-headbar'), { scaleX: 1, duration: 0.35, ease: 'power2.out' }, '-=0.4')
      // 2. "CONFIRMED" label
      .to(q('.cf-label'), { opacity: 1, y: 0, duration: 0.28, ease: 'back.out(2)' }, '-=0.2')
      // 3. Top divider wipes
      .to(q('.cf-div1'), { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' }, '-=0.1')
      // 4. Driver avatar + silhouette
      .to(q('.cf-avatar'), { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' })
      .to(q('.cf-head'),   { opacity: 1, duration: 0.18 }, '-=0.15')
      .to(q('.cf-body'),   { opacity: 1, duration: 0.18 }, '-=0.12')
      // 5. Driver name line wipes
      .to(q('.cf-name'), { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, '-=0.18')
      // 6. 5 stars pop in
      .to(q('.cf-star'), { opacity: 1, scale: 1, stagger: 0.08, duration: 0.25, ease: 'back.out(2.5)' }, '-=0.15')
      // 7. Lower divider
      .to(q('.cf-div2'), { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' }, '-=0.1')
      // 8. Vehicle row (car icon + line)
      .to(q('.cf-car-info'), { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' })
      .to(q('.cf-vehicle'),  { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, '-=0.12')
      // 9. Price row
      .to(q('.cf-rupee'), { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2.2)' }, '-=0.15')
      .to(q('.cf-amount'), { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, '-=0.15')
      .to(q('.cf-hint'), { opacity: 1, duration: 0.25 }, '-=0.1')
      // 10. Stamp rotates in and slams down
      .to(q('.cf-stamp'), { opacity: 1, scale: 1, rotation: 8, duration: 0.4, ease: 'power3.in' }, '+=0.15')
      .to(q('.cf-stamp'), { scale: 1.08, duration: 0.08, ease: 'power2.out' })
      .to(q('.cf-stamp'), { scale: 1, duration: 0.18, ease: 'elastic.out(1, 0.4)' })
      // 11. Stamp ring traces + check draws + label appears
      .to(q('.cf-stamp-ring'), { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, '-=0.18')
      .to(q('.cf-stamp-chk'),  { strokeDashoffset: 0, duration: 0.35, ease: 'power3.out' }, '-=0.25')
      .to(q('.cf-stamp-txt'),  { opacity: 1, duration: 0.25 }, '-=0.15')
      // 12. Particle burst from stamp
      .to(q('.cf-dot'), { opacity: 1, stagger: 0.03, duration: 0.06 }, '-=0.1')
      .to(q('.cf-dot'), {
        x: (i: number) => Math.cos((i / 10) * Math.PI * 2) * 38,
        y: (i: number) => Math.sin((i / 10) * Math.PI * 2) * 38,
        opacity: 0, scale: 0.3, stagger: 0.03, duration: 0.65, ease: 'power2.out',
      }, '-=0.05')
      // 13. Hold + restore
      .to(overlay,  { opacity: 0, duration: 0.35, ease: 'power2.in' }, '+=0.35')
      .set(overlay, { pointerEvents: 'none' })
      .to(content,  { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' })
      .set(content, { clearProps: 'scale' })
  }

  // ── Step 03: "We Pick You Up" — airport, plane, road, pin with passenger, car arrives on time ──
  const playPickupAnim = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const overlay = card.querySelector<HTMLElement>('.pu-anim-overlay')
    const content = card.querySelector<HTMLElement>('.pu-card-content')
    if (!overlay || !content) return
    const svg = overlay.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    pickupTlRef.current?.kill()
    const q = gsap.utils.selector(svg)

    // Reset
    gsap.set(overlay,            { opacity: 0, pointerEvents: 'none' })
    gsap.set(q('.pu-airport'),   { opacity: 0, y: -6 })
    gsap.set(q('.pu-rwy'),       { opacity: 0 })
    gsap.set(q('.pu-iata'),      { opacity: 0 })
    gsap.set(q('.pu-plane'),     { x: -30, y: 20, opacity: 0 })
    gsap.set(q('.pu-trail'),     { opacity: 0 })
    gsap.set(q('.pu-road'),      { strokeDashoffset: 270 })
    gsap.set(q('.pu-pin'),       { strokeDashoffset: 225 })
    gsap.set(q('.pu-inner'),     { opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.pu-phead'),     { opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.pu-pbody'),     { opacity: 0 })
    gsap.set(q('.pu-clock'),     { x: 245, y: 80, opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.pu-hour'),      { rotation: -90, transformOrigin: '50% 100%' })
    gsap.set(q('.pu-min'),       { rotation: -90, transformOrigin: '50% 100%' })
    gsap.set(q('.pu-ontime'),    { opacity: 0, y: -4 })
    gsap.set(q('.pu-car'),       { x: 175, opacity: 0 })
    gsap.set(q('.pu-headlight'), { opacity: 0 })
    gsap.set(q('.pu-beam'),      { opacity: 0 })
    gsap.set(q('.pu-speed'),     { opacity: 0, x: 0 })
    gsap.set(q('.pu-puff'),      { opacity: 0, x: 0 })
    gsap.set(q('.pu-glow'),      { opacity: 0, scale: 0, transformOrigin: '50% 50%' })
    gsap.set(q('.pu-dot'),       { x: 0, y: 0, opacity: 0, scale: 1 })

    const tl = gsap.timeline()
    pickupTlRef.current = tl
    tl
      // 0. Fade + overlay
      .to(content,  { opacity: 0, scale: 0.93, duration: 0.28, ease: 'power2.in' })
      .set(overlay, { pointerEvents: 'auto' })
      .to(overlay,  { opacity: 1, duration: 0.25, ease: 'power2.out' })
      // 1. Airport hangar + runway
      .to(q('.pu-airport'), { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.8)' })
      .to(q('.pu-rwy'),     { opacity: 1, duration: 0.25 }, '-=0.18')
      .to(q('.pu-iata'),    { opacity: 1, duration: 0.25 }, '-=0.15')
      // 2. Plane flies across top with trail
      .to(q('.pu-plane'),   { opacity: 1, duration: 0.12 })
      .to(q('.pu-trail'),   { opacity: 0.4, duration: 0.12 }, '-=0.1')
      .to(q('.pu-plane'),   { x: 300, duration: 1.1, ease: 'power1.inOut' }, '-=0.08')
      .to(q('.pu-trail'),   { opacity: 0, duration: 0.3, ease: 'power2.out' }, '-=0.4')
      .to(q('.pu-plane'),   { opacity: 0, duration: 0.2 }, '-=0.25')
      // 3. Road draws in (parallel with later plane stages)
      .to(q('.pu-road'), { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, '-=0.85')
      // 4. Pin draws + inner glow + passenger
      .to(q('.pu-pin'),   { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut' }, '-=0.5')
      .to(q('.pu-inner'), { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2)' }, '-=0.18')
      .to(q('.pu-phead'), { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(2.2)' }, '-=0.12')
      .to(q('.pu-pbody'), { opacity: 1, duration: 0.2 }, '-=0.12')
      // 5. Clock blooms + hands rotate to "on time" position
      .to(q('.pu-clock'), { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)' }, '-=0.2')
      .to(q('.pu-hour'),  { rotation: 30,  duration: 0.55, ease: 'power2.out' }, '-=0.25')
      .to(q('.pu-min'),   { rotation: 270, duration: 0.55, ease: 'power2.out' }, '-=0.55')
      .to(q('.pu-ontime'), { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, '-=0.15')
      // 6. Speed lines + car drives in from right
      .to(q('.pu-speed'),  { opacity: 1, duration: 0.1 }, '+=0.05')
      .to(q('.pu-speed'),  { x: -55, stagger: 0.04, duration: 0.6, ease: 'power1.out' }, '-=0.05')
      .to(q('.pu-car'),    { opacity: 1, duration: 0.12 }, '-=0.6')
      .to(q('.pu-car'),    { x: 0, duration: 0.85, ease: 'power3.out' }, '-=0.55')
      .to(q('.pu-speed'),  { opacity: 0, duration: 0.25 }, '-=0.3')
      // 7. Car arrival bounce + headlight + beam
      .to(q('.pu-car'),    { x: -7, duration: 0.13, ease: 'power2.out' })
      .to(q('.pu-car'),    { x: 0,  duration: 0.22, ease: 'elastic.out(1, 0.45)' })
      .to(q('.pu-headlight'), { opacity: 1, duration: 0.15, ease: 'power2.out' }, '-=0.2')
      .to(q('.pu-beam'),      { opacity: 1, duration: 0.2 }, '-=0.15')
      // 8. Exhaust puffs
      .to(q('.pu-puff'), { opacity: 0.7, x: -6, stagger: 0.06, duration: 0.3, ease: 'power2.out' }, '-=0.3')
      .to(q('.pu-puff'), { opacity: 0,   x: -22, stagger: 0.06, duration: 0.45, ease: 'power2.in' }, '-=0.1')
      // 9. Arrival glow blooms
      .to(q('.pu-glow'), { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, '-=0.35')
      // 10. Particles burst
      .to(q('.pu-dot'), { opacity: 1, stagger: 0.03, duration: 0.06 }, '-=0.15')
      .to(q('.pu-dot'), {
        x: (i: number) => Math.cos((i / 10) * Math.PI * 2) * 34,
        y: (i: number) => Math.sin((i / 10) * Math.PI * 2) * 34,
        opacity: 0, scale: 0.3, stagger: 0.03, duration: 0.65, ease: 'power2.out',
      }, '-=0.05')
      // 11. Hold + restore
      .to(overlay,  { opacity: 0, duration: 0.35, ease: 'power2.in' }, '+=0.4')
      .set(overlay, { pointerEvents: 'none' })
      .to(content,  { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' })
      .set(content, { clearProps: 'scale' })
  }

  // ── Animation overlay renderers (reusable for mobile & desktop) ────────────
  const renderBookOverlay = () => (
    <div className="bk-anim-overlay absolute inset-0 flex items-center justify-center rounded-2xl"
      style={{ opacity: 0, pointerEvents: 'none', background: 'linear-gradient(160deg, rgba(12,8,5,0.97) 0%, rgba(20,14,8,0.99) 100%)' }}>
      <svg width="92%" height="84%" viewBox="0 0 260 155"
        fill="none" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <path className="bk-phone"
          d="M14,8 L82,8 Q88,8 88,14 L88,142 Q88,148 82,148 L14,148 Q8,148 8,142 L8,14 Q8,8 14,8 Z"
          stroke="#ffda00" strokeWidth="2" fill="rgba(255,218,0,0.02)"
          strokeLinejoin="round" strokeDasharray="435" strokeDashoffset="435" />
        <rect className="bk-notch" x="33" y="11" width="30" height="4.5" rx="2.2" fill="rgba(255,218,0,0.45)" />
        <line className="bk-spk" x1="42" y1="13.2" x2="54" y2="13.2" stroke="#0c0805" strokeWidth="1.3" strokeLinecap="round" />
        <line className="bk-home" x1="38" y1="144" x2="58" y2="144" stroke="#ffda00" strokeWidth="1.8" strokeLinecap="round" />
        <rect className="bk-screen" x="11" y="20" width="74" height="118" rx="2"
          fill="rgba(255,218,0,0.04)" stroke="rgba(255,218,0,0.15)" strokeWidth="0.5" />
        <text className="bk-title" x="48" y="32" textAnchor="middle"
          fill="#ffda00" fontSize="6" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.5">BOOK A RIDE</text>
        <circle className="bk-from-pin" cx="17" cy="42" r="2.5" fill="#ffda00" />
        <line className="bk-from" x1="22" y1="42" x2="82" y2="42"
          stroke="rgba(255,218,0,0.65)" strokeWidth="1.8" strokeLinecap="round"
          strokeDasharray="60" strokeDashoffset="60" />
        <line className="bk-route" x1="17" y1="46" x2="17" y2="53"
          stroke="rgba(255,218,0,0.45)" strokeWidth="1" strokeDasharray="1 1.5" />
        <circle className="bk-to-pin" cx="17" cy="56" r="2.5" fill="#ffda00" />
        <line className="bk-to" x1="22" y1="56" x2="82" y2="56"
          stroke="rgba(255,218,0,0.5)" strokeWidth="1.8" strokeLinecap="round"
          strokeDasharray="60" strokeDashoffset="60" />
        <rect className="bk-date" x="14" y="66" width="32" height="9" rx="2"
          fill="rgba(255,218,0,0.07)" stroke="rgba(255,218,0,0.35)" strokeWidth="0.6" />
        <rect className="bk-time" x="50" y="66" width="32" height="9" rx="2"
          fill="rgba(255,218,0,0.07)" stroke="rgba(255,218,0,0.35)" strokeWidth="0.6" />
        <rect className="bk-vt" x="14" y="80" width="68" height="11" rx="2.5"
          fill="rgba(255,218,0,0.08)" stroke="rgba(255,218,0,0.32)" strokeWidth="0.6" />
        <rect className="bk-vt-car" x="18" y="84" width="9" height="3.5" rx="1" fill="rgba(255,218,0,0.55)" />
        <line className="bk-vt-line" x1="32" y1="86" x2="76" y2="86" stroke="rgba(255,218,0,0.45)" strokeWidth="0.8" strokeLinecap="round" />
        <text className="bk-price" x="48" y="101" textAnchor="middle"
          fill="#ffda00" fontSize="9" fontWeight="900" fontFamily="sans-serif">₹450</text>
        <rect className="bk-btn" x="14" y="106" width="68" height="14" rx="7"
          fill="rgba(255,218,0,0.15)" stroke="#ffda00" strokeWidth="1.3" />
        <text className="bk-btntxt" x="48" y="115.5" textAnchor="middle"
          fill="#ffda00" fontSize="6.5" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.6">BOOK NOW</text>
        <circle className="bk-tap" cx="48" cy="113" r="11"
          stroke="rgba(255,218,0,0.7)" strokeWidth="1.2" fill="none" />
        <circle className="bk-load" cx="100" cy="62" r="2.4" fill="#ffda00" />
        <circle className="bk-load" cx="110" cy="62" r="2.4" fill="#ffda00" />
        <circle className="bk-load" cx="120" cy="62" r="2.4" fill="#ffda00" />
        <line className="bk-conn" x1="94" y1="78" x2="158" y2="78"
          stroke="rgba(255,218,0,0.45)" strokeWidth="1.3" strokeLinecap="round"
          strokeDasharray="64" strokeDashoffset="64" />
        <g className="bk-minicar">
          <rect x="-7" y="-3.5" width="14" height="7" rx="1.5"
            fill="rgba(255,218,0,0.55)" stroke="#ffda00" strokeWidth="0.7" />
          <rect x="-4.5" y="-5.5" width="9" height="2.5" rx="0.8" fill="rgba(255,218,0,0.7)" />
          <circle cx="-4" cy="3.5" r="1.6" fill="rgba(12,8,5,0.95)" stroke="#ffda00" strokeWidth="0.6" />
          <circle cx="4" cy="3.5" r="1.6" fill="rgba(12,8,5,0.95)" stroke="#ffda00" strokeWidth="0.6" />
        </g>
        <rect className="bk-confcard" x="162" y="20" width="92" height="125" rx="6"
          fill="rgba(255,218,0,0.05)" stroke="#ffda00" strokeWidth="1.5"
          strokeDasharray="440" strokeDashoffset="440" />
        <rect className="bk-confbar" x="162" y="20" width="92" height="5" rx="2.5" fill="#ffda00" />
        <text className="bk-booked" x="208" y="42" textAnchor="middle"
          fill="#ffda00" fontSize="10" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.8">BOOKED!</text>
        <circle className="bk-ring" cx="208" cy="86" r="32"
          stroke="rgba(255,218,0,0.15)" strokeWidth="8" />
        <circle className="bk-ring" cx="208" cy="86" r="27"
          stroke="rgba(255,218,0,0.55)" strokeWidth="1.5" />
        <path className="bk-check" d="M193,86 L204,98 L224,69"
          stroke="#ffda00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="60" strokeDashoffset="60" />
        <text className="bk-ref" x="208" y="130" textAnchor="middle"
          fill="rgba(255,218,0,0.7)" fontSize="5.5" fontWeight="800" fontFamily="sans-serif" letterSpacing="0.8">REF #TH482</text>
        {Array.from({ length: 10 }, (_, pi) => (
          <circle key={pi} className="bk-dot"
            cx={208 + Math.cos((pi / 10) * Math.PI * 2) * 7}
            cy={86  + Math.sin((pi / 10) * Math.PI * 2) * 7}
            r={pi % 2 === 0 ? 2.5 : 1.8} fill="#ffda00" />
        ))}
      </svg>
    </div>
  )

  const renderConfirmOverlay = () => (
    <div className="cf-anim-overlay absolute inset-0 flex items-center justify-center rounded-2xl"
      style={{ opacity: 0, pointerEvents: 'none', background: 'linear-gradient(160deg, rgba(12,8,5,0.97) 0%, rgba(20,14,8,0.99) 100%)' }}>
      <svg width="92%" height="84%" viewBox="0 0 280 160"
        fill="none" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <rect className="cf-card" x="55" y="20" width="170" height="120" rx="6"
          fill="rgba(255,218,0,0.04)" stroke="#ffda00" strokeWidth="1.5"
          strokeDasharray="600" strokeDashoffset="600" />
        <rect className="cf-headbar" x="55" y="20" width="170" height="5" rx="2.5" fill="#ffda00" />
        <text className="cf-label" x="140" y="42" textAnchor="middle"
          fill="#ffda00" fontSize="9" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.5">✓ CONFIRMED</text>
        <line className="cf-div1" x1="65" y1="52" x2="215" y2="52"
          stroke="rgba(255,218,0,0.3)" strokeWidth="0.8" strokeLinecap="round"
          strokeDasharray="150" strokeDashoffset="150" />
        <circle className="cf-avatar" cx="80" cy="78" r="13"
          fill="rgba(255,218,0,0.15)" stroke="#ffda00" strokeWidth="1.5" />
        <circle className="cf-head" cx="80" cy="74" r="4" fill="#ffda00" />
        <path className="cf-body" d="M71,86 Q80,80 89,86 L89,87 Q80,90 71,87 Z" fill="#ffda00" />
        <line className="cf-name" x1="100" y1="74" x2="180" y2="74"
          stroke="rgba(255,218,0,0.7)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="80" strokeDashoffset="80" />
        {[0,1,2,3,4].map(si => {
          const cx = 104 + si * 8
          const cy = 85
          const pts = Array.from({length:10},(_,k)=>{
            const a = (k * Math.PI) / 5 - Math.PI/2
            const r = k % 2 === 0 ? 3 : 1.3
            return `${(cx + Math.cos(a)*r).toFixed(2)},${(cy + Math.sin(a)*r).toFixed(2)}`
          }).join(' ')
          return <polygon key={si} className="cf-star" points={pts} fill="#ffda00" />
        })}
        <line className="cf-div2" x1="65" y1="103" x2="215" y2="103"
          stroke="rgba(255,218,0,0.3)" strokeWidth="0.8" strokeLinecap="round"
          strokeDasharray="150" strokeDashoffset="150" />
        <rect className="cf-car-info" x="68" y="113" width="14" height="9" rx="1.8"
          fill="rgba(255,218,0,0.5)" stroke="#ffda00" strokeWidth="0.7" />
        <line className="cf-vehicle" x1="88" y1="118" x2="170" y2="118"
          stroke="rgba(255,218,0,0.55)" strokeWidth="1.6" strokeLinecap="round"
          strokeDasharray="82" strokeDashoffset="82" />
        <text className="cf-rupee" x="68" y="135" fill="#ffda00" fontSize="9" fontWeight="900" fontFamily="sans-serif">₹</text>
        <line className="cf-amount" x1="78" y1="133" x2="148" y2="133"
          stroke="rgba(255,218,0,0.6)" strokeWidth="1.6" strokeLinecap="round"
          strokeDasharray="82" strokeDashoffset="82" />
        <text className="cf-hint" x="215" y="135" textAnchor="end"
          fill="rgba(255,218,0,0.55)" fontSize="5" fontWeight="800" fontFamily="sans-serif" letterSpacing="0.8">NO HIDDEN FEES</text>
        <g className="cf-stamp">
          <circle cx="0" cy="0" r="34" fill="rgba(255,218,0,0.06)" />
          <circle cx="0" cy="0" r="30" fill="rgba(12,8,5,0.92)" stroke="#ffda00" strokeWidth="1.8" />
          <circle className="cf-stamp-ring" cx="0" cy="0" r="24"
            stroke="#ffda00" strokeWidth="1" fill="none" strokeLinecap="round"
            strokeDasharray="188" strokeDashoffset="188" />
          <path className="cf-stamp-chk" d="M-11,1 L-3,10 L12,-10"
            stroke="#ffda00" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="40" strokeDashoffset="40" />
          <text className="cf-stamp-txt" x="0" y="20" textAnchor="middle"
            fill="#ffda00" fontSize="5" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.2">VERIFIED</text>
        </g>
        {Array.from({ length: 10 }, (_, pi) => (
          <circle key={pi} className="cf-dot"
            cx={215 + Math.cos((pi / 10) * Math.PI * 2) * 7}
            cy={50  + Math.sin((pi / 10) * Math.PI * 2) * 7}
            r={pi % 2 === 0 ? 2.5 : 1.8} fill="#ffda00" />
        ))}
      </svg>
    </div>
  )

  const renderPickupOverlay = () => (
    <div className="pu-anim-overlay absolute inset-0 flex items-center justify-center rounded-2xl"
      style={{ opacity: 0, pointerEvents: 'none', background: 'linear-gradient(160deg, rgba(12,8,5,0.97) 0%, rgba(20,14,8,0.99) 100%)' }}>
      <svg width="94%" height="86%" viewBox="0 0 280 160"
        fill="none" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <path className="pu-airport" d="M225,30 L245,12 L265,30 L265,38 L225,38 Z"
          stroke="#ffda00" strokeWidth="1.4" fill="rgba(255,218,0,0.07)" strokeLinejoin="round" />
        <line className="pu-rwy" x1="222" y1="42" x2="268" y2="42"
          stroke="rgba(255,218,0,0.55)" strokeWidth="1.2" strokeDasharray="3 2.5" />
        <text className="pu-iata" x="245" y="50" textAnchor="middle"
          fill="rgba(255,218,0,0.7)" fontSize="6" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.2">HGI</text>
        <g className="pu-plane">
          <line className="pu-trail" x1="-30" y1="0" x2="-3" y2="0"
            stroke="#ffda00" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 3" />
          <path d="M-12,0 L8,-2 L14,0 L8,2 Z M-3,-4 L0,0 L-3,4 Z" fill="#ffda00" />
          <path d="M2,-1 L6,-5 L8,-4 L4,0 Z" fill="#ffda00" />
          <path d="M2,1 L6,5 L8,4 L4,0 Z" fill="#ffda00" />
        </g>
        <line className="pu-road" x1="15" y1="135" x2="280" y2="135"
          stroke="rgba(255,218,0,0.3)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="270" strokeDashoffset="270" />
        <line x1="15" y1="135" x2="280" y2="135"
          stroke="rgba(255,218,0,0.08)" strokeWidth="4" strokeDasharray="14 18" />
        <path className="pu-pin"
          d="M60,40 C78,40 90,52 90,70 C90,92 60,125 60,125 C60,125 30,92 30,70 C30,52 42,40 60,40 Z"
          stroke="#ffda00" strokeWidth="2" strokeLinejoin="round"
          strokeDasharray="225" strokeDashoffset="225" />
        <circle className="pu-inner" cx="60" cy="66" r="11"
          fill="rgba(12,8,5,0.95)" stroke="#ffda00" strokeWidth="1.3" />
        <circle className="pu-phead" cx="60" cy="62" r="3.2" fill="#ffda00" />
        <path className="pu-pbody" d="M53,72 Q60,67 67,72 L67,73 Q60,75 53,73 Z" fill="#ffda00" />
        <g className="pu-clock">
          <circle cx="0" cy="0" r="22" fill="rgba(255,218,0,0.06)" />
          <circle cx="0" cy="0" r="18" stroke="#ffda00" strokeWidth="1.5" fill="rgba(12,8,5,0.85)" />
          {[0,1,2,3].map(h => {
            const a = (h/4) * Math.PI*2 - Math.PI/2
            return <circle key={h}
              cx={Math.cos(a)*14}
              cy={Math.sin(a)*14}
              r="1" fill="#ffda00" />
          })}
          <line className="pu-hour" x1="0" y1="0" x2="0" y2="-8"
            stroke="#ffda00" strokeWidth="2" strokeLinecap="round" />
          <line className="pu-min" x1="0" y1="0" x2="0" y2="-12"
            stroke="#ffda00" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="1.5" fill="#ffda00" />
        </g>
        <text className="pu-ontime" x="245" y="113" textAnchor="middle"
          fill="#ffda00" fontSize="6" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.5">ON TIME</text>
        <g className="pu-car">
          <path className="pu-beam" d="M118,122 L96,113 L96,131 Z" fill="rgba(255,218,0,0.18)" />
          <path d="M120,132 L120,121 Q122,113 132,113 L153,113 L160,103 L185,103 L194,113 L200,113 Q208,113 208,121 L208,132 Z"
            fill="rgba(255,218,0,0.1)" stroke="#ffda00" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M160,103 L185,103 L194,121 L153,121 Z"
            fill="rgba(255,218,0,0.18)" stroke="#ffda00" strokeWidth="1" strokeLinejoin="round" />
          <line x1="172" y1="103" x2="173.5" y2="121" stroke="#ffda00" strokeWidth="0.8" />
          <line x1="158" y1="124" x2="167" y2="124" stroke="#ffda00" strokeWidth="0.8" strokeLinecap="round" />
          <circle cx="138" cy="134" r="7" fill="rgba(12,8,5,0.95)" stroke="#ffda00" strokeWidth="1.5" />
          <circle cx="138" cy="134" r="3" fill="#ffda00" opacity="0.55" />
          <circle cx="189" cy="134" r="7" fill="rgba(12,8,5,0.95)" stroke="#ffda00" strokeWidth="1.5" />
          <circle cx="189" cy="134" r="3" fill="#ffda00" opacity="0.55" />
          <circle className="pu-headlight" cx="121" cy="122" r="2.5" fill="#ffda00" />
          <rect x="205" y="119" width="3" height="3" rx="0.6" fill="rgba(255,80,80,0.7)" />
        </g>
        <line className="pu-speed" x1="215" y1="118" x2="232" y2="118" stroke="rgba(255,218,0,0.35)" strokeWidth="1.6" strokeLinecap="round" />
        <line className="pu-speed" x1="218" y1="124" x2="238" y2="124" stroke="rgba(255,218,0,0.25)" strokeWidth="1.6" strokeLinecap="round" />
        <line className="pu-speed" x1="216" y1="130" x2="234" y2="130" stroke="rgba(255,218,0,0.3)" strokeWidth="1.6" strokeLinecap="round" />
        <circle className="pu-puff" cx="210" cy="125" r="3.2" fill="rgba(255,218,0,0.2)" />
        <circle className="pu-puff" cx="216" cy="121" r="2.4" fill="rgba(255,218,0,0.14)" />
        <circle className="pu-puff" cx="221" cy="117" r="1.8" fill="rgba(255,218,0,0.08)" />
        <circle className="pu-glow" cx="130" cy="120" r="26"
          stroke="rgba(255,218,0,0.28)" strokeWidth="9" />
        {Array.from({ length: 10 }, (_, pi) => (
          <circle key={pi} className="pu-dot"
            cx={130 + Math.cos((pi / 10) * Math.PI * 2) * 6}
            cy={120 + Math.sin((pi / 10) * Math.PI * 2) * 6}
            r={pi % 2 === 0 ? 2.5 : 1.8} fill="#ffda00" />
        ))}
      </svg>
    </div>
  )

  return (
    <>
    {/* Header outside mainRef — truly viewport-fixed at z-50, above the SVG wipe overlay (z-49) */}
    <Header />

    {/* ── ILP Notice Banner ── */}
    {showILPNotice === true && (
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{ background: '#ffda00', boxShadow: '0 -4px 32px rgba(255,218,0,0.28)' }}
      >
        <div className="container mx-auto px-4 py-3 flex items-start gap-3">
          {/* Icon */}
          <span className="mt-0.5 shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-black/10">
            <AlertTriangle size={15} strokeWidth={2.5} className="text-primary-950" />
          </span>

          {/* Text */}
          <p className="flex-1 text-xs md:text-sm leading-relaxed text-primary-950 min-w-0 font-medium">
            <span className="font-black tracking-widest uppercase mr-2 text-[10px] md:text-xs">ILP Notice</span>
            Inner Line Permit (ILP) is mandatory for all non-APST visitors entering Arunachal Pradesh. Please ensure you carry a valid ILP during your visit.
          </p>

          {/* Dismiss */}
          <button
            onClick={dismissILPNotice}
            aria-label="Dismiss ILP notice"
            className="shrink-0 mt-0.5 p-1 rounded-md text-primary-950/60 hover:text-primary-950 hover:bg-black/10 transition-colors duration-150"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    )}

    <div ref={mainRef} className="flex flex-col bg-primary-950" style={{ willChange: 'transform' }}>

      {/* ════════════════════ HERO + STATS = exactly 100vh ════════════════════ */}
      <div className="h-[100dvh] flex flex-col overflow-hidden">

      {/* ════════════════════ HERO ════════════════════ */}
      <section className="hero-section relative bg-primary-950 overflow-hidden flex-1 flex flex-col pt-12 md:pt-20 justify-center">
        {/* ── Background atmosphere image — behind mountains ── */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 0,
          WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at 50% 50%, black 15%, transparent 100%), linear-gradient(to bottom, black 55%, transparent 82%)',
          maskImage: 'radial-gradient(ellipse 85% 80% at 50% 50%, black 15%, transparent 100%), linear-gradient(to bottom, black 55%, transparent 82%)',
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}>
          {HERO_IMAGES.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              style={{
                objectFit: 'cover',
                filter: 'brightness(1) contrast(1.3) saturate(1.6) sepia(0.15) hue-rotate(-8deg)',
                opacity: heroIndex === i ? 0.8 : 0,
                transition: 'opacity 1.4s ease-in-out',
              }}
            />
          ))}
        </div>
        {/* Light ray right */}
        <div className="absolute top-0 right-0 w-[400px] h-[1px] bg-gradient-to-l from-secondary-500/30 to-transparent" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.7) 1px, transparent 1px)', backgroundSize: '38px 38px' }}
        />
        {/* Mountain silhouette */}
        <div className="absolute bottom-10 sm:bottom-0 -left-[34%] w-[168%] sm:left-0 sm:w-full pointer-events-none select-none opacity-[0.09]" style={{ zIndex: 2 }}>
          <svg className="w-full h-auto scale-y-[1.44] sm:scale-y-100 origin-bottom" viewBox="0 0 1440 160" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
            <path d="M0 160L110 72L260 120L410 48L580 110L740 18L890 90L1070 38L1260 95L1440 34V160H0Z" fill="#ffda00" />
          </svg>
        </div>

        {/* Two-column layout */}
        <div className="container mx-auto px-4 lg:px-14 xl:px-20 relative z-10 flex-1 flex flex-col justify-center -mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-2 items-center">

            {/* ── Left: text + CTAs ── */}
            <div className="flex flex-col justify-start" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)' }}>
              {/* Badge */}
              <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary-500/25 bg-secondary-500/8 text-secondary-400 text-xs font-semibold tracking-widest uppercase mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" />
                Donyi Polo Airport #1 Service
              </div>

              {/* Headline */}
              <div className="overflow-hidden mb-4 pb-2">
                <h1 className="font-black leading-[0.95] tracking-tight">
                  <span className="hero-line block text-4xl md:text-5xl lg:text-6xl text-white">Explore</span>
                  <span className="hero-line block text-5xl md:text-6xl lg:text-7xl text-secondary-500">Arunachal</span>
                  <span className="hero-line block text-4xl md:text-5xl lg:text-6xl text-white">Your Way</span>
                </h1>
              </div>

              {/* CTAs — immediately after headline, always visible */}
              <div className="hero-btns flex flex-wrap gap-2.5 mb-5 md:mb-6 opacity-100">
                <Link
                  href="/book-taxi"
                  style={{ textShadow: 'none' }}
                  className="group flex items-center gap-2.5 px-6 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 active:scale-[0.97] transition-all duration-200 shadow-2xl shadow-secondary-500/25 text-sm md:text-base will-change-transform whitespace-nowrap"
                >
                  Book Taxi Now
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
                <Link
                  href="/tours"
                  className="group flex items-center gap-2.5 px-6 py-3 border border-white/25 bg-black/30 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-black/45 hover:border-white/40 transition-all duration-200 text-sm md:text-base will-change-transform whitespace-nowrap"
                >
                  Explore Tours
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
              </div>

              {/* Subtitle */}
              <p className="hero-sub text-white/70 text-xs md:text-sm mb-5 leading-relaxed max-w-md">
                Pre-book airport taxis and curated tours from Donyi Polo Airport. Transparent pricing, verified drivers — no surprises.
              </p>

              {/* Trust badges */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {[
                  { Icon: CheckCircle, label: 'Verified Drivers', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                  { Icon: Shield, label: 'No Hidden Fees', color: 'text-secondary-400', bg: 'bg-secondary-500/10 border-secondary-500/20' },
                  { Icon: Zap, label: 'Book in 2 min', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                ].map(({ Icon, label, color, bg }, i) => (
                  <div key={i} className={`hero-mini-stat flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${bg}`}>
                    <Icon size={12} className={color} />
                    <span className="text-gray-300 text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: App flow — single phone ── */}
            <div className="hidden lg:block relative h-[460px] overflow-visible">

              {/* ── Radar background layer — fixed, never tilts ── */}
              <div className="hero-radar-bg absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
                <svg
                  className="w-full h-full"
                  viewBox="0 0 560 450"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <filter id="radarglow" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="12" result="b"/>
                      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>

                  {/* Soft central aura — fixed warm fill behind the phone */}
                  <ellipse cx="280" cy="225" rx="210" ry="198" fill="rgba(255,218,0,0.032)"/>
                  <ellipse cx="280" cy="225" rx="125" ry="118" fill="rgba(255,218,0,0.038)"/>

                  {/* Radar rings — GSAP drives r (8→310) and opacity (0.55→0), staggered */}
                  <circle className="radar-ring" cx="280" cy="225" r="8" fill="none" stroke="rgba(255,218,0,0.52)" strokeWidth="1.2"/>
                  <circle className="radar-ring" cx="280" cy="225" r="8" fill="none" stroke="rgba(255,218,0,0.52)" strokeWidth="1.2"/>
                  <circle className="radar-ring" cx="280" cy="225" r="8" fill="none" stroke="rgba(255,218,0,0.52)" strokeWidth="1.2"/>
                  <circle className="radar-ring" cx="280" cy="225" r="8" fill="none" stroke="rgba(255,218,0,0.52)" strokeWidth="1.2"/>
                  <circle className="radar-ring" cx="280" cy="225" r="8" fill="none" stroke="rgba(255,218,0,0.52)" strokeWidth="1.2"/>

                  {/* Edge bokeh — ambient warmth at screen corners */}
                  <circle cx="-18" cy="145" r="52" fill="rgba(255,218,0,0.045)" filter="url(#radarglow)"/>
                  <circle cx="32"  cy="318" r="36" fill="rgba(255,218,0,0.035)" filter="url(#radarglow)"/>
                  <circle cx="580" cy="130" r="46" fill="rgba(255,218,0,0.045)" filter="url(#radarglow)"/>
                  <circle cx="532" cy="326" r="32" fill="rgba(255,218,0,0.035)" filter="url(#radarglow)"/>
                  {/* Scattered particles */}
                  <circle cx="-14" cy="108" r="2.2" fill="rgba(255,218,0,0.22)"/>
                  <circle cx="25"  cy="195" r="1.5" fill="rgba(255,218,0,0.17)"/>
                  <circle cx="-8"  cy="272" r="1.8" fill="rgba(255,218,0,0.19)"/>
                  <circle cx="50"  cy="82"  r="1.3" fill="rgba(255,218,0,0.14)"/>
                  <circle cx="575" cy="112" r="2.2" fill="rgba(255,218,0,0.22)"/>
                  <circle cx="538" cy="208" r="1.5" fill="rgba(255,218,0,0.17)"/>
                  <circle cx="570" cy="295" r="1.8" fill="rgba(255,218,0,0.19)"/>
                  <circle cx="504" cy="76"  r="1.3" fill="rgba(255,218,0,0.14)"/>
                </svg>
              </div>

              {/* ── Phone (tilts on mouse via hero-img-main) ── */}
              <div className="hero-img-main absolute inset-0" style={{ transformStyle: 'preserve-3d', overflow: 'visible' }}>
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 560 450"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <filter id="pglow" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="8" result="b"/>
                      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="pglow-sm" x="-120%" y="-120%" width="340%" height="340%">
                      <feGaussianBlur stdDeviation="3" result="b"/>
                      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <clipPath id="screenclip">
                      <rect x="178" y="62" width="204" height="318" rx="5"/>
                    </clipPath>
                    <clipPath id="logo-clip">
                      <circle cx="280" cy="221" r="46"/>
                    </clipPath>
                    <pattern id="dotgrid2" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                      <circle cx="0" cy="0" r="0.9" fill="rgba(255,218,0,0.06)"/>
                    </pattern>
                  </defs>

                  <rect width="560" height="450" fill="url(#dotgrid2)" />

                  {/* Phone ambient glow */}
                  <rect x="158" y="4" width="244" height="442" rx="40" fill="rgba(255,218,0,0.04)" filter="url(#pglow)"/>

                  {/* ── Phone body ── */}
                  <rect x="168" y="14" width="224" height="422" rx="34" fill="rgba(6,4,3,0.98)" stroke="rgba(255,218,0,0.32)" strokeWidth="1.6"/>
                  {/* Side buttons */}
                  <rect x="166" y="140" width="3" height="32" rx="1.5" fill="rgba(255,218,0,0.15)"/>
                  <rect x="166" y="180" width="3" height="32" rx="1.5" fill="rgba(255,218,0,0.15)"/>
                  <rect x="391" y="155" width="3" height="50" rx="1.5" fill="rgba(255,218,0,0.15)"/>
                  {/* Screen bg */}
                  <rect x="178" y="62" width="204" height="318" rx="5" fill="rgba(10,7,5,0.99)"/>
                  {/* Camera punch-hole */}
                  <circle cx="280" cy="38" r="8" fill="rgba(3,2,1,1)" stroke="rgba(255,218,0,0.07)" strokeWidth="0.6"/>
                  <circle cx="280" cy="38" r="4" fill="rgba(14,10,7,1)"/>
                  {/* Status bar */}
                  <text x="192" y="54" fontSize="8.5" fill="rgba(255,218,0,0.55)" fontFamily="monospace" fontWeight="bold">9:41</text>
                  <circle cx="330" cy="50" r="2.5" fill="rgba(80,220,80,0.6)"/>
                  <rect x="344" y="45" width="20" height="9" rx="2" fill="none" stroke="rgba(255,218,0,0.35)" strokeWidth="0.8"/>
                  <rect x="345" y="46" width="14" height="7" rx="1.5" fill="rgba(255,218,0,0.48)"/>
                  <rect x="364" y="47.5" width="3" height="4" rx="1" fill="rgba(255,218,0,0.25)"/>
                  <rect x="334" y="47" width="2.5" height="6" rx="0.5" fill="rgba(255,218,0,0.5)"/>
                  <rect x="337.5" y="48.5" width="2.5" height="4.5" rx="0.5" fill="rgba(255,218,0,0.38)"/>
                  <rect x="341" y="50" width="2.5" height="3" rx="0.5" fill="rgba(255,218,0,0.25)"/>
                  {/* Home bar */}
                  <rect x="251" y="412" width="58" height="5" rx="2.5" fill="rgba(255,218,0,0.18)"/>

                  {/* ══ Animated steps — clipped to screen ══ */}
                  {/* Cycle: 18s total, 3s per step. Step 1 enters via circular bloom from centre. */}
                  <g clipPath="url(#screenclip)">

                    {/* Step 1 — Logo fade in (0–3s) */}
                    <g>
                      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.055;0.148;0.167;1" dur="18s" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0 0.1 1;0 0 0 0;0.4 0 1 1;0 0 0 0"/>
                      {/* Outer glow ring */}
                      <circle cx="280" cy="221" r="52" fill="none" stroke="rgba(255,218,0,0.18)" strokeWidth="1.2"/>
                      {/* Yellow circle bg */}
                      <circle cx="280" cy="221" r="46" fill="#ffda00" filter="url(#pglow-sm)"/>
                      {/* Actual logo image */}
                      <image href="https://hpobmsfwvrewpjqnmhsv.supabase.co/storage/v1/object/sign/internal/image-removebg-preview%20(1).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjA1YjRkYi0wMDA4LTQyOWUtYTFmZi02NzBjZTE1OWJhOTkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbnRlcm5hbC9pbWFnZS1yZW1vdmViZy1wcmV2aWV3ICgxKS5wbmciLCJpYXQiOjE3Nzc3NTQ5NzksImV4cCI6MTkzNTQzNDk3OX0.FR2fYD_zRiEMwQcrMja4J1PCZI6o6EFZ-_-8i6T0dy8"
                        x="234" y="175" width="92" height="92"
                        clipPath="url(#logo-clip)" preserveAspectRatio="xMidYMid meet"/>
                    </g>

                    {/* Step 2 — Choose Service (3–6s) */}
                    <g>
                      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.167;0.185;0.315;0.333;1" dur="18s" repeatCount="indefinite"/>
                      <animateTransform attributeName="transform" type="translate" values="0,10;0,10;0,0;0,0;0,-10;0,-10" keyTimes="0;0.167;0.185;0.315;0.333;1" dur="18s" repeatCount="indefinite"/>
                      <text x="192" y="88" fontSize="7.5" fill="rgba(255,218,0,0.35)" fontFamily="monospace">STEP 1 · CHOOSE SERVICE</text>
                      <text x="280" y="113" textAnchor="middle" fontSize="13" fontWeight="bold" fill="rgba(255,255,255,0.88)" fontFamily="sans-serif">What do you need?</text>
                      {/* Taxi card - active */}
                      <rect x="183" y="126" width="194" height="52" rx="8" fill="rgba(255,218,0,0.1)" stroke="rgba(255,218,0,0.55)" strokeWidth="1.2"/>
                      <circle cx="206" cy="152" r="13" fill="rgba(255,218,0,0.12)"/>
                      <text x="206" y="157" textAnchor="middle" fontSize="9" fontWeight="bold" fill="rgba(255,218,0,0.88)" fontFamily="monospace">TX</text>
                      <text x="226" y="147" fontSize="10.5" fontWeight="bold" fill="rgba(255,218,0,0.92)" fontFamily="sans-serif">Taxi Booking</text>
                      <text x="226" y="162" fontSize="8" fill="rgba(255,218,0,0.45)" fontFamily="monospace">Airport &amp; city rides</text>
                      <text x="366" y="155" fontSize="14" fill="rgba(255,218,0,0.5)" fontFamily="sans-serif">›</text>
                      {/* Tour card */}
                      <rect x="183" y="194" width="194" height="52" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8"/>
                      <circle cx="206" cy="220" r="13" fill="rgba(255,255,255,0.04)"/>
                      <text x="206" y="223" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="rgba(255,255,255,0.45)" fontFamily="monospace">TO</text>
                      <text x="226" y="215" fontSize="10.5" fontWeight="bold" fill="rgba(255,255,255,0.5)" fontFamily="sans-serif">Tour Package</text>
                      <text x="226" y="230" fontSize="8" fill="rgba(255,255,255,0.25)" fontFamily="monospace">Fixed price tours</text>
                      <text x="366" y="223" fontSize="14" fill="rgba(255,255,255,0.2)" fontFamily="sans-serif">›</text>
                    </g>

                    {/* Step 3 — Fill Booking Details (6–9s) */}
                    <g>
                      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.333;0.351;0.481;0.500;1" dur="18s" repeatCount="indefinite"/>
                      <animateTransform attributeName="transform" type="translate" values="0,10;0,10;0,0;0,0;0,-10;0,-10" keyTimes="0;0.333;0.351;0.481;0.500;1" dur="18s" repeatCount="indefinite"/>
                      <text x="192" y="88" fontSize="7.5" fill="rgba(255,218,0,0.35)" fontFamily="monospace">STEP 2 · ROUTE &amp; DETAILS</text>
                      {[0,1,2,3,4].map(i => (
                        <circle key={i} cx={246+i*19} cy={100} r={i===1?4.5:2.5} fill={i===1?'#ffda00':'rgba(255,218,0,0.2)'}/>
                      ))}
                      <text x="280" y="124" textAnchor="middle" fontSize="13" fontWeight="bold" fill="rgba(255,255,255,0.88)" fontFamily="sans-serif">Route &amp; Details</text>
                      <text x="192" y="148" fontSize="8" fill="rgba(255,218,0,0.42)" fontFamily="monospace">DESTINATION</text>
                      <rect x="183" y="153" width="194" height="30" rx="5" fill="rgba(255,218,0,0.07)" stroke="rgba(255,218,0,0.3)" strokeWidth="0.8"/>
                      <circle cx="198" cy="168" r="4" fill="rgba(255,218,0,0.55)"/>
                      <text x="210" y="172" fontSize="10" fill="rgba(255,218,0,0.82)" fontFamily="sans-serif">Itanagar City</text>
                      <text x="192" y="202" fontSize="8" fill="rgba(255,255,255,0.28)" fontFamily="monospace">DATE &amp; TIME</text>
                      <rect x="183" y="207" width="194" height="30" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>
                      <text x="198" y="226" fontSize="10" fill="rgba(255,255,255,0.55)" fontFamily="sans-serif">16 May 2026 · 14:30</text>
                      <text x="192" y="256" fontSize="8" fill="rgba(255,255,255,0.28)" fontFamily="monospace">PASSENGERS</text>
                      <rect x="183" y="261" width="88" height="30" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>
                      <text x="221" y="280" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.6)" fontFamily="sans-serif">2</text>
                      <rect x="183" y="310" width="194" height="32" rx="7" fill="#ffda00"/>
                      <text x="280" y="330" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1a1512" fontFamily="monospace">NEXT  →</text>
                    </g>

                    {/* Step 4 — Select Car (9–12s) */}
                    <g>
                      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.500;0.518;0.648;0.667;1" dur="18s" repeatCount="indefinite"/>
                      <animateTransform attributeName="transform" type="translate" values="0,10;0,10;0,0;0,0;0,-10;0,-10" keyTimes="0;0.500;0.518;0.648;0.667;1" dur="18s" repeatCount="indefinite"/>
                      <text x="192" y="88" fontSize="7.5" fill="rgba(255,218,0,0.35)" fontFamily="monospace">STEP 3 · SELECT CAR</text>
                      {[0,1,2,3,4].map(i => (
                        <circle key={i} cx={246+i*19} cy={100} r={i===2?4.5:2.5} fill={i===2?'#ffda00':'rgba(255,218,0,0.2)'}/>
                      ))}
                      <text x="280" y="124" textAnchor="middle" fontSize="13" fontWeight="bold" fill="rgba(255,255,255,0.88)" fontFamily="sans-serif">Available Cars</text>
                      {/* SUV — selected */}
                      <rect x="183" y="133" width="194" height="68" rx="8" fill="rgba(255,218,0,0.1)" stroke="#ffda00" strokeWidth="1.2"/>
                      <rect x="188" y="138" width="32" height="20" rx="4" fill="rgba(255,218,0,0.12)"/>
                      <text x="204" y="151" textAnchor="middle" fontSize="9" fill="rgba(255,218,0,0.7)" fontFamily="monospace">SUV</text>
                      <text x="228" y="152" fontSize="10.5" fontWeight="bold" fill="rgba(255,255,255,0.88)" fontFamily="sans-serif">SUV / MUV</text>
                      <text x="228" y="167" fontSize="8" fill="rgba(255,218,0,0.48)" fontFamily="monospace">6 seats · ₹18/km</text>
                      <text x="368" y="160" textAnchor="end" fontSize="13" fontWeight="bold" fill="#ffda00" fontFamily="monospace">₹2,800</text>
                      <text x="368" y="172" textAnchor="end" fontSize="7" fill="rgba(255,218,0,0.38)" fontFamily="monospace">est. total</text>
                      <rect x="188" y="175" width="52" height="14" rx="4" fill="rgba(255,218,0,0.15)"/>
                      <text x="214" y="185" textAnchor="middle" fontSize="7" fill="rgba(255,218,0,0.8)" fontFamily="monospace">✓ SELECTED</text>
                      {/* Sedan */}
                      <rect x="183" y="210" width="194" height="60" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8"/>
                      <rect x="188" y="215" width="32" height="20" rx="4" fill="rgba(255,255,255,0.06)"/>
                      <text x="204" y="228" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">CAR</text>
                      <text x="228" y="229" fontSize="10.5" fontWeight="bold" fill="rgba(255,255,255,0.5)" fontFamily="sans-serif">Sedan</text>
                      <text x="228" y="244" fontSize="8" fill="rgba(255,255,255,0.25)" fontFamily="monospace">4 seats · ₹12/km</text>
                      <text x="368" y="240" textAnchor="end" fontSize="13" fontWeight="bold" fill="rgba(255,255,255,0.35)" fontFamily="monospace">₹1,400</text>
                      <rect x="183" y="285" width="194" height="32" rx="7" fill="#ffda00"/>
                      <text x="280" y="305" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1a1512" fontFamily="monospace">CONTINUE  →</text>
                    </g>

                    {/* Step 5 — Payment (12–15s) */}
                    <g>
                      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.667;0.685;0.815;0.833;1" dur="18s" repeatCount="indefinite"/>
                      <animateTransform attributeName="transform" type="translate" values="0,10;0,10;0,0;0,0;0,-10;0,-10" keyTimes="0;0.667;0.685;0.815;0.833;1" dur="18s" repeatCount="indefinite"/>
                      <text x="192" y="88" fontSize="7.5" fill="rgba(255,218,0,0.35)" fontFamily="monospace">STEP 5 · PAYMENT</text>
                      {[0,1,2,3,4].map(i => (
                        <circle key={i} cx={246+i*19} cy={100} r={i===4?4.5:2.5} fill={i===4?'#ffda00':'rgba(255,218,0,0.2)'}/>
                      ))}
                      {/* Summary */}
                      <rect x="183" y="112" width="194" height="96" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,218,0,0.12)" strokeWidth="0.8"/>
                      <text x="193" y="131" fontSize="9" fontWeight="bold" fill="rgba(255,255,255,0.72)" fontFamily="sans-serif">Taxi Booking · Itanagar</text>
                      <text x="193" y="147" fontSize="7.5" fill="rgba(255,255,255,0.32)" fontFamily="monospace">16 May 2026 · 14:30 · 2 pax</text>
                      <text x="193" y="161" fontSize="7.5" fill="rgba(255,255,255,0.32)" fontFamily="monospace">SUV / MUV</text>
                      <line x1="193" y1="170" x2="369" y2="170" stroke="rgba(255,218,0,0.1)" strokeWidth="0.6"/>
                      <text x="193" y="185" fontSize="9" fill="rgba(255,255,255,0.38)" fontFamily="monospace">TOTAL</text>
                      <text x="369" y="188" textAnchor="end" fontSize="16" fontWeight="bold" fill="#ffda00" fontFamily="monospace">₹2,800</text>
                      {/* Pay 30% */}
                      <rect x="183" y="218" width="194" height="38" rx="7" fill="rgba(255,218,0,0.1)" stroke="rgba(255,218,0,0.45)" strokeWidth="1"/>
                      <text x="280" y="233" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="rgba(255,218,0,0.88)" fontFamily="monospace">PAY 30% · ₹840</text>
                      <text x="280" y="248" textAnchor="middle" fontSize="7.5" fill="rgba(255,218,0,0.4)" fontFamily="monospace">₹1,960 cash to driver</text>
                      {/* Pay full */}
                      <rect x="183" y="265" width="194" height="38" rx="7" fill="#ffda00"/>
                      <text x="280" y="280" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#1a1512" fontFamily="monospace">PAY FULL · ₹2,800</text>
                      <text x="280" y="295" textAnchor="middle" fontSize="7.5" fill="rgba(26,21,18,0.6)" fontFamily="monospace">100% online · no cash</text>
                      <text x="280" y="325" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.18)" fontFamily="monospace">Secured by Razorpay</text>
                    </g>

                    {/* Step 6 — Confirmed (15–18s) — fades out at 17s, dark gap before bloom */}
                    <g>
                      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.833;0.851;0.944;0.972;1" dur="18s" repeatCount="indefinite"/>
                      <animateTransform attributeName="transform" type="translate" values="0,10;0,10;0,0;0,0;0,-10;0,-10" keyTimes="0;0.833;0.851;0.944;0.972;1" dur="18s" repeatCount="indefinite"/>
                      {/* Pulse ring */}
                      <circle cx="280" cy="160" r="48" fill="none" stroke="rgba(255,218,0,0.12)" strokeWidth="1">
                        <animate attributeName="r" values="38;52;38" dur="2.4s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="280" cy="160" r="38" fill="rgba(255,218,0,0.08)" stroke="rgba(255,218,0,0.32)" strokeWidth="1.2"/>
                      <circle cx="280" cy="160" r="26" fill="rgba(255,218,0,0.12)" stroke="rgba(255,218,0,0.5)" strokeWidth="1"/>
                      <polyline points="264,160 275,172 297,148" stroke="#ffda00" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#pglow-sm)"/>
                      <text x="280" y="220" textAnchor="middle" fontSize="15" fontWeight="bold" fill="rgba(255,255,255,0.92)" fontFamily="sans-serif">Booking Confirmed!</text>
                      <text x="280" y="240" textAnchor="middle" fontSize="9" fill="rgba(255,218,0,0.58)" fontFamily="monospace">BK-20260516-3842</text>
                      <text x="280" y="260" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.35)" fontFamily="sans-serif">Driver will be assigned soon.</text>
                      <text x="280" y="276" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.35)" fontFamily="sans-serif">Confirmation email sent.</text>
                      <rect x="203" y="294" width="154" height="32" rx="7" fill="#ffda00"/>
                      <text x="280" y="314" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#1a1512" fontFamily="monospace">VIEW BOOKING</text>
                      <rect x="203" y="335" width="154" height="28" rx="7" fill="none" stroke="rgba(255,218,0,0.35)" strokeWidth="0.8"/>
                      <text x="280" y="353" textAnchor="middle" fontSize="9" fill="rgba(255,218,0,0.5)" fontFamily="monospace">LEAVE A REVIEW  ★</text>
                    </g>


                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ════════════════════ STATS ════════════════════ */}
      <section className="stats-section relative z-20 shrink-0 -mt-10 -ml-[3px] sm:mt-0 sm:ml-0 py-4 sm:py-5 md:py-6" style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1410 50%, #0f0c0a 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,218,0,0.1), inset 0 -1px 0 rgba(0,0,0,0.8), 0 10px 40px rgba(0,0,0,0.8), 0 0 100px rgba(255,218,0,0.05)',
        border: '1px solid',
        borderColor: 'rgba(255,218,0,0.15)',
        borderImageSource: 'linear-gradient(135deg, rgba(255,218,0,0.3) 0%, rgba(255,218,0,0.1) 50%, rgba(255,218,0,0.05) 100%)',
        borderImageSlice: 1,
      }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,218,0,0.08) 0%, transparent 60%)',
        }} />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 sm:gap-6">
            {STATS.map((stat, i) => (
              <div key={i} className="stat-item text-center min-w-0">
                <div className="flex items-baseline justify-center gap-1 mb-1 sm:mb-1.5">
                  <span className="stat-number text-[2rem] leading-none sm:text-3xl md:text-4xl font-black text-secondary-500">
                    {stat.decimal ? stat.value.toFixed(1) : stat.value}
                  </span>
                  <span className="text-secondary-500 font-black text-base sm:text-lg">{stat.suffix}</span>
                </div>
                <p className="text-gray-500 text-[11px] leading-snug sm:text-xs md:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        {/* ── Scroll indicator — sits at label level, no extra space ── */}
        <div className="absolute bottom-[1.1rem] sm:bottom-[1.35rem] md:bottom-[1.6rem] left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none select-none">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/25">scroll</span>
          <ChevronDown size={12} className="text-white/25 animate-bounce" />
        </div>
      </section>
      </div>{/* end h-screen hero+stats wrapper */}

      {/* ════════════════════ TOURS ════════════════════ */}
      {/* Skip the whole section when there are no tours — otherwise it occupies a full viewport
          for a placeholder and the scroll-step machine has nothing to land on. */}
      {(loadingTours || featuredTours.length > 0) && (
      <section
        className="tours-section h-[100dvh] py-8 md:py-28 relative overflow-hidden flex flex-col justify-center"
        style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 35%, #110e0c 70%, #0d0b09 100%)' }}
      >
        {/* ── Tour section background atmosphere ── */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          {/* Blurred tour image halves — cross-fades between active pair */}
          {!loadingTours && featuredTours.map((tour, i) => {
            const images = tour.image_urls?.length ? tour.image_urls : tour.image_url ? [tour.image_url] : [TOUR_IMAGES[i % TOUR_IMAGES.length]]
            const isLeft = i % 2 === 0
            return (
              <div
                key={tour.id}
                className="tours-bg-img absolute inset-0"
                data-tour-idx={i}
                style={{ opacity: 0 }}
              >
                <div style={{
                  position: 'absolute',
                  left: isLeft ? '-5%' : '40%',
                  width: '65%',
                  top: '-5%',
                  height: '110%',
                  overflow: 'hidden',
                  WebkitMaskImage: isLeft
                    ? 'linear-gradient(to right, black 40%, transparent 100%)'
                    : 'linear-gradient(to left, black 40%, transparent 100%)',
                  maskImage: isLeft
                    ? 'linear-gradient(to right, black 40%, transparent 100%)'
                    : 'linear-gradient(to left, black 40%, transparent 100%)',
                }}>
                  <Image
                    src={images[0]}
                    alt=""
                    fill
                    sizes="65vw"
                    priority={i < 2}
                    loading={i < 2 ? 'eager' : undefined}
                    style={{ objectFit: 'cover', filter: 'blur(14px) saturate(1.3)', transform: 'scale(1.06)' }}
                  />
                </div>
              </div>
            )
          })}
          {/* Darkening overlay — lighter so image detail shows through */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(160deg, rgba(22,18,15,0.5) 0%, rgba(28,20,16,0.34) 50%, rgba(17,14,12,0.52) 100%)',
          }} />
          {/* Bottom depth fade into next section */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        {/* Grain texture */}
        <div className="absolute inset-0 opacity-[0.022] pointer-events-none select-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '180px' }} />

        <div className="container mx-auto px-4 relative z-10 -translate-y-[30px] md:translate-y-0">
          <div className="tours-heading flex flex-col md:flex-row md:items-end justify-between gap-5 mb-6 md:mb-12">
            <div>
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3">Top Packages</p>
              <h2 className="text-3xl md:text-5xl font-black text-white">Featured Tours</h2>
            </div>
            <Link href="/tours" className="group inline-flex items-center gap-2 text-gray-400 font-semibold hover:text-secondary-500 transition-colors text-sm">
              View All
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loadingTours ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden bg-primary-900/60 animate-pulse">
                  <div className="bg-primary-800/50 h-64" />
                  <div className="p-6 space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredTours.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 mb-6">No tours available at the moment.</p>
              <Link href="/tours" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-950 text-white font-bold rounded-xl hover:bg-primary-900 transition-all">
                View All Tours <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            // Carousel container — fixed height, all cards absolutely positioned at same location
            // Mobile: full-width cards stack at card-0 position (4 scroll steps)
            // Desktop: 2-column pairs stack at row-0 position (2 scroll steps)
            <div className="relative w-full overflow-hidden h-[530px] md:h-[500px]">
              {featuredTours.map((tour, index) => {
                const posInGroup = index % 2 // 0 = left col, 1 = right col
                const isExpanded = expandedTourId === tour.id
                return (
                  <div
                    key={tour.id}
                    onClick={() => setExpandedTourId(isExpanded ? null : tour.id)}
                    className={`tour-card card-3d group absolute top-0 rounded-3xl overflow-hidden bg-primary-900/80 backdrop-blur-md border border-primary-800/60 cursor-pointer
                      w-full h-[520px] md:h-[490px] md:top-0
                      ${posInGroup === 0 ? 'md:left-0 md:w-[calc(50%-12px)]' : 'md:left-[calc(50%+12px)] md:w-[calc(50%-12px)]'}`}
                    style={{ boxShadow: '0 16px 44px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,218,0,0.1)' }}
                  >
                    {/* Image Carousel */}
                    {(() => {
                      const images = tour.image_urls?.length ? tour.image_urls : tour.image_url ? [tour.image_url] : [TOUR_IMAGES[index % TOUR_IMAGES.length]]
                      const idx = cardImgIdx[tour.id] ?? 0
                      const goTo = (e: React.MouseEvent | React.TouchEvent, next: number) => {
                        e.stopPropagation()
                        setCardImgIdx(prev => ({ ...prev, [tour.id]: (next + images.length) % images.length }))
                      }
                      return (
                        <div
                          className={`tour-img relative transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'h-[140px]' : 'h-[300px] md:h-[290px]'}`}
                          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
                          onTouchEnd={(e) => {
                            if (images.length < 2) return
                            const diff = touchStartX.current - e.changedTouches[0].clientX
                            if (Math.abs(diff) > 30) goTo(e, diff > 0 ? idx + 1 : idx - 1)
                          }}
                        >
                          <Image
                            src={images[idx]}
                            alt={tour.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority={index < 2 && idx === 0}
                            loading={index < 2 ? 'eager' : undefined}
                            className="object-cover transition-opacity duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-primary-950/70 via-primary-950/5 to-transparent" />
                          {images.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => goTo(e, idx - 1)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary-950/70 text-white flex items-center justify-center text-base hover:bg-primary-950/90 transition-colors z-10"
                              >‹</button>
                              <button
                                type="button"
                                onClick={(e) => goTo(e, idx + 1)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary-950/70 text-white flex items-center justify-center text-base hover:bg-primary-950/90 transition-colors z-10"
                              >›</button>
                              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                                {images.map((_, i) => (
                                  <span key={i} className={`block w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
                                ))}
                              </div>
                            </>
                          )}
                          {/* Price */}
                          <div className="absolute top-4 right-4 px-3 py-1.5 bg-secondary-500 text-primary-950 font-black text-sm rounded-xl shadow-lg z-10">
                            ₹{tour.price}
                          </div>
                          {/* Rating */}
                          {ratingStats[tour.id]?.count > 0 ? (
                            <Link
                              href={`/tours/${tour.id}/reviews`}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute bottom-4 left-4 flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer z-10"
                            >
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} size={10} className={s <= Math.round(ratingStats[tour.id].avg) ? 'text-secondary-500 fill-secondary-500' : 'text-secondary-500/30 fill-secondary-500/30'} />
                                ))}
                              </div>
                              <span className="text-white text-xs font-semibold">{ratingStats[tour.id].avg} · {ratingStats[tour.id].count}</span>
                            </Link>
                          ) : (
                            <div className="absolute bottom-4 left-4 text-gray-400 text-xs font-semibold z-10">No reviews yet</div>
                          )}
                          {/* Wind breeze — single diagonal streak, color-aware via backdrop-filter */}
                          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 4 }}>
                            <div style={{
                              position: 'absolute', top: '-50%', left: 0, width: '30%', height: '200%',
                              background: 'linear-gradient(to right, transparent 0%, rgba(255,252,218,0.018) 30%, rgba(255,254,226,0.03) 50%, rgba(255,252,218,0.018) 70%, transparent 100%)',
                              backdropFilter: 'saturate(2) brightness(1.38)',
                              WebkitBackdropFilter: 'saturate(2) brightness(1.38)',
                            transformOrigin: 'top left',
                              animation: `tour-shimmer-flow ${(7.8 + ((index * 0.618) % 1) * 2).toFixed(1)}s ease-in-out ${(index * 1.5).toFixed(1)}s infinite`,
                              boxShadow: '0 0 22px 10px rgba(255,252,215,0.035)',
                            }} />
                          </div>
                        </div>
                      )
                    })()}

                    {/* Content */}
                    <div className={`transition-all duration-500 p-4 md:p-7 flex flex-col ${isExpanded ? 'h-[calc(100%-140px)]' : 'h-[calc(100%-300px)] md:h-[calc(100%-290px)]'}`}>
                      <div className={`flex-1 ${isExpanded ? 'overflow-y-auto pr-1' : 'overflow-hidden'}`}>
                        <h3 className={`font-black text-white mb-2.5 transition-all ${isExpanded ? 'text-xl' : 'text-2xl'}`}>{tour.name}</h3>
                        <p className={`text-gray-400 text-sm md:text-base mb-5 leading-relaxed ${isExpanded ? '' : 'line-clamp-3 min-h-[3.75rem] md:min-h-[4.5rem]'}`}>
                          {tour.description}
                        </p>

                        {/* Expanded Details: Itinerary */}
                        {isExpanded && tour.itinerary && (
                          <div className="mt-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-500">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Itinerary</p>
                            <p className="text-gray-400 text-xs leading-relaxed italic">{tour.itinerary}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <div className={`flex items-center gap-4 text-xs md:text-sm text-gray-400 transition-opacity ${isExpanded ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} className="text-secondary-500" />{tour.duration_hours}h
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users size={12} className="text-secondary-500" />{tour.max_passengers} pax
                          </span>
                        </div>
                        <Link
                          onClick={(e) => e.stopPropagation()}
                          href={`/tours/${tour.id}/book`}
                          className="group/btn flex items-center gap-2 px-5 py-2.5 bg-primary-950 text-white text-sm font-bold rounded-xl hover:bg-secondary-500 hover:text-primary-950 transition-all duration-200 shadow-lg shadow-primary-950/20"
                        >
                          Book Now
                          <ArrowRight size={12} className="group-hover/btn:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ════════════════════ HOW IT WORKS ════════════════════ */}
      <section className="steps-section h-[100dvh] bg-primary-950 relative overflow-hidden flex flex-col">

        {/* ── Background layer ── */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.9) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        {/* Diagonal accent lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06]">
          <div className="absolute top-0 left-1/4 w-px h-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.6) 40%, rgba(255,218,0,0.6) 60%, transparent)' }} />
          <div className="absolute top-0 left-2/4 w-px h-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.4) 30%, rgba(255,218,0,0.4) 70%, transparent)' }} />
          <div className="absolute top-0 left-3/4 w-px h-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.6) 40%, rgba(255,218,0,0.6) 60%, transparent)' }} />
        </div>
        {/* Glow orbs per card column */}
        <div className="absolute inset-0 pointer-events-none hidden md:block">
          <div className="absolute top-1/2 left-[16.5%] -translate-x-1/2 -translate-y-1/2 w-80 h-80"
            style={{ background: 'radial-gradient(circle, rgba(255,218,0,0.07) 0%, transparent 70%)', filter: 'blur(48px)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72"
            style={{ background: 'radial-gradient(circle, rgba(255,218,0,0.04) 0%, transparent 70%)', filter: 'blur(48px)' }} />
          <div className="absolute top-1/2 left-[83.5%] -translate-x-1/2 -translate-y-1/2 w-80 h-80"
            style={{ background: 'radial-gradient(circle, rgba(255,218,0,0.07) 0%, transparent 70%)', filter: 'blur(48px)' }} />
        </div>
        {/* Top + bottom border lines */}
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,218,0,0.18) 25%, rgba(255,218,0,0.18) 75%, transparent)' }} />
        <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,218,0,0.1) 25%, rgba(255,218,0,0.1) 75%, transparent)' }} />

        {/* ── Content ── */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0 container mx-auto px-4 sm:px-6 py-6 sm:py-10 md:py-10">

          {/* Header */}
          <div className="text-center mb-4 sm:mb-7 md:mb-8 shrink-0">
            <p className="text-secondary-500 font-semibold text-[10px] sm:text-xs tracking-[0.24em] uppercase mb-1 sm:mb-2">Simple Process</p>
            <h2 className="text-[1.7rem] sm:text-4xl md:text-5xl font-black text-white leading-tight mb-1">How It Works</h2>
          </div>

          {/* ── MOBILE: tall stacked cards with animation overlays ── */}
          <div className="md:hidden flex flex-col flex-1 min-h-0 gap-3 relative">
            {/* Continuous timeline spine running through all cards */}
            <div className="absolute left-[1.65rem] top-3 bottom-3 w-px pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.32) 8%, rgba(255,218,0,0.32) 92%, transparent)' }} />

            {HOW_IT_WORKS.map(({ Icon, step, title, desc }, i) => {
              const playFn = i === 0 ? playBookAnim : i === 1 ? playConfirmAnim : playPickupAnim
              return (
                <div key={`m-step-${i}`} className="step-card relative flex items-stretch gap-2.5 flex-1 min-h-0 cursor-pointer" onClick={playFn}>
                  {/* Spine node */}
                  <div className="shrink-0 flex flex-col items-center justify-center" style={{ width: '2.2rem' }}>
                    <div className="w-3 h-3 rounded-full border-2 relative z-10"
                      style={{ borderColor: 'rgba(255,218,0,0.7)', background: '#0d0b09', boxShadow: '0 0 12px rgba(255,218,0,0.5), 0 0 4px rgba(255,218,0,0.55)' }} />
                  </div>

                  {/* Card body */}
                  <div className="flex-1 min-w-0 relative rounded-2xl overflow-hidden border border-white/[0.14]"
                    style={{ background: 'linear-gradient(140deg, rgba(255,218,0,0.10) 0%, rgba(28,20,13,0.92) 38%, rgba(12,8,5,0.97) 100%)' }}>
                    {/* Left accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r-full"
                      style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(255,218,0,0.85) 35%, rgba(255,218,0,0.85) 65%, transparent 100%)' }} />
                    {/* Top shimmer line */}
                    <div className="absolute top-0 inset-x-0 h-px opacity-50"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,218,0,0.55), transparent)' }} />

                    <div className={'relative h-full flex items-center gap-3 px-4 py-3' + (i === 0 ? ' bk-card-content' : i === 1 ? ' cf-card-content' : ' pu-card-content')}>
                      {/* Big outlined step number — absolute background watermark, never in flow */}
                      <div className="absolute top-0 right-0 pointer-events-none select-none pr-3 pt-2" aria-hidden="true">
                        <span style={{
                          fontSize: 'clamp(4rem, 16vw, 5.5rem)',
                          color: 'transparent',
                          WebkitTextStroke: '1px #ffda00',
                          letterSpacing: '-0.05em',
                          lineHeight: 1,
                          opacity: 0.18,
                          fontWeight: 900,
                        }}>
                          {step}
                        </span>
                      </div>

                      {/* Icon ring + label + title + desc — full width, above watermark */}
                      <div className="relative flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-secondary-500/[0.1] border border-secondary-500/30">
                            <Icon size={14} className="text-secondary-500" />
                          </div>
                          <p className="text-[9px] font-black text-secondary-500/60 tracking-[0.28em] uppercase">Step {step}</p>
                        </div>
                        <h3 className="font-black text-white text-[0.98rem] leading-tight">{title}</h3>
                        <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">{desc}</p>
                      </div>

                      {/* Bottom-right: tap hint */}
                      <div className="absolute bottom-2 right-3 flex flex-col items-center text-secondary-500/45 pointer-events-none">
                        <ChevronRight size={16} />
                        <span className="text-[7px] tracking-[0.18em] font-black uppercase" style={{ marginTop: '-2px' }}>tap</span>
                      </div>
                    </div>

                    {/* Animation overlays — scoped to this card */}
                    {i === 0 && renderBookOverlay()}
                    {i === 1 && renderConfirmOverlay()}
                    {i === 2 && renderPickupOverlay()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── DESKTOP: tall immersive cards ── */}
          <div className="hidden md:flex gap-5 lg:gap-6 flex-1 min-h-0 items-stretch max-w-5xl mx-auto w-full">
            {HOW_IT_WORKS.flatMap(({ Icon, step, title, desc }, i) => {
              const card = (
                <div key={`step-${i}`} className="step-card group relative flex-1 min-w-0 flex flex-col cursor-pointer" style={{ transformStyle: 'preserve-3d' }} onClick={i === 0 ? playBookAnim : i === 1 ? playConfirmAnim : playPickupAnim}>
                  <div className="relative flex-1 flex flex-col rounded-2xl overflow-hidden border border-white/[0.13] group-hover:border-secondary-500/55 transition-all duration-500"
                    style={{ background: 'linear-gradient(160deg, rgba(255,218,0,0.09) 0%, rgba(28,20,13,0.88) 30%, rgba(12,8,5,0.97) 100%)' }}>

                    {/* Left accent bar — reveals on hover */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-center"
                      style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(255,218,0,0.9) 35%, rgba(255,218,0,0.9) 65%, transparent 100%)' }} />
                    {/* Top shimmer on hover */}
                    <div className="absolute top-0 inset-x-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,218,0,0.7), transparent)' }} />
                    {/* Inner top glow on hover */}
                    <div className="absolute top-0 inset-x-0 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                      style={{ background: 'linear-gradient(to bottom, rgba(255,218,0,0.06), transparent)' }} />

                    <div className={'relative flex flex-col flex-1 p-6 lg:p-8' + (i === 0 ? ' bk-card-content' : i === 1 ? ' cf-card-content' : ' pu-card-content')}>
                      {/* Big outlined step number */}
                      <div className="step-big-num select-none pointer-events-none font-black leading-[0.85] mb-4 lg:mb-6"
                        style={{
                          fontSize: 'clamp(5.5rem, 9vw, 8.5rem)',
                          color: 'transparent',
                          WebkitTextStroke: '1.5px #ffda00',
                          letterSpacing: '-0.04em',
                          opacity: 0.22,
                          filter: 'drop-shadow(0 0 0px rgba(255,218,0,0))',
                        }}>
                        {step}
                      </div>

                      {/* Icon with orbital SVG ring */}
                      <div className="relative mb-5 lg:mb-6" style={{ width: 54, height: 54 }}>
                        <svg className="absolute inset-0" width="54" height="54" viewBox="0 0 54 54" fill="none">
                          <circle cx="27" cy="27" r="24.5" stroke="rgba(255,218,0,0.18)" strokeWidth="1" />
                          <circle
                            className="step-ring-arc"
                            cx="27" cy="27" r="24.5"
                            stroke="rgba(255,218,0,0.6)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeDasharray="153.9"
                            strokeDashoffset="153.9"
                            style={{ transform: 'rotate(-90deg)', transformOrigin: '27px 27px' }}
                          />
                        </svg>
                        <div className="absolute inset-[7px] rounded-full flex items-center justify-center bg-secondary-500/[0.08] border border-secondary-500/[0.2] group-hover:bg-secondary-500 group-hover:border-secondary-500 transition-all duration-500">
                          <Icon size={18} className="text-secondary-500 group-hover:text-primary-950 transition-colors duration-500" />
                        </div>
                      </div>

                      {/* Label */}
                      <p className="text-[10px] font-black text-secondary-500/65 tracking-[0.28em] uppercase mb-2">Step {step}</p>
                      {/* Title */}
                      <h3 className="text-xl lg:text-2xl font-black text-white leading-tight mb-3">{title}</h3>
                      {/* Description */}
                      <p className="text-sm text-gray-300 leading-relaxed flex-1">{desc}</p>

                      {/* Bottom sweep line */}
                      <div className="mt-5 h-px w-0 group-hover:w-full transition-all duration-700 ease-out"
                        style={{ background: 'linear-gradient(90deg, rgba(255,218,0,0.55) 0%, transparent 100%)' }} />
                    </div>

                    {i === 0 && renderBookOverlay()}
                    {i === 1 && renderConfirmOverlay()}
                    {i === 2 && renderPickupOverlay()}
                  </div>
                </div>
              )
              if (i < HOW_IT_WORKS.length - 1) {
                return [card, (
                  <div key={`conn-${i}`} className="step-connector flex items-center justify-center shrink-0 w-9 opacity-0 self-center pb-24">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.25))' }} />
                      <ChevronRight size={14} className="text-secondary-500/35" />
                      <div className="w-px h-8" style={{ background: 'linear-gradient(to top, transparent, rgba(255,218,0,0.25))' }} />
                    </div>
                  </div>
                )]
              }
              return [card]
            })}
          </div>

        </div>
      </section>

      {/* ════════════════════ CTA ════════════════════ */}
      {/* Grouping CTA and Footer to ensure they are treated as one viewport-constrained slide */}
      <div className="last-slide-wrapper min-h-[100dvh] md:h-[100dvh] flex flex-col">
      <section
        className="cta-section flex-1 py-[clamp(0.6rem,1.8svh,2rem)] relative overflow-visible md:overflow-hidden flex flex-col justify-center"
        style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 35%, #110e0c 70%, #0d0b09 100%)' }}
      >
        {/* ── Background layer — radial dot grid (matches steps section) ── */}
        <div className="cta-dot-grid absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.9) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Diagonal accent lines (matches steps section) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="cta-diag-line absolute top-0 left-1/4 w-px h-full" style={{ opacity: 0.06, background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.6) 40%, rgba(255,218,0,0.6) 60%, transparent)' }} />
          <div className="cta-diag-line absolute top-0 left-2/4 w-px h-full" style={{ opacity: 0.06, background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.4) 30%, rgba(255,218,0,0.4) 70%, transparent)' }} />
          <div className="cta-diag-line absolute top-0 left-3/4 w-px h-full" style={{ opacity: 0.06, background: 'linear-gradient(to bottom, transparent, rgba(255,218,0,0.6) 40%, rgba(255,218,0,0.6) 60%, transparent)' }} />
        </div>

        {/* Center glow orb */}
        <div className="cta-glow-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[320px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(255,218,0,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />

        {/* Grain texture (matches tours section) */}
        <div className="absolute inset-0 opacity-[0.022] pointer-events-none select-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '180px' }} />

        {/* Top + bottom border lines (matches steps section) */}
        <div className="cta-edge-line absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,218,0,0.18) 25%, rgba(255,218,0,0.18) 75%, transparent)' }} />
        <div className="cta-edge-line absolute bottom-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,218,0,0.1) 25%, rgba(255,218,0,0.1) 75%, transparent)' }} />

        <div className="container mx-auto px-4 max-[420px]:px-3 text-center relative z-10">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-[clamp(0.38rem,1.1svh,0.85rem)]">
            <p className="cta-item text-secondary-500 font-semibold text-[10px] tracking-[0.22em] uppercase">Ready to travel?</p>
            <h2 className="cta-item text-[clamp(1.35rem,6.5vw,1.9rem)] md:text-5xl font-black text-white leading-[1.1] max-w-[18ch]">
              Your ride awaits at Donyi Polo Airport - Hollongi
            </h2>
            <p className="cta-item text-gray-400 text-[12px] md:text-base max-w-[34ch] mx-auto leading-[1.5]">
              Skip the queue. Pre-book your taxi or tour — verified drivers, transparent pricing.
            </p>
            <div className="cta-item w-full max-w-[360px] flex flex-col sm:flex-row gap-[clamp(0.32rem,0.85svh,0.65rem)] justify-center">
              <Link
                href="/book-taxi"
                className="cta-btn group relative w-full flex items-center justify-center gap-2 px-6 py-[clamp(0.48rem,1.05svh,0.82rem)] bg-secondary-500 text-primary-950 font-black rounded-2xl hover:bg-secondary-400 transition-colors shadow-2xl shadow-secondary-500/25 text-[0.94rem] md:text-base overflow-hidden whitespace-nowrap"
              >
                <span
                  aria-hidden="true"
                  data-cta-shine
                  className="pointer-events-none absolute inset-y-0 -inset-x-4"
                  style={{
                    background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
                    transform: 'translateX(-130%)',
                    mixBlendMode: 'overlay',
                  }}
                />
                <span className="relative flex items-center gap-2">
                  Book Taxi Now
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <Link
                href="/tours"
                className="cta-btn group w-full flex items-center justify-center gap-2 px-6 py-[clamp(0.48rem,1.05svh,0.82rem)] border-2 border-secondary-500/30 text-secondary-500 font-bold rounded-2xl hover:bg-secondary-500/10 hover:border-secondary-500/50 transition-colors text-[0.94rem] md:text-base whitespace-nowrap"
            >
                Explore Tours
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      </div>
    </div>

      {/* ── Section wipe overlay — outside mainRef so fixed positioning is always viewport-relative ── */}
      <svg
        ref={overlaySvgRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 49, top: 0, left: 0 }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Path 0 — yellow bar, leads */}
        <path
          ref={el => { if (el) overlayPathsRef.current[0] = el }}
          fill="#ffda00"
        />
        {/* Path 1 — dark bar, follows with offset */}
        <path
          ref={el => { if (el) overlayPathsRef.current[1] = el }}
          fill="#0d0b09"
        />
      </svg>
    </>
  )
}
