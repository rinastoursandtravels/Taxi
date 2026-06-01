import jsPDF from 'jspdf'

const APP_LOGO_URL = 'https://hpobmsfwvrewpjqnmhsv.supabase.co/storage/v1/object/sign/internal/image-removebg-preview%20(1).png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMjA1YjRkYi0wMDA4LTQyOWUtYTFmZi02NzBjZTE1OWJhOTkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbnRlcm5hbC9pbWFnZS1yZW1vdmViZy1wcmV2aWV3ICgxKS5wbmciLCJpYXQiOjE3Nzc3NTQ5NzksImV4cCI6MTkzNTQzNDk3OX0.FR2fYD_zRiEMwQcrMja4J1PCZI6o6EFZ-_-8i6T0dy8'

export interface InvoiceData {
  bookingId: string
  date: string
  userName: string
  userEmail: string
  userPhone: string
  bookingType: string // 'taxi' or 'tour'
  destination?: string
  tourPackageName?: string
  pickupLocation?: string
  pickupDate: string
  pickupTime?: string
  passengers: number
  carType: string
  totalAmount: number
  advanceAmount: number
  remainingAmount: number
  paymentStatus: string
  paymentMethod: string
  invoiceNumber: string
}

export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<jsPDF> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  // ============ HEADER SECTION - PROFESSIONAL LAYOUT ============
  // Left: App logo (replaces company name text)
  const logoDataUrl = await fetchImageAsDataUrl(APP_LOGO_URL)
  if (logoDataUrl) {
    const logoProps = doc.getImageProperties(logoDataUrl)
    const maxLogoWidth = 48
    const maxLogoHeight = 17
    const widthScale = maxLogoWidth / logoProps.width
    const heightScale = maxLogoHeight / logoProps.height
    const logoScale = Math.min(widthScale, heightScale)
    const logoWidth = logoProps.width * logoScale * 1.32825
    const logoHeight = logoProps.height * logoScale * 1.32825
    const logoX = margin + 2
    const logoY = yPosition - 12
    doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight)
  }

  // Subtitle removed by request

  // Invoice number on right
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, pageWidth - margin - 2, yPosition + 9, { align: 'right' })

  yPosition += 16

  // ============ DIVIDER ============
  doc.setDrawColor(244, 125, 9)
  doc.setLineWidth(1)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  // ============ INVOICE DETAILS - 2 COLUMN LAYOUT ============
  // LEFT COLUMN: Company & Customer Info
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(244, 125, 9)
  doc.text('FROM', margin, yPosition)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text("Rina's Tours & Travels", margin, yPosition + 6)

  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Inside the Arrival Hall, beside the Exit Gate', margin, yPosition + 11)
  doc.text('Donyi Polo Airport, Hollongi, Itanagar', margin, yPosition + 15)
  doc.text('support@rinastoursandtravels.in', margin, yPosition + 19)
  doc.text('+91-9101764656 / +91-9181301029', margin, yPosition + 23)

  // RIGHT COLUMN: Customer Info
  const rightCol = pageWidth / 2 + 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(244, 125, 9)
  doc.text('BILL TO', rightCol, yPosition)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text(invoiceData.userName, rightCol, yPosition + 6)

  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`Email: ${invoiceData.userEmail}`, rightCol, yPosition + 11)
  doc.text(`Phone: ${invoiceData.userPhone}`, rightCol, yPosition + 15)
  doc.text(`Booking ID: ${invoiceData.bookingId}`, rightCol, yPosition + 19)

  yPosition += 28

  // ============ DIVIDER ============
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  // ============ INVOICE META INFO ============
  const col1 = margin
  const col2 = margin + (contentWidth / 2)

  const metaData = [
    { label: 'Invoice Date', value: formatDate(invoiceData.date), x: col1 },
    { label: 'Payment Status', value: invoiceData.paymentStatus.toUpperCase(), x: col2 },
  ]

  metaData.forEach(({ label, value, x }) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(label, x, yPosition)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text(value, x, yPosition + 6)
  })

  yPosition += 15

  // ============ DIVIDER ============
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  // ============ BOOKING DETAILS SECTION ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(244, 125, 9)
  doc.text('BOOKING DETAILS', margin, yPosition)
  yPosition += 8

  const isTourBooking = invoiceData.bookingType === 'tour'
  const tripLabel = isTourBooking ? 'Tour Package' : 'Destination'
  const tripValue = isTourBooking
    ? (invoiceData.tourPackageName || '-')
    : (invoiceData.destination || '-')

  const bookingDetails = [
    { label: 'Service Type', value: isTourBooking ? 'Tour Package' : 'Taxi Service' },
    { label: tripLabel, value: tripValue },
    { label: 'Location', value: invoiceData.pickupLocation || 'Donyi Polo Airport, Hollongi' },
    { label: 'Pickup Date', value: formatDate(invoiceData.pickupDate) },
    { label: 'Pickup Time', value: invoiceData.pickupTime || 'As per booking' },
    { label: 'Passengers', value: invoiceData.passengers.toString() },
    { label: 'Vehicle Type', value: invoiceData.carType || 'Standard' },
  ]

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  // Create a fixed-width 2-column layout so long values never overlap
  const leftColumn = bookingDetails.slice(0, 3)
  const rightColumn = bookingDetails.slice(3)
  const columnGap = 12
  const columnWidth = (contentWidth - columnGap) / 2
  const leftColX = margin
  const rightColX = margin + columnWidth + columnGap
  const labelWidth = 30
  const valueXOffset = labelWidth + 2
  const valueWidth = columnWidth - valueXOffset - 1
  const lineHeight = 4.1
  const rowSpacing = 2.2

  const renderColumn = (
    details: Array<{ label: string; value: string }>,
    colX: number,
    startY: number
  ) => {
    let currentY = startY

    details.forEach((detail) => {
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'bold')
      doc.text(`${detail.label}:`, colX, currentY)

      const valueLines = doc.splitTextToSize(String(detail.value || '-'), valueWidth) as string[]
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text(valueLines, colX + valueXOffset, currentY)

      const valueBlockHeight = Math.max(lineHeight, valueLines.length * lineHeight)
      currentY += valueBlockHeight + rowSpacing
    })

    return currentY
  }

  const leftEndY = renderColumn(leftColumn, leftColX, yPosition)
  const rightEndY = renderColumn(rightColumn, rightColX, yPosition)
  yPosition = Math.max(leftEndY, rightEndY) + 2

  // ============ DIVIDER ============
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 10
  // ============ PAYMENT SUMMARY SECTION ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(244, 125, 9)
  doc.text('PAYMENT SUMMARY', margin, yPosition)
  yPosition += 8

  // Create a table-like structure with borders
  const tableLeft = margin + 2
  const tableRight = pageWidth - margin - 2
  const tableWidth = tableRight - tableLeft

  // Header row
  doc.setFillColor(244, 125, 9)
  doc.rect(tableLeft, yPosition, tableWidth, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Description', tableLeft + 3, yPosition + 5.5)
  doc.text('Amount (Rs.)', tableRight - 28, yPosition + 5.5, { align: 'right' })

  yPosition += 8

  // Data rows with alternating background
  const rows = [
    { label: 'Taxi Service Charges', amount: invoiceData.totalAmount },
    { label: 'Advance Payment (Online)', amount: invoiceData.advanceAmount },
    { label: 'Remaining Balance', amount: invoiceData.remainingAmount },
  ]

  rows.forEach((row, index) => {
    // Alternating background
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245)
      doc.rect(tableLeft, yPosition, tableWidth, 8, 'F')
    }

    // Border
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.rect(tableLeft, yPosition, tableWidth, 8)

    // Text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text(row.label, tableLeft + 3, yPosition + 5.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(244, 125, 9)
    const amountText = `Rs. ${row.amount.toFixed(2)}`
    doc.text(amountText, tableRight - 3, yPosition + 5.5, { align: 'right' })

    yPosition += 8
  })

  // Total row
  doc.setFillColor(51, 51, 51)
  doc.rect(tableLeft, yPosition, tableWidth, 10, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('GRAND TOTAL', tableLeft + 3, yPosition + 6.5)

  doc.setFontSize(11)
  doc.setTextColor(244, 125, 9)
  const grandTotalText = `Rs. ${invoiceData.totalAmount.toFixed(2)}`
  doc.text(grandTotalText, tableRight - 3, yPosition + 6.5, { align: 'right' })

  yPosition += 14

  // ============ PAYMENT METHOD INFO ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text('Payment Information', margin, yPosition)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  const paymentInfo = invoiceData.paymentMethod.includes('Full')
    ? `Full payment of Rs. ${invoiceData.totalAmount.toFixed(2)} made online.`
    : `Advance: Rs. ${invoiceData.advanceAmount.toFixed(2)} (online) | Remaining: Rs. ${invoiceData.remainingAmount.toFixed(2)} (due at pickup)`

  doc.text(paymentInfo, margin, yPosition + 5, { maxWidth: contentWidth })

  yPosition += 12

  // ============ DIVIDER ============
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  // ============ TERMS & CONDITIONS ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(244, 125, 9)
  doc.text('IMPORTANT INFORMATION', margin, yPosition)

  yPosition += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)

  const terms = [
    '• Any dispute regarding this invoice must be reported within 48 hours of booking.',
    '• Payment received is non-refundable except for cancellations within policy period.',
    '• This invoice is system-generated and is valid without signatures.',
    '• Remaining balance must be paid at time of service or invoice terms apply.',
    '• For support, contact: support@rinastoursandtravels.in | Phone: +91-9101764656 / +91-9181301029',
  ]

  let termsY = yPosition
  terms.forEach((term) => {
    if (termsY > pageHeight - 25) {
      doc.addPage()
      termsY = margin
    }
    doc.text(term, margin + 2, termsY, { maxWidth: contentWidth - 4 })
    termsY += 5
  })

  yPosition = termsY + 5

  // ============ FOOTER ============
  const footerY = pageHeight - 10
  
  doc.setDrawColor(244, 125, 9)
  doc.setLineWidth(1)
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text("Rina's Tours & Travels | Professional Taxi & Tour Services | www.taxihollongi.com", pageWidth / 2, footerY - 4, {
    align: 'center',
  })

  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Invoice generated on ${new Date().toLocaleDateString('en-IN')} | Status: ${invoiceData.paymentStatus.toUpperCase()}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  )

  return doc
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function downloadInvoicePDF(doc: jsPDF, fileName: string) {
  doc.save(fileName)
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to convert image blob to data URL'))
    reader.readAsDataURL(blob)
  })
}
