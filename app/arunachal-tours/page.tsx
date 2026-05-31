import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HeroBackground from '@/components/HeroBackground'
import { MapPin, Clock, Users, Star, ArrowRight, ChevronRight, CheckCircle, Shield } from 'lucide-react'
import SmoothScrollWrapper from '@/components/SmoothScrollWrapper'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rinastoursandtravels.in'

export const metadata: Metadata = {
  title: 'Arunachal Pradesh Tours – Book Tour Packages from Itanagar',
  description:
    'Explore Arunachal Pradesh with curated tour packages. Book sightseeing tours, day trips, and multi-day itineraries from Itanagar. Verified drivers, all-inclusive pricing.',
  keywords: [
    'arunachal pradesh tours',
    'arunachal tours',
    'tour packages arunachal pradesh',
    'arunachal travel booking',
    'tour booking arunachal pradesh',
    'travel agency itanagar',
    'sightseeing arunachal pradesh',
  ],
  alternates: { canonical: '/arunachal-tours' },
  openGraph: {
    title: 'Arunachal Pradesh Tours – Curated Packages from Itanagar',
    description: 'Book curated tour packages across Arunachal Pradesh. Day trips, sightseeing, and multi-day itineraries with verified drivers.',
    url: `${SITE_URL}/arunachal-tours`,
  },
}

const FAQ_ITEMS = [
  {
    q: 'What are the best places to visit in Arunachal Pradesh?',
    a: "Arunachal Pradesh is home to Tawang (Buddhist monastery), Ziro Valley (UNESCO tentative list), Namdapha National Park, Mechuka, Bomdila, and Itanagar Wildlife Sanctuary. Our packages cover the most accessible highlights from Itanagar.",
  },
  {
    q: 'Do I need an Inner Line Permit (ILP) to visit Arunachal Pradesh?',
    a: 'Indian nationals require an Inner Line Permit (ILP) to enter Arunachal Pradesh. Foreign nationals need a Protected Area Permit (PAP). Our team can guide you through the process.',
  },
  {
    q: 'What is the best time to visit Arunachal Pradesh?',
    a: 'October to April is generally the most pleasant. Winters (November–February) are cold but clear, ideal for trekking. Summers (March–April) are warmer with blooming rhododendrons.',
  },
  {
    q: 'Are the tour packages customisable?',
    a: 'Yes — all packages can be tailored. Contact us at support@rinastoursandtravels.in with your preferred dates, group size, and destinations.',
  },
  {
    q: 'What is included in the tour packages?',
    a: 'Inclusions vary by tour — typically transport with a verified driver, sightseeing stops per itinerary, and transparent pricing. Check individual tour pages for full details.',
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

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Arunachal Pradesh Tours', item: `${SITE_URL}/arunachal-tours` },
  ],
}

const HIGHLIGHTS = [
  { Icon: MapPin, title: 'Diverse Destinations', desc: "From Sela Pass to Ziro Valley, our packages cover the breadth of Arunachal's landscapes and cultures." },
  { Icon: CheckCircle, title: 'Verified Drivers', desc: 'All drivers are registered, vetted, and familiar with mountain roads in Arunachal Pradesh.' },
  { Icon: Users, title: 'Small Groups', desc: 'Most tours accommodate small groups for a more personal, immersive experience.' },
  { Icon: Clock, title: 'Flexible Itineraries', desc: 'Day trips, weekend packages, and extended multi-day itineraries available.' },
  { Icon: Star, title: 'Local Knowledge', desc: "Routes curated by locals who know Arunachal's best viewpoints, eateries, and hidden gems." },
  { Icon: Shield, title: 'Transparent Pricing', desc: 'Full package price shown upfront. No surprise charges during or after the tour.' },
]

