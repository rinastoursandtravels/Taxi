import type { Metadata } from 'next'
import AppToaster from '@/components/AppToaster'
import { AuthProvider } from '@/context/AuthContext'
import { AdminProvider } from '@/context/AdminContext'
import RouteScrollUnlocker from '@/components/RouteScrollUnlocker'
import AppSplashLoader from '@/components/AppSplashLoader'
import PageTransitionController from '@/components/PageTransitionController'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rinastoursandtravels.in'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Rina's Tours and Travels | Hollongi Airport Taxi & Arunachal Tours",
    template: "%s | Rina's Tours and Travels",
  },
  description:
    "Book airport taxi from Donyi Polo Airport (Hollongi), Itanagar. Pre-book airport cab and curated Arunachal Pradesh tour packages. Verified drivers, transparent pricing.",
  keywords: [
    'hollongi airport taxi',
    'donyi polo airport taxi',
    'itanagar airport taxi',
    'airport taxi itanagar',
    'taxi from hollongi airport',
    'taxi from donyi polo airport',
    'airport pickup itanagar',
    'airport transfer itanagar',
    'airport cab arunachal pradesh',
    'itanagar tours',
    'arunachal tours',
    'arunachal pradesh tours',
    'sightseeing itanagar',
    'arunachal travel booking',
    'travel agency itanagar',
    'tour booking arunachal pradesh',
    "rina's tours and travels",
    'rina tours itanagar',
    'taxi booking hollongi',
    'local tours itanagar',
  ],
  authors: [{ name: "Rina's Tours and Travels", url: SITE_URL }],
  creator: "Rina's Tours and Travels",
  publisher: "Rina's Tours and Travels",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: SITE_URL,
    siteName: "Rina's Tours and Travels",
    title: "Rina's Tours and Travels | Hollongi Airport Taxi & Arunachal Tours",
    description:
      "Book airport taxi from Donyi Polo Airport (Hollongi), Itanagar and curated Arunachal Pradesh tour packages. Verified drivers, transparent pricing.",
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: "Rina's Tours and Travels – Hollongi Airport Taxi & Arunachal Tour Booking",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Rina's Tours and Travels | Hollongi Airport Taxi & Arunachal Tours",
    description:
      "Pre-book airport taxi from Donyi Polo Airport, Hollongi. Also book Arunachal Pradesh tour packages. Verified drivers, no hidden fees.",
    images: ['/og-image.jpg'],
  },
  category: 'travel',
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  }),
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['LocalBusiness', 'TravelAgency'],
      '@id': `${SITE_URL}/#organization`,
      name: "Rina's Tours and Travels",
      alternateName: ['Rina Tours Itanagar', 'Rina Airport Taxi Hollongi', 'Hollongi Airport Taxi'],
      url: SITE_URL,
      email: 'support@rinastoursandtravels.in',
      description:
        "Airport taxi service and tour booking platform at Donyi Polo Airport (Hollongi), serving Itanagar and all of Arunachal Pradesh. Pre-book cabs and tour packages.",
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Hollongi',
        addressLocality: 'Itanagar',
        addressRegion: 'Arunachal Pradesh',
        postalCode: '791111',
        addressCountry: 'IN',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 27.1557,
        longitude: 93.6324,
      },
      areaServed: [
        { '@type': 'City', name: 'Itanagar' },
        { '@type': 'State', name: 'Arunachal Pradesh' },
      ],
      priceRange: '₹₹',
      currenciesAccepted: 'INR',
      paymentAccepted: 'UPI, Credit Card, Debit Card, Cash',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Taxi & Tour Services',
        itemListElement: [
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Airport Taxi from Donyi Polo Airport',
              description:
                'Pre-book taxi from Donyi Polo Airport (Hollongi) to any destination in Arunachal Pradesh.',
            },
          },
          {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'Arunachal Pradesh Tour Packages',
              description:
                'Curated tour packages covering Itanagar and Arunachal Pradesh highlights.',
            },
          },
        ],
      },
    },
    {
      '@type': 'TaxiService',
      '@id': `${SITE_URL}/#taxiservice`,
      name: 'Donyi Polo Airport Taxi Service – Rina\'s Tours and Travels',
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: { '@type': 'State', name: 'Arunachal Pradesh' },
      serviceType: 'Airport Taxi',
      description:
        'Pre-book airport taxi from Donyi Polo Airport (Hollongi), Itanagar to your destination in Arunachal Pradesh.',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Rina's Tours and Travels",
      description:
        "Airport taxi and tour booking for Donyi Polo Airport, Itanagar and Arunachal Pradesh.",
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('rina:splashSeen'))document.documentElement.classList.add('splash-seen')}catch(e){}`,
          }}
        />
        <link rel="icon" href="https://hpobmsfwvrewpjqnmhsv.supabase.co/storage/v1/object/sign/internal/image-removebg-preview%20(1).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjA1YjRkYi0wMDA4LTQyOWUtYTFmZi02NzBjZTE1OWJhOTkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbnRlcm5hbC9pbWFnZS1yZW1vdmViZy1wcmV2aWV3ICgxKS5wbmciLCJpYXQiOjE3Nzc3NTQ5NzksImV4cCI6MTkzNTQzNDk3OX0.FR2fYD_zRiEMwQcrMja4J1PCZI6o6EFZ-_-8i6T0dy8" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>
        <AuthProvider>
          <AdminProvider>
            <AppSplashLoader />
            <RouteScrollUnlocker />
            <PageTransitionController />
            <AppToaster />
            {children}
          </AdminProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
