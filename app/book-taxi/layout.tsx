import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book Taxi - Fixed Fare Airport Cab Booking',
  description:
    'Book your fixed-fare airport taxi online from Donyi Polo Airport (Hollongi). Choose destination, car, and pickup slot with transparent pricing and no hidden fees.',
  keywords: [
    'book taxi itanagar',
    'book airport taxi hollongi',
    'donyi polo airport cab booking',
    'taxi booking itanagar online',
    'airport cab booking arunachal',
    'pre-book taxi hollongi airport',
    'fixed fare airport taxi',
  ],
  alternates: {
    canonical: '/book-taxi',
  },
  openGraph: {
    title: 'Book Taxi - Fixed Fare Airport Cab Booking',
    description:
      'Book fixed-fare airport taxi from Donyi Polo Airport (Hollongi) with verified drivers and transparent pricing.',
    url: '/book-taxi',
  },
}

export default function BookTaxiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
