import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HeroBackground from '@/components/HeroBackground'
import { MapPin, Clock, Users, ArrowRight, ChevronRight, CheckCircle, Star } from 'lucide-react'
import SmoothScrollWrapper from '@/components/SmoothScrollWrapper'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rinastoursandtravels.in'

export const metadata: Metadata = {
  title: 'Itanagar Tours & Sightseeing – Local Tour Packages Itanagar',
  description:
    'Book local sightseeing tours and day trips in Itanagar, Arunachal Pradesh. Explore Ita Fort, Buddhist temples, Ganga Lake and more. Verified drivers, transparent pricing.',
  keywords: [
    'itanagar tours',
    'sightseeing itanagar',
    'local tours itanagar',
    'itanagar sightseeing packages',
    'day trips itanagar',
    'itanagar tourist places',
    'tour packages itanagar',
  ],
  alternates: { canonical: '/itanagar-tours' },
  openGraph: {
    title: 'Itanagar Tours & Sightseeing – Local Packages',
    description: "Explore Itanagar's top sights with curated local tours. Ita Fort, Buddhist temples, wildlife sanctuary and more.",
    url: `${SITE_URL}/itanagar-tours`,
  },
}

const FAQ_ITEMS = [
  {
    q: "What are the top tourist attractions in Itanagar?",
    a: "Itanagar's top attractions include Ita Fort (14th century), the Buddha Temple, Ganga Lake (Gekar Sinyi), the State Museum, Nehru Museum, Craft Centre, and Itanagar Wildlife Sanctuary.",
  },
  {
    q: 'How long does an Itanagar sightseeing tour take?',
    a: 'A half-day tour covers the main highlights in around 4–5 hours. A full-day tour allows you to explore at a relaxed pace with more stops. Both options are available — check our Tours page.',
  },
  {
    q: 'Can I book a private sightseeing tour in Itanagar?',
    a: 'Yes — all our Itanagar tours are private. The vehicle and driver are exclusively for your group with no shared buses or fixed group schedules.',
  },
  {
    q: 'Are Itanagar tours available for families with children?',
    a: 'Absolutely. We offer family-friendly options with appropriate vehicles. Let us know your group size during booking and we will match you with the right vehicle.',
  },
  {
    q: 'Can I combine an airport taxi with an Itanagar tour?',
    a: 'Yes — many visitors book an airport taxi from Donyi Polo Airport (Hollongi) and then a sightseeing tour for the following day. Both services are available through our platform.',
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
    { '@type': 'ListItem', position: 2, name: 'Itanagar Tours', item: `${SITE_URL}/itanagar-tours` },
  ],
}

const SIGHTS = [
  { name: 'Ita Fort', desc: 'A 14th-century fort whose brick ruins give Itanagar its name.' },
  { name: 'Buddha Temple', desc: 'A large Buddhist monastery with a golden statue overlooking the capital.' },
  { name: 'Ganga Lake', desc: 'Scenic lake surrounded by forest, popular for picnics and birdwatching.' },
  { name: 'State Museum', desc: 'Exhibits on tribal heritage, costumes, and Arunachal Pradesh history.' },
  { name: 'Craft Centre', desc: 'Browse bamboo products and handwoven textiles by local artisans.' },
  { name: 'Wildlife Sanctuary', desc: 'Forest reserve home to elephants, deer, and diverse bird species.' },
]

export default function ItanagarToursPage() {
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
                <span className="text-gray-400">Itanagar Tours</span>
              </nav>
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary-500/25 bg-secondary-500/[0.08] text-secondary-400 text-xs font-semibold tracking-widest uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" />
                  Itanagar · Arunachal Pradesh
                </div>
                <h1 className="font-black leading-[0.95] tracking-tight mb-5">
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-white">Itanagar Tours &</span>
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-secondary-500">Sightseeing</span>
                </h1>
                <p className="text-gray-400 text-sm md:text-base mb-7 leading-relaxed max-w-lg">
                  Explore <strong className="text-white">Itanagar's</strong> cultural heritage, natural landscapes, and tribal history with private day tours. Local drivers, curated routes, real experiences.
                </p>
                <div className="flex flex-wrap gap-3 mb-6">
                  <Link
                    href="/tours"
                    className="group flex items-center gap-2.5 px-6 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 active:scale-[0.97] transition-all shadow-2xl shadow-secondary-500/25 text-sm md:text-base"
                  >
                    Browse Itanagar Tours
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="/arunachal-tours" className="group flex items-center gap-2.5 px-6 py-3 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/[0.07] hover:border-white/35 transition-all text-sm md:text-base">
                    All Arunachal Tours
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { Icon: CheckCircle, label: 'Private Tours' },
                    { Icon: Users, label: 'All Group Sizes' },
                    { Icon: Star, label: 'Local Drivers' },
                    { Icon: Clock, label: 'Half-Day & Full-Day' },
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

          {/* ── Top sights ── */}
          <section className="py-14 md:py-20" style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 35%, #110e0c 70%, #0d0b09 100%)' }}>
            <div className="container mx-auto px-4">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Top Packages</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">Itanagar's Top Sightseeing Spots</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
                {SIGHTS.map(({ name, desc }) => (
                  <div key={name} className="p-6 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 hover:bg-primary-900/70 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin size={14} className="text-secondary-500 shrink-0" />
                      <h3 className="font-black text-white">{name}</h3>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── How to book ── */}
          <section className="py-14 md:py-20 bg-primary-950 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.8) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
            <div className="container mx-auto px-4 relative z-10">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Simple Process</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">How to Book an Itanagar Tour</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                {[
                  { step: '01', title: 'Browse Packages', desc: 'Visit our Tours page to explore available Itanagar sightseeing packages.' },
                  { step: '02', title: 'Select & Customise', desc: 'Choose your package, set your date, group size, and any requirements.' },
                  { step: '03', title: 'Pay Securely', desc: 'Complete payment via UPI or card. Instant confirmation by email.' },
                  { step: '04', title: 'Meet Your Driver', desc: 'Your driver meets you at the scheduled time, ready for the day.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="p-5 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 transition-all duration-300">
                    <span className="text-4xl font-black text-secondary-500/20 leading-none block mb-3">{step}</span>
                    <h3 className="font-black text-white mb-1.5">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-10">
                <Link href="/tours" className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-all shadow-2xl shadow-secondary-500/25">
                  Explore Tour Packages <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
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
              <h2 className="text-3xl md:text-4xl font-black text-primary-950 mb-3">Discover Itanagar your way</h2>
              <p className="text-primary-800 text-sm md:text-base mb-7 max-w-md mx-auto">Private tours, local drivers, and your own pace across Itanagar's best spots.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/tours" className="group flex items-center justify-center gap-2.5 px-6 py-3 bg-primary-950 text-white font-black rounded-2xl hover:bg-primary-900 transition-all shadow-2xl shadow-primary-950/25">
                  View Tour Packages <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
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
                  { href: '/arunachal-tours', label: 'Arunachal Pradesh Tours' },
                  { href: '/hollongi-airport-taxi', label: 'Hollongi Airport Taxi' },
                  { href: '/faq', label: 'FAQ' },
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
