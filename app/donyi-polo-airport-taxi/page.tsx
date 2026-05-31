import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HeroBackground from '@/components/HeroBackground'
import { Car, MapPin, Shield, Clock, CheckCircle, ArrowRight, ChevronRight, Star } from 'lucide-react'
import SmoothScrollWrapper from '@/components/SmoothScrollWrapper'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rinastoursandtravels.in'

export const metadata: Metadata = {
  title: 'Donyi Polo Airport Taxi – Book Cab at Donyi Polo Airport Itanagar',
  description:
    'Book a pre-paid taxi from Donyi Polo Airport (HGI), Itanagar. Reliable airport cab service with fixed fares, verified drivers and instant confirmation. Serving all of Arunachal Pradesh.',
  keywords: [
    'donyi polo airport taxi',
    'donyi polo airport cab',
    'taxi from donyi polo airport',
    'donyi polo airport transfer',
    'HGI airport taxi',
    'itanagar airport taxi',
  ],
  alternates: { canonical: '/donyi-polo-airport-taxi' },
  openGraph: {
    title: 'Donyi Polo Airport Taxi – Fixed Fare Cab Booking',
    description: 'Pre-book taxi from Donyi Polo Airport (HGI) to Itanagar or anywhere in Arunachal Pradesh. Verified drivers, transparent fares.',
    url: `${SITE_URL}/donyi-polo-airport-taxi`,
  },
}

const FAQ_ITEMS = [
  {
    q: 'What is Donyi Polo Airport?',
    a: 'Donyi Polo Airport is the commercial airport serving Itanagar, capital of Arunachal Pradesh. Located in Hollongi, it carries the IATA code HGI and is named after the indigenous Donyi-Polo (sun and moon) faith.',
  },
  {
    q: 'How do I book a taxi at Donyi Polo Airport?',
    a: "Pre-book through our website before your flight. Select Airport booking, enter Donyi Polo Airport as pickup, add your destination and arrival time, choose a vehicle, and confirm. Your driver will be at arrivals when you land.",
  },
  {
    q: 'How far is Donyi Polo Airport from Itanagar city?',
    a: 'Donyi Polo Airport is approximately 25 km from Itanagar city centre — about 45–60 minutes by road.',
  },
  {
    q: 'Are taxis available at Donyi Polo Airport without advance booking?',
    a: 'Walk-in taxi availability can be limited, especially outside peak hours. Advance booking ensures a confirmed cab waiting at arrivals.',
  },
  {
    q: 'What is the fare from Donyi Polo Airport to Itanagar?',
    a: 'Fixed fares for all destinations are shown at the time of booking. Use the Book Taxi page to see the exact fare for your route.',
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
  name: "Donyi Polo Airport Taxi – Rina's Tours and Travels",
  provider: { '@type': 'LocalBusiness', name: "Rina's Tours and Travels", url: SITE_URL },
  areaServed: { '@type': 'State', name: 'Arunachal Pradesh' },
  serviceType: 'Airport Taxi',
  url: `${SITE_URL}/donyi-polo-airport-taxi`,
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Donyi Polo Airport Taxi', item: `${SITE_URL}/donyi-polo-airport-taxi` },
  ],
}

export default function DonyiPoloAirportTaxiPage() {
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
                <span className="text-gray-400">Donyi Polo Airport Taxi</span>
              </nav>
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary-500/25 bg-secondary-500/[0.08] text-secondary-400 text-xs font-semibold tracking-widest uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" />
                  Donyi Polo Airport (HGI) · Itanagar
                </div>
                <h1 className="font-black leading-[0.95] tracking-tight mb-5">
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-white">Donyi Polo Airport</span>
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-secondary-500">Taxi Booking</span>
                </h1>
                <p className="text-gray-400 text-sm md:text-base mb-7 leading-relaxed max-w-lg">
                  Book a reliable cab from <strong className="text-white">Donyi Polo Airport (IATA: HGI)</strong> to Itanagar or any point in Arunachal Pradesh. Fixed fares, verified drivers, instant confirmation.
                </p>
                <div className="flex flex-wrap gap-3 mb-6">
                  <Link
                    href="/book-taxi"
                    className="group flex items-center gap-2.5 px-6 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 active:scale-[0.97] transition-all shadow-2xl shadow-secondary-500/25 text-sm md:text-base"
                  >
                    Book Donyi Polo Airport Taxi
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/tours"
                    className="group flex items-center gap-2.5 px-6 py-3 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/[0.07] hover:border-white/35 transition-all text-sm md:text-base"
                  >
                    See Tour Packages
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { Icon: CheckCircle, label: 'Fixed Fares' },
                    { Icon: Shield, label: 'Verified Drivers' },
                    { Icon: Star, label: '4.8★ Rated' },
                    { Icon: Clock, label: 'On-Time Pickup' },
                  ].map(({ Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-gray-300 text-xs">
                      <Icon size={11} className="text-secondary-500" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Services ── */}
          <section className="py-14 md:py-20" style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 35%, #110e0c 70%, #0d0b09 100%)' }}>
            <div className="container mx-auto px-4">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Our Services</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">At Donyi Polo Airport</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
                {[
                  { Icon: Car, title: 'Airport Taxi', desc: 'Pre-book cab from Donyi Polo Airport to your destination. Fixed price, driver confirmed.', link: '/book-taxi', cta: 'Book Taxi' },
                  { Icon: MapPin, title: 'Arunachal Tours', desc: 'Arrive at HGI and head straight into your Arunachal adventure with a curated tour.', link: '/tours', cta: 'View Tours' },
                ].map(({ Icon, title, desc, link, cta }) => (
                  <div key={title} className="p-6 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 hover:bg-primary-900/70 transition-all duration-300 flex flex-col">
                    <div className="w-11 h-11 rounded-2xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center mb-4">
                      <Icon size={18} className="text-secondary-500" />
                    </div>
                    <h3 className="font-black text-white mb-2">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed flex-1 mb-4">{desc}</p>
                    <Link href={link} className="inline-flex items-center gap-1.5 text-secondary-500 hover:text-secondary-400 font-semibold text-sm transition-colors">
                      {cta} <ArrowRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQs ── */}
          <section className="py-14 md:py-20 bg-primary-950 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.8) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
            <div className="container mx-auto px-4 relative z-10">
              <div className="max-w-3xl mx-auto">
                <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3">Support</p>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-8">Common Questions</h2>
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
              <p className="text-primary-800 font-semibold text-xs tracking-[0.22em] uppercase mb-2">Landing at Donyi Polo?</p>
              <h2 className="text-3xl md:text-4xl font-black text-primary-950 mb-3">Your taxi is confirmed before you land</h2>
              <p className="text-primary-800 text-sm md:text-base mb-7 max-w-md mx-auto">Book now and step off the plane knowing your ride is ready.</p>
              <Link href="/book-taxi" className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-primary-950 text-white font-black rounded-2xl hover:bg-primary-900 transition-all shadow-2xl shadow-primary-950/25">
                Book Airport Taxi <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </section>

          {/* ── Related ── */}
          <section className="py-8 border-t border-primary-800 bg-primary-950">
            <div className="container mx-auto px-4">
              <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold mb-4 text-center">Related Services</p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { href: '/hollongi-airport-taxi', label: 'Hollongi Airport Taxi' },
                  { href: '/itanagar-airport-taxi', label: 'Itanagar Airport Taxi' },
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
