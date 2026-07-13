import { Resend } from 'resend'
import { NextRequest } from 'next/server'
import { requireAdminRequest } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Diagnostic email tester. Admin-only: previously this was public, which let
// anyone send mail through our Resend account and leaked env values
// (ADMIN_EMAIL, the Resend key prefix) in the response.
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminRequest(request)
  if (unauthorized) return unauthorized

  const to = request.nextUrl.searchParams.get('to')

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ success: false, error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  if (!to) {
    return Response.json({ success: false, error: 'Pass ?to=your@email.com' }, { status: 400 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: `Rina's Tours and Travels <${process.env.RESEND_FROM_EMAIL || 'noreply@rinastoursandtravels.in'}>`,
      to,
      subject: 'Test Email — Rina\'s Tours and Travels',
      html: '<p>If you see this, Resend is working correctly from Vercel.</p>',
    })

    return Response.json({ success: true, id: result?.data?.id ?? null })
  } catch (error: any) {
    return Response.json({ success: false, error: error?.message || 'Send failed' }, { status: 500 })
  }
}
