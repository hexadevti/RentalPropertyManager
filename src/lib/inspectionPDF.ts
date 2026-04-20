import { format } from 'date-fns'
import type { Contract, Guest, Inspection, InspectionItemCondition, Property } from '@/types'
import { generatePDFFromHTML, downloadPDF, openPDFInNewTab } from '@/lib/contractPDF'

export interface InspectionPDFData {
  inspection: Inspection
  property: Property
  contract: Contract
  guest: Guest | null
  language: 'pt' | 'en'
  formatDate?: (value: Date | string) => string
}

const CONDITION_STYLE: Record<InspectionItemCondition, { bg: string; text: string; label: { pt: string; en: string } }> = {
  excellent: { bg: '#d1fae5', text: '#065f46', label: { pt: 'Excelente',  en: 'Excellent'  } },
  good:      { bg: '#e0f2fe', text: '#075985', label: { pt: 'Bom',        en: 'Good'       } },
  attention: { bg: '#fef3c7', text: '#92400e', label: { pt: 'Atenção',    en: 'Attention'  } },
  damaged:   { bg: '#ffe4e6', text: '#9f1239', label: { pt: 'Danificado', en: 'Damaged'    } },
  na:        { bg: '#f3f4f6', text: '#374151', label: { pt: 'N/A',        en: 'N/A'        } },
}

const TYPE_LABEL: Record<string, { pt: string; en: string }> = {
  'check-in':  { pt: 'Entrada',    en: 'Move-in'    },
  'check-out': { pt: 'Saída',      en: 'Move-out'   },
  maintenance: { pt: 'Manutenção', en: 'Maintenance' },
  periodic:    { pt: 'Periódica',  en: 'Periodic'   },
}

const STATUS_LABEL: Record<string, { pt: string; en: string }> = {
  draft:         { pt: 'Rascunho',     en: 'Draft'       },
  'in-progress': { pt: 'Em andamento', en: 'In progress' },
  assessed:      { pt: 'Avaliada',     en: 'Assessed'    },
}

