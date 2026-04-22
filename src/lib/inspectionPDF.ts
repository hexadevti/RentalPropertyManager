import { format } from 'date-fns'
import type { Contract, Guest, Inspection, InspectionItemCondition, Property } from '@/types'
import { generatePDFFromHTML, downloadPDF, openPDFInNewTab } from '@/lib/contractPDF'
import { translations, Language } from '@/lib/i18n'

export interface InspectionPDFData {
  inspection: Inspection
  property: Property
  contract: Contract
  guest: Guest | null
  language: Language
  formatDate?: (value: Date | string) => string
}

const CONDITION_STYLE: Record<InspectionItemCondition, { bg: string; text: string }> = {
  excellent: { bg: '#d1fae5', text: '#065f46' },
  good: { bg: '#e0f2fe', text: '#075985' },
  attention: { bg: '#fef3c7', text: '#92400e' },
  damaged: { bg: '#ffe4e6', text: '#9f1239' },
  na: { bg: '#f3f4f6', text: '#374151' },
}

function formatDefault(value: Date | string): string {
  try {
    return format(new Date(value), 'dd/MM/yyyy')
  } catch {
    return String(value)
  }
}

function metaCell(label: string, value: string): string {
  return `
    <td style="width:25%;padding:6px 10px;border:1px solid #d1d5db;vertical-align:top;">
      <span style="font-size:10px;color:#6b7280;display:block;margin-bottom:2px;">${label}</span>
      <span style="font-size:12px;font-weight:600;">${value}</span>
    </td>`
}

function buildInspectionHTML(data: InspectionPDFData): string {
  const { inspection, property, contract, guest, language } = data
  const translationsForLanguage = translations[language]
  const inspectionLabels = translationsForLanguage.inspections_view
  const pdfLabels = translationsForLanguage.inspection_pdf
  const formatter = data.formatDate ?? formatDefault

  const typeLabel = inspectionLabels.inspection_type[inspection.type] ?? inspection.type
  const statusLabel = inspectionLabels.inspection_status[inspection.status] ?? inspection.status
  const conditionLabels = inspectionLabels.condition
  const rentalLabel = pdfLabels.rental_type[contract.rentalType] ?? contract.rentalType
  const contractRange = `${rentalLabel} · ${formatter(contract.startDate)} – ${formatter(contract.endDate)}`
  const propertyLine = [property.name, property.address, property.city].filter(Boolean).join(' · ')
  const guestName = guest?.name ?? '—'
  const inspectorName = inspection.inspectorName || '—'

  const header = `
    <div style="border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:20px;">
      <div style="font-size:11px;color:#6b7280;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">
        ${pdfLabels.report_title}
      </div>
      <div style="font-size:20px;font-weight:700;margin-bottom:2px;">${inspection.title}</div>
      <div style="font-size:13px;color:#374151;">${propertyLine}</div>
    </div>`

  const row1 = `<tr>
    ${metaCell(pdfLabels.type, typeLabel)}
    ${metaCell(pdfLabels.status, statusLabel)}
    ${metaCell(pdfLabels.inspection_date, formatter(inspection.scheduledDate))}
    ${metaCell(pdfLabels.inspector, inspectorName)}
  </tr>`

  const row2 = `<tr>
    ${metaCell(pdfLabels.contract, contractRange)}
    ${metaCell(pdfLabels.tenant, guestName)}
    ${inspection.completedDate
      ? metaCell(pdfLabels.completed_on, formatter(inspection.completedDate))
      : '<td style="width:25%;border:1px solid #d1d5db;background:#f9fafb;"></td>'}
    <td style="width:25%;border:1px solid #d1d5db;background:#f9fafb;"></td>
  </tr>`

  const metaGrid = `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${row1}${row2}</table>`

  const summaryBlock = inspection.summary ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:12px 16px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">
        ${pdfLabels.summary}
      </div>
      <div style="font-size:12px;line-height:1.6;">${inspection.summary}</div>
    </div>` : ''

  const issueCount = inspection.areas.reduce((count, area) =>
    count + area.items.filter((item) => item.condition === 'attention' || item.condition === 'damaged').length, 0)

  const issueBadge = `
    <div style="margin-bottom:14px;font-size:12px;font-weight:600;color:${issueCount > 0 ? '#92400e' : '#065f46'};">
      ${issueCount > 0
        ? `&#9888; ${issueCount} ${pdfLabels.attention_points}`
        : `&#10003; ${pdfLabels.no_attention_points}`}
    </div>`

  const areasHTML = inspection.areas.map((area) => {
    const itemRows = area.items.map((item) => {
      const style = CONDITION_STYLE[item.condition] ?? CONDITION_STYLE.na
      return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:12px;">${item.label}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;background:${style.bg};color:${style.text};white-space:nowrap;text-align:center;">
            ${conditionLabels[item.condition]}
          </td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">
            ${item.notes || ''}
          </td>
        </tr>`
    }).join('')

    const areaNotes = area.notes
      ? `<div style="font-size:11px;color:#6b7280;padding:4px 12px;font-style:italic;border-left:3px solid #94a3b8;margin:6px 0;">${area.notes}</div>`
      : ''

    return `
      <div style="margin-bottom:20px;">
        <div style="background:#1e293b;color:#fff;padding:7px 12px;font-size:13px;font-weight:700;border-radius:4px 4px 0 0;">
          ${area.name}
        </div>
        ${areaNotes}
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;font-weight:600;color:#374151;width:42%;">${pdfLabels.item}</th>
              <th style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:center;font-weight:600;color:#374151;width:16%;">${pdfLabels.condition}</th>
              <th style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;font-weight:600;color:#374151;">${pdfLabels.notes}</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>`
  }).join('')

  const signBox = (role: string, name: string) => `
    <div style="flex:1;text-align:center;">
      <div style="height:52px;border-bottom:1px solid #111;margin-bottom:8px;"></div>
      <div style="font-size:12px;font-weight:600;">${role}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px;">${name}</div>
    </div>`

  const signatures = `
    <div style="margin-top:48px;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid #e5e7eb;padding-top:14px;margin-bottom:8px;">
        ${pdfLabels.signatures}
      </div>
      <div style="font-size:12px;color:#374151;margin-bottom:24px;">
        ${pdfLabels.date}: ______ / ______ / __________
      </div>
      <div style="display:flex;gap:48px;">
        ${signBox(pdfLabels.tenant_signature, guestName)}
        ${signBox(pdfLabels.inspector_signature, inspectorName)}
      </div>
    </div>`

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#111;">
      ${header}
      ${metaGrid}
      ${summaryBlock}
      ${issueBadge}
      ${areasHTML}
      ${signatures}
    </div>`
}

export async function downloadInspectionPDF(data: InspectionPDFData): Promise<void> {
  const html = buildInspectionHTML(data)
  const pdf = await generatePDFFromHTML(html)
  const filename = `inspection-${data.inspection.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`
  downloadPDF(pdf, filename)
}

export async function openInspectionPDFInNewTab(data: InspectionPDFData): Promise<void> {
  const html = buildInspectionHTML(data)
  const pdf = await generatePDFFromHTML(html)
  openPDFInNewTab(pdf)
}