export default function ArunachalToursPage() {
  return (
    <>
      <SmoothScrollWrapper>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
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
                <span className="text-gray-400">Arunachal Pradesh Tours</span>
              </nav>
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary-500/25 bg-secondary-500/[0.08] text-secondary-400 text-xs font-semibold tracking-widest uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" />
                  Arunachal Pradesh · Itanagar
                </div>
                <h1 className="font-black leading-[0.95] tracking-tight mb-5">
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-white">Arunachal Pradesh</span>
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-secondary-500">Tour Packages</span>
                </h1>
                <p className="text-gray-400 text-sm md:text-base mb-7 leading-relaxed max-w-lg">
                  Discover the valleys, monasteries, and wilderness of <strong className="text-white">Arunachal Pradesh</strong> with curated tours from Itanagar. Local drivers, seamless transport, memorable experiences.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/tours"
                    className="group flex items-center gap-2.5 px-6 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 active:scale-[0.97] transition-all shadow-2xl shadow-secondary-500/25 text-sm md:text-base"
                  >
                    Browse Tour Packages
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="/book-taxi" className="group flex items-center gap-2.5 px-6 py-3 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/[0.07] hover:border-white/35 transition-all text-sm md:text-base">
                    Book Airport Taxi
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── Highlights ── */}
          <section className="py-14 md:py-20" style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 35%, #110e0c 70%, #0d0b09 100%)' }}>
            <div className="container mx-auto px-4">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Top Packages</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">What Sets Our Tours Apart</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
                {HIGHLIGHTS.map(({ Icon, title, desc }) => (
                  <div key={title} className="p-6 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 hover:bg-primary-900/70 transition-all duration-300">
                    <div className="w-11 h-11 rounded-2xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center mb-4">
                      <Icon size={18} className="text-secondary-500" />
                    </div>
                    <h3 className="font-black text-white mb-1.5">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Destinations ── */}
          <section className="py-14 md:py-20 bg-primary-950 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.8) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
            <div className="container mx-auto px-4 relative z-10">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Explore</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">Popular Destinations</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
                {['Itanagar', 'Tawang', 'Ziro Valley', 'Bomdila', 'Mechuka', 'Namdapha', 'Pasighat', 'Aalo (Along)', 'Roing', 'Dirang', 'Sangti Valley', 'Sela Pass'].map((dest) => (
                  <div key={dest} className="flex items-center gap-2 p-3 rounded-xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 transition-all duration-300">
                    <MapPin size={12} className="text-secondary-500 shrink-0" />
                    <span className="text-gray-300 text-sm font-medium">{dest}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-600 text-xs text-center mt-5">Availability depends on permit requirements and road conditions for some destinations.</p>
            </div>
          </section>

          {/* ── FAQs ── */}
          <section className="py-14 md:py-20" style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 50%, #0d0b09 100%)' }}>
            <div className="container mx-auto px-4">
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
              <p className="text-primary-800 font-semibold text-xs tracking-[0.22em] uppercase mb-2">Ready to explore?</p>
              <h2 className="text-3xl md:text-4xl font-black text-primary-950 mb-3">Your Arunachal adventure starts here</h2>
              <p className="text-primary-800 text-sm md:text-base mb-7 max-w-md mx-auto">Browse our tour packages and book the one that matches your itinerary.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/tours" className="group flex items-center justify-center gap-2.5 px-6 py-3 bg-primary-950 text-white font-black rounded-2xl hover:bg-primary-900 transition-all shadow-2xl shadow-primary-950/25">
                  View Tour Packages <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/book-taxi" className="flex items-center justify-center gap-2.5 px-6 py-3 border-2 border-primary-950/20 text-primary-950 font-bold rounded-2xl hover:bg-primary-950/[0.07] transition-all">
                  Book Airport Taxi
                </Link>
              </div>
            </div>
          </section>

          {/* ── Related ── */}
          <section className="py-8 border-t border-primary-800 bg-primary-950">
            <div className="container mx-auto px-4">
              <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold mb-4 text-center">Related</p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { href: '/itanagar-tours', label: 'Itanagar Tours' },
                  { href: '/hollongi-airport-taxi', label: 'Hollongi Airport Taxi' },
                  { href: '/donyi-polo-airport-taxi', label: 'Donyi Polo Airport Taxi' },
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
