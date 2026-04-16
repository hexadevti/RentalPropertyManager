import jsPDF from 'jspdf'
import { Contract, Guest, Property, ContractTemplate, Owner } from '@/types'
import { format } from 'date-fns'

export interface ContractPDFData {
  contract: Contract
  guest: Guest
  properties: Property[]
  template: ContractTemplate
  owners: Owner[]
}

export function generateContractPDF(data: ContractPDFData, formatCurrency: (value: number) => string) {
  const { contract, guest, properties, template, owners } = data
  
  const propertyList = properties.map(p => `- ${p.name}`).join('\n')
  
  const ownerNames = owners.map(o => o.name).join(', ') || ''
  const ownerEmails = owners.map(o => o.email).join(', ') || ''
  const ownerPhones = owners.map(o => o.phone).join(', ') || ''
  const ownerDocuments = owners.map(o => o.document).join(', ') || ''
  const ownerAddresses = owners.map(o => o.address || '').filter(Boolean).join(', ') || ''
  
  const ownerDetailsList = owners.map(o => 
    `${o.name}\n` +
    `Documento: ${o.document}\n` +
    `E-mail: ${o.email}\n` +
    `Telefone: ${o.phone}` +
    (o.address ? `\nEndereço: ${o.address}` : '')
  ).join('\n\n')
  
  const variables: Record<string, string> = {
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
  
  let content = template.content
  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(key, value)
  }
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const maxWidth = pageWidth - (margin * 2)
  const lineHeight = 7
  let yPosition = margin
  
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  
  const lines = content.split('\n')
  
  for (const line of lines) {
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
    
    const wrappedLines = pdf.splitTextToSize(line, maxWidth)
    
    for (const wrappedLine of wrappedLines) {
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

export function downloadPDF(pdf: jsPDF, filename: string) {
  pdf.save(filename)
}

export function openPDFInNewTab(pdf: jsPDF) {
  const pdfBlob = pdf.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}
