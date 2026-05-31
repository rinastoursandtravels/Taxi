import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HeroBackground from '@/components/HeroBackground'
import { Car, MapPin, Shield, Clock, CheckCircle, ArrowRight, ChevronRight } from 'lucide-react'
import SmoothScrollWrapper from '@/components/SmoothScrollWrapper'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rinastoursandtravels.in'

export const metadata: Metadata = {
  title: 'Hollongi Airport Taxi Service – Book Cab from Hollongi Airport',
  description:
    'Book a taxi from Hollongi Airport to any destination in Arunachal Pradesh. Pre-book your airport cab online — verified drivers, fixed pricing, no hidden charges. Serving Itanagar & beyond.',
  keywords: [
    'hollongi airport taxi',
    'taxi from hollongi airport',
    'hollongi airport cab',
    'cab from hollongi airport',
    'taxi booking hollongi',
    'airport pickup hollongi',
  ],
  alternates: { canonical: '/hollongi-airport-taxi' },
  openGraph: {
    title: 'Hollongi Airport Taxi – Book Your Cab Online',
    description: 'Pre-book taxi from Hollongi Airport to Itanagar or any destination in Arunachal Pradesh. Fixed pricing, verified drivers.',
    url: `${SITE_URL}/hollongi-airport-taxi`,
  },
}

const FAQ_ITEMS = [
  {
    q: 'Is taxi service available at Hollongi Airport round the clock?',
    a: 'Pre-booked taxis through our platform are available for all flight arrival times, including early-morning and late-night flights. We recommend booking in advance to ensure your cab is waiting at arrivals.',
  },
  {
    q: 'How far is Hollongi Airport from Itanagar city centre?',
    a: 'Donyi Polo Airport at Hollongi is approximately 25 km from Itanagar city centre. The drive typically takes 45–60 minutes depending on traffic.',
  },
  {
    q: 'How do I find my driver after landing at Hollongi?',
    a: 'After you complete your booking, your driver details are shared by email and in your account. Your driver will be at the arrivals area with your name displayed.',
  },
  {
    q: 'Can I book a taxi from Hollongi Airport to any location in Arunachal Pradesh?',
    a: 'Yes — we serve destinations across Arunachal Pradesh from Hollongi Airport. Enter your destination during booking and you will see the fixed price before confirming.',
  },
  {
    q: 'What payment methods are accepted for Hollongi airport taxi?',
    a: 'We accept UPI, credit cards, and debit cards. Pricing is shown upfront with no surprise charges.',
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
  name: 'Hollongi Airport Taxi Service',
  provider: { '@type': 'LocalBusiness', name: "Rina's Tours and Travels", url: SITE_URL },
  areaServed: { '@type': 'State', name: 'Arunachal Pradesh' },
  serviceType: 'Airport Taxi',
  url: `${SITE_URL}/hollongi-airport-taxi`,
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Hollongi Airport Taxi', item: `${SITE_URL}/hollongi-airport-taxi` },
  ],
}

const FEATURES = [
  { Icon: CheckCircle, title: 'Pre-Book Online', desc: 'Reserve your cab before you land — no waiting, no uncertainty at the airport.' },
  { Icon: Shield, title: 'Verified Drivers', desc: 'All drivers are vetted and registered. Your safety is our priority.' },
  { Icon: MapPin, title: 'Fixed Pricing', desc: 'See the full fare before you confirm. No meters, no surprises.' },
  { Icon: Clock, title: 'On-Time Pickup', desc: 'Drivers track your flight and adjust for early or late arrivals.' },
  { Icon: Car, title: 'Multiple Vehicles', desc: 'Sedans, SUVs, and larger vehicles to match your group size.' },
  { Icon: ArrowRight, title: 'All Destinations', desc: 'Hollongi to anywhere in Arunachal Pradesh — city, hills, or interior.' },
]

