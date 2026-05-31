import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book Taxi – Airport Cab Booking Itanagar',
  description:
    "Book your airport taxi online in seconds from Donyi Polo Airport (Hollongi). Choose your vehicle and time with transparent pricing and no hidden fees.",
  keywords: [
    'book taxi itanagar',
    'book airport taxi hollongi',
    'donyi polo airport cab booking',
    'taxi booking itanagar online',
    'airport cab booking arunachal',
    'pre-book taxi hollongi airport',
  ],
  alternates: {
    canonical: '/book-taxi',
  },
  openGraph: {
    title: 'Book Taxi – Airport Cab Booking Itanagar',
    description:
      "Book airport taxi from Donyi Polo Airport (Hollongi). Transparent pricing, verified drivers.",
    url: '/book-taxi',
  },
}

export default function BookTaxiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
