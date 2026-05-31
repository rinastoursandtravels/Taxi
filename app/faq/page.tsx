"use client"

import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const FAQ_ITEMS = [
  // Airport taxi
  {
    q: 'Do you offer taxi service from Donyi Polo Airport (Hollongi)?',
    a: 'Yes — we specialise in airport taxi service from Donyi Polo Airport (also known as Hollongi Airport) to destinations across Itanagar and Arunachal Pradesh. Pre-book online to guarantee your cab is waiting at arrivals.',
  },
  {
    q: 'How far is Hollongi Airport from Itanagar city centre?',
    a: 'Donyi Polo Airport at Hollongi is approximately 25 km from Itanagar city centre. The drive typically takes 45–60 minutes depending on traffic and road conditions.',
  },
  {
    q: 'Can I pre-book an airport taxi in advance?',
    a: "Yes — advance booking is strongly recommended, especially for early-morning or late-night flights. You can book online through our website any time, and you'll receive instant confirmation by email.",
  },
  {
    q: 'What types of vehicles are available at Hollongi Airport?',
    a: 'We offer sedans (4-seater), SUVs (6–7 seater), and larger vehicles depending on availability. Choose your preferred vehicle class during booking.',
  },
  {
    q: 'Is the pricing fixed or metered from Donyi Polo Airport?',
    a: 'All fares are fixed and shown transparently at the time of booking. There are no hidden charges or surprise fees.',
  },
  // Tours
  {
    q: 'What tour packages are available in Arunachal Pradesh?',
    a: "We offer curated sightseeing tours covering Itanagar's top attractions as well as multi-destination packages across Arunachal Pradesh. Visit our Tours page to browse available packages.",
  },
  {
    q: 'Can I customise a tour package?',
    a: 'Yes — custom itineraries can be arranged. Reach out to us at support@rinastoursandtravels.in with your preferred dates, group size, and destinations.',
  },
  // Booking & payment
  {
    q: 'How do I book a taxi?',
    a: "Go to Book Taxi, select your destination, date, time and vehicle, then confirm. You'll receive booking details by email and in your account.",
  },
  {
    q: 'Can I cancel or modify a booking?',
    a: "Modifications and cancellations are available from My Bookings. Cancellation fees may apply depending on the timing and service type — details are shown at checkout.",
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept UPI, major credit cards, and debit cards. Select payment options are shown at checkout.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. We use industry-standard security practices to protect your personal information. See our Privacy Policy for full details.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
}

export default function FAQPage() {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    let targetTop = scroller.scrollTop
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      targetTop = Math.min(max, Math.max(0, targetTop + e.deltaY))
      gsap.to(scroller, { scrollTop: targetTop, duration: 0.7, ease: 'power3.out', overwrite: true })
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={scrollRef} className="scrollbar-thin-modern h-[100dvh] overflow-y-auto overflow-x-hidden bg-primary-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Header />
      <main className="container mx-auto px-4 pt-20 pb-24">
        <div className="max-w-3xl mx-auto">
          <p className="text-secondary-500 font-semibold text-xs uppercase tracking-widest mb-2">Support</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">Frequently Asked Questions</h1>
          <p className="text-gray-400 mb-8">Common questions about airport taxi booking from Hollongi, tour packages, and payments — clear answers to help you travel smarter.</p>

          <section aria-label="Frequently asked questions" className="space-y-4">
            {FAQ_ITEMS.map((it, idx) => (
              <details key={idx} className="group bg-primary-900/50 border border-primary-800 rounded-2xl p-4" open={idx === 0}>
                <summary className="flex items-center justify-between cursor-pointer list-none text-white font-semibold">
                  <span>{it.q}</span>
                  <span className="ml-3 text-gray-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="mt-3 text-gray-300 leading-relaxed">{it.a}</div>
              </details>
            ))}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
