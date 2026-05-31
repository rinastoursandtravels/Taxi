import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HeroBackground from '@/components/HeroBackground'
import { MapPin, Shield, Clock, CheckCircle, ArrowRight, ChevronRight, Users } from 'lucide-react'
import SmoothScrollWrapper from '@/components/SmoothScrollWrapper'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rinastoursandtravels.in'

export const metadata: Metadata = {
  title: 'Itanagar Airport Taxi – Cab Service at Donyi Polo Airport',
  description:
    'Looking for a taxi at Itanagar airport? Pre-book your cab at Donyi Polo Airport (HGI), Hollongi. Fixed fares, verified drivers, all routes across Arunachal Pradesh. Book online in 2 minutes.',
  keywords: [
    'itanagar airport taxi',
    'airport taxi itanagar',
    'taxi at itanagar airport',
    'airport cab itanagar',
    'airport transfer itanagar',
    'airport pickup itanagar',
  ],
  alternates: { canonical: '/itanagar-airport-taxi' },
  openGraph: {
    title: 'Itanagar Airport Taxi – Donyi Polo Airport Cab Service',
    description: "Pre-book your taxi at Itanagar's Donyi Polo Airport. Fixed fares, verified drivers, all Arunachal Pradesh destinations.",
    url: `${SITE_URL}/itanagar-airport-taxi`,
  },
}

const FAQ_ITEMS = [
  {
    q: 'Is there a pre-paid taxi counter at Itanagar airport?',
    a: "There is no official government prepaid counter at Donyi Polo Airport. By pre-booking through our platform you get the equivalent — a confirmed cab at a fixed fare waiting at arrivals. No haggling, no uncertainty.",
  },
  {
    q: 'How do I book a taxi at Itanagar airport?',
    a: 'Visit our Book Taxi page, select Airport booking, set Donyi Polo Airport / Hollongi as pickup, enter your destination and arrival time, select your vehicle, and pay. Your driver will be waiting when you land.',
  },
  {
    q: 'What is the taxi fare from Itanagar airport to the city?',
    a: 'Fares depend on your destination and vehicle type. Use the Book Taxi page for an exact upfront price. All fares are fixed — no meters, no negotiation.',
  },
  {
    q: 'Are taxis available at night at Donyi Polo Airport?',
    a: 'Pre-booked taxis are available for all arrival times including late-night and early-morning flights. Advance booking is strongly recommended during off-peak hours.',
  },
  {
    q: 'Can I book a larger vehicle at Itanagar airport?',
    a: 'Yes — SUVs for up to 6–7 passengers are available. Select your vehicle size during booking and pricing is shown before you confirm.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'TaxiService',
  name: "Itanagar Airport Taxi Service – Rina's Tours and Travels",
  provider: { '@type': 'LocalBusiness', name: "Rina's Tours and Travels", url: SITE_URL },
  areaServed: { '@type': 'State', name: 'Arunachal Pradesh' },
  serviceType: 'Airport Taxi',
  url: `${SITE_URL}/itanagar-airport-taxi`,
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Itanagar Airport Taxi', item: `${SITE_URL}/itanagar-airport-taxi` },
  ],
}

