'use client'

import Link from 'next/link'
import { Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react'
import Logo from '@/components/Logo'

export default function Footer() {

  return (
    <footer className="bg-primary-950 text-gray-400 pt-3 md:pt-[calc(2rem+5px)] pb-3 md:pb-[calc(2rem+5px+env(safe-area-inset-bottom))] border-t border-white/[0.06]">
      <div className="container mx-auto px-4">
        {/* Main grid — 2-col on mobile (brand full-width, nav+support side-by-side), 4-col on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 sm:gap-y-5 lg:gap-6 pb-2 sm:pb-5 border-b border-white/[0.06]">

          {/* Brand — full width on mobile */}
          <div className="footer-col col-span-2 lg:col-span-1">
            <div className="mb-1.5">
              <Logo size="lg" showName nameClass="text-secondary-500 text-xl" />
            </div>
            <p className="hidden lg:block text-sm leading-relaxed text-gray-500 mb-3">
              Arunachal Pradesh&apos;s trusted airport taxi and tour booking platform. Safe, reliable, always on time.
            </p>
            <div className="space-y-0.5 md:space-y-1">
              <a
                href="mailto:support@rinastoursandtravels.in"
                className="flex items-center gap-2 text-xs hover:text-secondary-500 transition-colors duration-200 group overflow-hidden"
              >
                <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-primary-900 flex items-center justify-center group-hover:bg-secondary-500/10 transition-colors shrink-0">
                  <Mail size={11} className="text-secondary-500" />
                </div>
                <span className="truncate min-w-0">support@rinastoursandtravels.in</span>
              </a>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-primary-900 flex items-center justify-center shrink-0">
                  <Phone size={11} className="text-secondary-500" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a href="tel:+919101764656" className="hover:text-secondary-500 transition-colors duration-200 whitespace-nowrap">+91 91017 64656</a>
                  <span className="text-gray-600">/</span>
                  <a href="tel:+919181301029" className="hover:text-secondary-500 transition-colors duration-200 whitespace-nowrap">+91 91813 01029</a>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-primary-900 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={11} className="text-secondary-500" />
                </div>
                <span>Inside the Arrival Hall, beside the Exit Gate, Donyi Polo Airport, Hollongi, Itanagar</span>
              </div>
            </div>
          </div>

          {/* Navigate */}
          <div className="footer-col">
            <h4 className="text-white font-semibold mb-2 text-xs tracking-widest uppercase">Navigate</h4>
            <ul className="space-y-2">
              {[
                { href: '/', label: 'Home' },
                { href: '/book-taxi', label: 'Book Taxi' },
                { href: '/tours', label: 'Tour Packages' },
                { href: '/bookings', label: 'My Bookings' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs flex items-center gap-2 hover:text-secondary-500 transition-colors duration-200 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-primary-700 group-hover:bg-secondary-500 transition-colors shrink-0" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="footer-col">
            <h4 className="text-white font-semibold mb-2 text-xs tracking-widest uppercase">Support</h4>
            <ul className="space-y-2">
              {[
                { href: 'https://wa.me/919181301029', label: 'Help Center', target: '_blank' as const },
                { href: '/faq', label: 'FAQ' },
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms & Conditions' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={'target' in link ? link.target : undefined}
                    rel={'target' in link ? 'noopener noreferrer' : undefined}
                    className="text-xs flex items-center gap-2 hover:text-secondary-500 transition-colors duration-200 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-primary-700 group-hover:bg-secondary-500 transition-colors shrink-0" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA col — desktop only */}
          <div className="footer-col hidden lg:block">
            <h4 className="text-white font-semibold mb-2 text-xs tracking-widest uppercase">Ready to Book?</h4>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Your next adventure in Arunachal Pradesh starts here. Secure your seat in minutes.
            </p>
            <Link
              href="/book-taxi"
              className="group inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary-500 text-primary-950 font-black rounded-xl hover:bg-secondary-400 transition-all duration-200 text-xs shadow-lg shadow-secondary-500/20 mb-2 w-full"
            >
              Book Taxi Now
              <ArrowUpRight
                size={13}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </Link>
            <Link
              href="/tours"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-white/10 text-gray-400 font-medium rounded-xl hover:border-secondary-500/30 hover:text-secondary-500 transition-all duration-200 text-xs w-full"
            >
              Explore Tours
            </Link>
          </div>
        </div>

        {/* Services strip */}
        <div className="py-1.5 flex flex-wrap gap-x-3 gap-y-1 justify-center">
          {[
            { href: '/hollongi-airport-taxi', label: 'Hollongi Airport Taxi' },
            { href: '/donyi-polo-airport-taxi', label: 'Donyi Polo Airport Taxi' },
            { href: '/itanagar-airport-taxi', label: 'Itanagar Airport Taxi' },
            { href: '/arunachal-tours', label: 'Arunachal Tours' },
            { href: '/itanagar-tours', label: 'Itanagar Tours' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1 text-[9px] text-gray-500 whitespace-nowrap hover:text-secondary-500 transition-colors duration-200"
            >
              <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Bottom bar */}
        <style>
          {`
            @keyframes footer-bee-shimmer {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .animate-bee-shimmer {
              background-size: 200% auto;
              animation: footer-bee-shimmer 6s linear infinite;
            }
          `}
        </style>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2">
          <p className="text-[11px] sm:text-xs text-gray-600">
            &copy; 2026 Rina&apos;s Tours and Travels. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] sm:text-xs text-gray-600">
            <Link href="/privacy" className="hover:text-secondary-500 transition-colors duration-200">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-secondary-500 transition-colors duration-200">
              Terms
            </Link>
            <span>Crafted by <Link href="https://beesolutions.in" target="_blank" className="font-bold bg-gradient-to-r from-yellow-500 to-cyan-500 bg-clip-text text-transparent animate-bee-shimmer transition-opacity hover:opacity-50">Bee Solutions</Link></span>
          </div>
        </div>
      </div>
    </footer>
  )
}
