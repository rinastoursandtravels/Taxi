import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ – Taxi & Tour Booking Help',
  description:
    "Frequently asked questions about booking airport taxis from Hollongi (Donyi Polo Airport) and tour packages in Itanagar and Arunachal Pradesh. Get instant answers.",
  keywords: [
    'hollongi airport taxi faq',
    'taxi booking help itanagar',
    'airport taxi questions',
    'arunachal tour booking faq',
    'donyi polo airport taxi help',
  ],
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'FAQ – Taxi & Tour Booking Help | Rina\'s Tours and Travels',
    description:
      "Answers to common questions about airport taxi booking from Hollongi and Arunachal Pradesh tour packages.",
    url: '/faq',
  },
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
