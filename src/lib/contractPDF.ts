import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Contract, Guest, Property, ContractTemplate, Owner } from '@/types'
import { format } from 'date-fns'

export interface ContractPDFData {
  contract: Contract
  guest: Guest
  properties: Property[]
  template: ContractTemplate
  owners: Owner[]
}

const MISSING_INDEX_TEMPLATE = '[indice de variavel inexistente. i = {{index}}]'

function isHTML(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content)
}

function buildVariables(
  data: ContractPDFData,
  formatCurrency: (value: number) => string
): Record<string, string> {
  const { contract, guest, properties, owners } = data

  const propertyList = properties.map((p) => `- ${p.name}`).join('\n')
  const ownerNames = owners.map((o) => o.name).join(', ') || ''
  const ownerEmails = owners.map((o) => o.email).join(', ') || ''
  const ownerPhones = owners.map((o) => o.phone).join(', ') || ''
  const ownerDocuments = owners.map((o) => o.document).join(', ') || ''
  const ownerAddresses = owners.map((o) => o.address || '').filter(Boolean).join(', ') || ''
  const ownerDetailsList = owners
    .map(
      (o) =>
        `${o.name}\nDocumento: ${o.document}\nE-mail: ${o.email}\nTelefone: ${o.phone}` +
        (o.address ? `\nEndereço: ${o.address}` : '')
    )
    .join('\n\n')

  return {
    '{{guestName}}': guest.name || '',
    '{{guestEmail}}': guest.email || '',
    '{{guestPhone}}': guest.phone || '',
    '{{guestDocument}}': guest.document || '',
    '{{guestAddress}}': guest.address || '',
    '{{guestNationality}}': guest.nationality || '',
    '{{ownerName}}': ownerNames,
    '{{ownerEmail}}': ownerEmails,
    '{{ownerPhone}}': ownerPhones,
    '{{ownerDocument}}': ownerDocuments,
    '{{ownerAddress}}': ownerAddresses,
    '{{ownerDetails}}': ownerDetailsList,
    '{{properties}}': propertyList,
    '{{startDate}}': format(new Date(contract.startDate), 'dd/MM/yyyy'),
    '{{endDate}}': format(new Date(contract.endDate), 'dd/MM/yyyy'),
    '{{monthlyAmount}}': formatCurrency(contract.monthlyAmount),
    '{{paymentDueDay}}': contract.paymentDueDay.toString(),
    '{{notes}}': contract.notes ? `OBSERVAÇÕES:\n${contract.notes}` : '',
    '{{currentDate}}': format(new Date(), 'dd/MM/yyyy'),
  }
}

function buildIndexedVariables(data: ContractPDFData): Record<string, string[]> {
  const { owners, properties } = data

  return {
    ownerName: owners.map((owner) => owner.name || ''),
    ownerEmail: owners.map((owner) => owner.email || ''),
    ownerPhone: owners.map((owner) => owner.phone || ''),
    ownerDocument: owners.map((owner) => owner.document || ''),
    ownerAddress: owners.map((owner) => owner.address || ''),
    ownerDetails: owners.map(
      (owner) =>
        `${owner.name}\nDocumento: ${owner.document}\nE-mail: ${owner.email}\nTelefone: ${owner.phone}` +
        (owner.address ? `\nEndereço: ${owner.address}` : '')
    ),
    properties: properties.map((property) => property.name || ''),
  }
}

function renderTemplateVariables(
  content: string,
  variables: Record<string, string>,
  indexedVariables: Record<string, string[]>
) {
  let resolvedContent = content

  for (const [key, value] of Object.entries(variables)) {
    resolvedContent = resolvedContent.split(key).join(value)
  }

  return resolvedContent.replace(/\{\{([a-zA-Z]+)\.(\d+)\}\}/g, (_match, variableName: string, indexText: string) => {
    const variableValues = indexedVariables[variableName]
    if (!variableValues) {
      return _match
    }

    const requestedIndex = Number(indexText)
    const arrayIndex = requestedIndex - 1

    if (!Number.isInteger(requestedIndex) || arrayIndex < 0 || arrayIndex >= variableValues.length) {
      return MISSING_INDEX_TEMPLATE.replace('{{index}}', indexText)
    }

    return variableValues[arrayIndex]
  })
}

// ── HTML-based PDF generation (rich text templates) ──────────────────────────

async function generatePDFFromHTML(htmlContent: string): Promise<jsPDF> {
  const container = document.createElement('div')
  container.style.cssText = [
    'position:absolute',
    'left:-9999px',
    'top:0',
    'width:794px',
    'padding:40px 50px',
    'background:white',
    'font-family:Arial,Helvetica,sans-serif',
    'font-size:12px',
    'line-height:1.6',
    'color:#000',
    'box-sizing:border-box',
    'word-break:break-word',
  ].join(';')

  container.innerHTML = htmlContent
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (_clonedDoc, clonedContainer) => {
        // Remove all page stylesheets from the clone so Tailwind's oklch
        // color variables don't reach the renderer (html2canvas doesn't
        // support oklch). The container uses only inline styles, so this
        // is safe.
        Array.from(_clonedDoc.querySelectorAll('link[rel="stylesheet"], style')).forEach(
          (el) => el.remove()
        )
        // Inject a minimal reset to avoid browser user-agent quirks
        const style = _clonedDoc.createElement('style')
        style.textContent =
          '* { box-sizing: border-box; } body { margin:0; padding:0; background:#fff; }'
        _clonedDoc.head.appendChild(style)
      },
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 10
    const imgW = pageW - margin * 2
    const totalImgH = (canvas.height / canvas.width) * imgW

    let remainingH = totalImgH
    let sourceY = 0

    while (remainingH > 0) {
      const sliceH = Math.min(remainingH, pageH - margin * 2)
      const sourceSliceH = (sliceH / imgW) * canvas.width

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = Math.ceil(sourceSliceH)
      const ctx = pageCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, sourceY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height)

      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, sliceH)

      sourceY += pageCanvas.height
      remainingH -= sliceH
      if (remainingH > 0) pdf.addPage()
    }

    return pdf
  } finally {
    document.body.removeChild(container)
  }
}

// ── Plain-text PDF generation (legacy templates) ─────────────────────────────

function generatePDFFromText(content: string): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const maxWidth = pageWidth - margin * 2
  const lineHeight = 7
  let yPosition = margin

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)

  for (const line of content.split('\n')) {
    if (yPosition + lineHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
    }

    if (line.trim() === '') {
      yPosition += lineHeight / 2
      continue
    }

    if (line.startsWith('CONTRATO') || line.startsWith('CLÁUSULA')) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
    } else if (line.includes('LOCADOR') || line.includes('LOCATÁRIO') || line.includes('IMÓVEL')) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
    } else {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
    }

    for (const wrappedLine of pdf.splitTextToSize(line, maxWidth)) {
      if (yPosition + lineHeight > pageHeight - margin) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.text(wrappedLine, margin, yPosition)
      yPosition += lineHeight
    }
  }

  return pdf
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateContractPDF(
  data: ContractPDFData,
  formatCurrency: (value: number) => string
): Promise<jsPDF> {
  const variables = buildVariables(data, formatCurrency)
  const indexedVariables = buildIndexedVariables(data)

  const content = renderTemplateVariables(data.template.content, variables, indexedVariables)

  if (isHTML(content)) {
    return generatePDFFromHTML(content)
  }
  return generatePDFFromText(content)
}

export function downloadPDF(pdf: jsPDF, filename: string) {
  pdf.save(filename)
}

export function openPDFInNewTab(pdf: jsPDF) {
  const pdfBlob = pdf.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}