export default function HollongiAirportTaxiPage() {
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
                <span className="text-gray-400">Hollongi Airport Taxi</span>
              </nav>
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary-500/25 bg-secondary-500/[0.08] text-secondary-400 text-xs font-semibold tracking-widest uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" />
                  Hollongi Airport · Donyi Polo Airport
                </div>
                <h1 className="font-black leading-[0.95] tracking-tight mb-5">
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-white">Hollongi Airport</span>
                  <span className="block text-4xl md:text-5xl lg:text-6xl text-secondary-500">Taxi Service</span>
                </h1>
                <p className="text-gray-400 text-sm md:text-base mb-7 leading-relaxed max-w-lg">
                  Pre-book your cab from <strong className="text-white">Donyi Polo Airport (Hollongi)</strong> to Itanagar or anywhere in Arunachal Pradesh. Fixed pricing, verified drivers — your ride confirmed before you land.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/book-taxi"
                    className="group flex items-center gap-2.5 px-6 py-3 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 active:scale-[0.97] transition-all shadow-2xl shadow-secondary-500/25 text-sm md:text-base"
                  >
                    Book Airport Taxi Now
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/tours"
                    className="group flex items-center gap-2.5 px-6 py-3 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/[0.07] hover:border-white/35 transition-all text-sm md:text-base"
                  >
                    Explore Tours
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section className="py-14 md:py-20" style={{ background: 'linear-gradient(160deg, #16120f 0%, #1c1410 35%, #110e0c 70%, #0d0b09 100%)' }}>
            <div className="container mx-auto px-4">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Why Book With Us</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">
                Reliable Hollongi Airport Taxis
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
                {FEATURES.map(({ Icon, title, desc }, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 hover:bg-primary-900/70 transition-all duration-300">
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

          {/* ── How it works ── */}
          <section className="py-14 md:py-20 bg-primary-950 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,218,0,0.8) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
            <div className="container mx-auto px-4 relative z-10">
              <p className="text-secondary-500 font-semibold text-xs tracking-[0.22em] uppercase mb-3 text-center">Simple Process</p>
              <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-12">How to Book</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                {[
                  { step: '01', title: 'Open Book Taxi', desc: 'Select Airport booking and set Hollongi as pickup.' },
                  { step: '02', title: 'Enter Details', desc: 'Add your destination, arrival time, and passengers.' },
                  { step: '03', title: 'Choose Vehicle', desc: 'Pick sedan or SUV — price shown before confirming.' },
                  { step: '04', title: 'Pay & Confirm', desc: 'Instant confirmation with your driver\'s details.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="p-5 rounded-2xl bg-primary-900/40 border border-primary-800 hover:border-secondary-500/30 transition-all duration-300">
                    <span className="text-4xl font-black text-secondary-500/20 leading-none block mb-3">{step}</span>
                    <h3 className="font-black text-white mb-1.5">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-10">
                <Link
                  href="/book-taxi"
                  className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-all shadow-2xl shadow-secondary-500/25"
                >
                  Book Your Hollongi Taxi
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
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
                    <details key={idx} className="group bg-primary-900/50 border border-primary-800 rounded-2xl p-5" open={idx === 0}>
                      <summary className="flex items-center justify-between cursor-pointer list-none text-white font-semibold">
                        <span>{item.q}</span>
                        <span className="ml-3 text-gray-400 transition-transform group-open:rotate-45 shrink-0">+</span>
                      </summary>
                      <p className="mt-3 text-gray-400 leading-relaxed text-sm">{item.a}</p>
                    </details>
                  ))}
                </div>
                <p className="mt-6 text-gray-500 text-sm">
                  More questions?{' '}
                  <Link href="/faq" className="text-secondary-500 hover:text-secondary-400 font-semibold transition-colors">Visit our full FAQ</Link>
                </p>
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
                  { href: '/donyi-polo-airport-taxi', label: 'Donyi Polo Airport Taxi' },
                  { href: '/itanagar-airport-taxi', label: 'Itanagar Airport Taxi' },
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