function fmtDefault(value: Date | string): string {
  try { return format(new Date(value), 'dd/MM/yyyy') } catch { return String(value) }
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
  const pt = language === 'pt'
  const fmt = data.formatDate ?? fmtDefault

  const typeLabel   = TYPE_LABEL[inspection.type]?.[language]   ?? inspection.type
  const statusLabel = STATUS_LABEL[inspection.status]?.[language] ?? inspection.status
  const rentalLabel = contract.rentalType === 'monthly'
    ? (pt ? 'Mensal' : 'Monthly')
    : (pt ? 'Temporada' : 'Short-term')
  const contractRange = `${rentalLabel} · ${fmt(contract.startDate)} – ${fmt(contract.endDate)}`
  const propertyLine = [property.name, property.address, property.city].filter(Boolean).join(' · ')

  // ── header ────────────────────────────────────────────────────────────────
  const header = `
    <div style="border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:20px;">
      <div style="font-size:11px;color:#6b7280;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">
        ${pt ? 'Laudo de Vistoria de Imóvel' : 'Property Inspection Report'}
      </div>
      <div style="font-size:20px;font-weight:700;margin-bottom:2px;">${inspection.title}</div>
      <div style="font-size:13px;color:#374151;">${propertyLine}</div>
    </div>`

  // ── metadata grid ─────────────────────────────────────────────────────────
  const row1 = `<tr>
    ${metaCell(pt ? 'Tipo de vistoria' : 'Inspection type', typeLabel)}
    ${metaCell(pt ? 'Status' : 'Status', statusLabel)}
    ${metaCell(pt ? 'Data da vistoria' : 'Inspection date', fmt(inspection.scheduledDate))}
    ${metaCell(pt ? 'Responsável' : 'Inspector', inspection.inspectorName || '—')}
  </tr>`

  const row2 = `<tr>
    ${metaCell(pt ? 'Contrato' : 'Contract', contractRange)}
    ${metaCell(pt ? 'Inquilino' : 'Tenant', guest?.name ?? '—')}
    ${inspection.completedDate
      ? metaCell(pt ? 'Data de conclusão' : 'Completed on', fmt(inspection.completedDate))
      : '<td style="width:25%;border:1px solid #d1d5db;background:#f9fafb;"></td>'}
    <td style="width:25%;border:1px solid #d1d5db;background:#f9fafb;"></td>
  </tr>`

  const metaGrid = `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${row1}${row2}</table>`

  // ── summary ───────────────────────────────────────────────────────────────
  const summaryBlock = inspection.summary ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:12px 16px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">
        ${pt ? 'Resumo geral' : 'Summary'}
      </div>
      <div style="font-size:12px;line-height:1.6;">${inspection.summary}</div>
    </div>` : ''

  // ── issue count badge ─────────────────────────────────────────────────────
  const issueCount = inspection.areas.reduce((n, area) =>
    n + area.items.filter((i) => i.condition === 'attention' || i.condition === 'damaged').length, 0)

  const issueBadge = `
    <div style="margin-bottom:14px;font-size:12px;font-weight:600;color:${issueCount > 0 ? '#92400e' : '#065f46'};">
      ${issueCount > 0
        ? `&#9888; ${issueCount} ${pt ? 'ponto(s) de atenção' : 'attention point(s)'}`
        : `&#10003; ${pt ? 'Sem pontos de atenção' : 'No attention points'}`}
    </div>`

  // ── areas ─────────────────────────────────────────────────────────────────
  const areasHTML = inspection.areas.map((area) => {
    const itemRows = area.items.map((item) => {
      const s = CONDITION_STYLE[item.condition] ?? CONDITION_STYLE.na
      return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:12px;">${item.label}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;
                     background:${s.bg};color:${s.text};white-space:nowrap;text-align:center;">
            ${s.label[language]}
          </td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;color:#374151;">
            ${item.notes || ''}
          </td>
        </tr>`
    }).join('')

    const areaNotes = area.notes
      ? `<div style="font-size:11px;color:#6b7280;padding:4px 12px;font-style:italic;
                     border-left:3px solid #94a3b8;margin:6px 0;">
           ${area.notes}
         </div>`
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
              <th style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;
                         font-weight:600;color:#374151;width:42%;">${pt ? 'Item' : 'Item'}</th>
              <th style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:center;
                         font-weight:600;color:#374151;width:16%;">${pt ? 'Condição' : 'Condition'}</th>
              <th style="padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;
                         font-weight:600;color:#374151;">${pt ? 'Observações' : 'Notes'}</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>`
  }).join('')

  // ── signature block ───────────────────────────────────────────────────────
  const signBox = (role: string, name: string) => `
    <div style="flex:1;text-align:center;">
      <div style="height:52px;border-bottom:1px solid #111;margin-bottom:8px;"></div>
      <div style="font-size:12px;font-weight:600;">${role}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px;">${name}</div>
    </div>`

  const signatures = `
    <div style="margin-top:48px;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                  letter-spacing:.06em;border-top:1px solid #e5e7eb;padding-top:14px;margin-bottom:8px;">
        ${pt ? 'Assinaturas' : 'Signatures'}
      </div>
      <div style="font-size:12px;color:#374151;margin-bottom:24px;">
        ${pt ? 'Data' : 'Date'}: ______ / ______ / __________
      </div>
      <div style="display:flex;gap:48px;">
        ${signBox(pt ? 'Inquilino / Locatário' : 'Tenant', guest?.name ?? '—')}
        ${signBox(pt ? 'Vistoriador / Responsável' : 'Inspector', inspection.inspectorName || '—')}
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function downloadInspectionPDF(data: InspectionPDFData): Promise<void> {
  const html = buildInspectionHTML(data)
  const pdf = await generatePDFFromHTML(html)
  const filename = `vistoria-${data.inspection.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`
  downloadPDF(pdf, filename)
}

export async function openInspectionPDFInNewTab(data: InspectionPDFData): Promise<void> {
  const html = buildInspectionHTML(data)
  const pdf = await generatePDFFromHTML(html)
  openPDFInNewTab(pdf)
}