export default function ItanagarAirportTaxiPage() {
  return (
    <>
      <SmoothScrollWrapper>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="min-h-[100dvh] flex flex-col">
        <Header />

        <main className="flex-1">

          {/* ── Hero ── */}
          <section className="relative bg-primary-950 overflow-hidden pt-24 pb-32 md:pt-32 md:pb-40">
            <HeroBackground />
            <div className="container mx-auto px-4 lg:px-8 relative z-10">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
                <Link href="/" className="hover:text-secondary-500 transition-colors">Home</Link>
                <ChevronRight size={12} />
                <span className="text-gray-400">Itanagar Airport Taxi</span>
              </nav>
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary-500/25 bg-secondary-500/[0.08] text-secondary-400 text-xs font-semibold tracking-widest uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" />
                  Itanagar · Donyi Polo Airport (HGI)
                </div>
                <h1 className="font-black leading-[0.95] tracking-tight mb-5">
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-white">Itanagar Airport</span>
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-secondary-500">Taxi Service</span>
                </h1>
                <p className="text-gray-400 text-sm md:text-base mb-7 leading-relaxed max-w-lg">
                  Need a cab at <strong className="text-white">Itanagar's Donyi Polo Airport</strong>? Pre-book online — driver confirmed, fare fixed, no surprises when you land.
                </p>
                <div className="flex flex-wrap gap-3 mb-6">
                  <Link
                    href="/book-taxi"
                    className="group flex items-center gap-2.5 px-6 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 active:scale-[0.97] transition-all shadow-2xl shadow-secondary-500/25 text-sm md:text-base"
                  >
                    Book Airport Taxi
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="/faq" className="group flex items-center gap-2.5 px-6 py-3 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/[0.07] hover:border-white/35 transition-all text-sm md:text-base">
                    Read FAQs
                  </Link>
                </div>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg">
                  {[
                    { value: '25 km', label: 'Airport to city' },
                    { value: '45–60 min', label: 'Typical drive' },
                    { value: '24/7', label: 'Pre-book coverage' },
                    { value: 'Fixed', label: 'Transparent fares' },
                  ].map(({ value, label }) => (
                    <div key={label} className="text-center p-3 rounded-xl bg-primary-900/50 border border-primary-800">
                      <div className="text-secondary-500 font-black text-base leading-none mb-1">{value}</div>
                      <div className="text-gray-500 text-[11px]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Why pre-book ── */}
          <section className="py-14 md:py-20" style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 35%, #110e0c 70%, #0d0b09 100%)' }}>
            <div className="container mx-auto px-4">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Why Pre-Book</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">Confirmed Before You Land</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
                {[
                  { Icon: CheckCircle, title: 'Driver at arrivals', desc: 'Your confirmed driver waits — no searching for a cab after a long flight.' },
                  { Icon: Shield, title: 'No last-minute pricing', desc: 'Fares are locked at booking. What you see is exactly what you pay.' },
                  { Icon: Users, title: 'Right vehicle for your group', desc: 'Choose the right size for 1–8 passengers at the time of booking.' },
                  { Icon: Clock, title: 'Flight-adjusted timing', desc: 'Your driver monitors your flight for delays so pickup is always on time.' },
                ].map(({ Icon, title, desc }) => (
                  <div key={title} className="flex gap-4 p-5 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-secondary-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-white mb-1">{title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Popular routes ── */}
          <section className="py-14 md:py-20 bg-primary-950 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.8) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
            <div className="container mx-auto px-4 relative z-10">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Routes</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">Popular Routes from Itanagar Airport</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {[
                  { to: 'Itanagar City Centre', detail: '~25 km · 45–60 min' },
                  { to: 'Naharlagun', detail: '~20 km · 35–50 min' },
                  { to: 'Nirjuli', detail: '~15 km · 25–35 min' },
                  { to: 'Banderdewa', detail: '~10 km · 20–30 min' },
                  { to: 'North Lakhimpur (Assam)', detail: 'Cross-state route' },
                  { to: 'Custom Destination', detail: 'Enter any location at booking' },
                ].map(({ to, detail }) => (
                  <Link key={to} href="/book-taxi" className="group p-4 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 hover:bg-primary-900/70 transition-all duration-300">
                    <div className="flex items-start gap-2 mb-1.5">
                      <MapPin size={13} className="text-secondary-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[11px] text-gray-500">Donyi Polo Airport →</div>
                        <div className="text-white font-black text-sm group-hover:text-secondary-400 transition-colors">{to}</div>
                      </div>
                    </div>
                    <div className="text-gray-500 text-xs pl-5">{detail}</div>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-10">
                <Link href="/book-taxi" className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-all shadow-2xl shadow-secondary-500/25">
                  See Fare for Your Route <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── FAQs ── */}
          <section className="py-14 md:py-20" style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 50%, #0d0b09 100%)' }}>
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto">
                <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3">Support</p>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-8">Questions Answered</h2>
                <div className="space-y-4">
                  {FAQ_ITEMS.map((item, idx) => (
                    <details key={idx} className="group bg-primary-900/40 border border-primary-800 rounded-2xl p-5" open={idx === 0}>
                      <summary className="flex items-center justify-between cursor-pointer list-none text-white font-semibold">
                        <span>{item.q}</span>
                        <span className="ml-3 text-gray-400 transition-transform group-open:rotate-45 shrink-0">+</span>
                      </summary>
                      <p className="mt-3 text-gray-400 leading-relaxed text-sm">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="py-14 md:py-20 bg-secondary-500 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #1a1512 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }} />
            <div className="container mx-auto px-4 text-center relative z-10">
              <p className="text-primary-800 font-semibold text-xs tracking-[0.22em] uppercase mb-2">Ready to travel?</p>
              <h2 className="text-3xl md:text-4xl font-black text-primary-950 mb-3">Your ride awaits at Hollongi</h2>
              <p className="text-primary-800 text-sm md:text-base mb-7 max-w-md mx-auto">Skip the queue. Pre-book your taxi — verified drivers, transparent pricing.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/book-taxi" className="group flex items-center justify-center gap-2.5 px-6 py-3 bg-primary-950 text-white font-black rounded-2xl hover:bg-primary-900 transition-all shadow-2xl shadow-primary-950/25">
                  Book Taxi Now <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/tours" className="flex items-center justify-center gap-2.5 px-6 py-3 border-2 border-primary-950/20 text-primary-950 font-bold rounded-2xl hover:bg-primary-950/[0.07] transition-all">
                  Explore Tours
                </Link>
              </div>
            </div>
          </section>

          {/* ── Related ── */}
          <section className="py-8 border-t border-primary-800 bg-primary-950">
            <div className="container mx-auto px-4">
              <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold mb-4 text-center">Related Services</p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { href: '/hollongi-airport-taxi', label: 'Hollongi Airport Taxi' },
                  { href: '/donyi-polo-airport-taxi', label: 'Donyi Polo Airport Taxi' },
                  { href: '/itanagar-tours', label: 'Itanagar Tours' },
                  { href: '/arunachal-tours', label: 'Arunachal Tours' },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} className="px-4 py-2 rounded-xl border border-primary-700 text-gray-400 hover:border-secondary-500/40 hover:text-secondary-400 transition-colors text-sm">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

        </main>
        <Footer />
      </div>
      </SmoothScrollWrapper>
    </>
  )
}
