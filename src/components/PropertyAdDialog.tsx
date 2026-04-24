import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowsClockwise, Eye, FileArrowDown, FilePdf, FloppyDisk, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { useKV } from '@/lib/useSupabaseKV'
import { downloadPDF, openPDFInNewTab } from '@/lib/contractPDF'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Document, Owner, Property, PropertyStatus } from '@/types'
import jsPDF from 'jspdf'

type PropertyAdDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: Property | null
  currentStatus: PropertyStatus | null
  coverPhotoUrl?: string
}

type PageSizeOption = 'a4' | 'a5' | 'square' | 'story' | 'custom'
type DispositionOption = 'portrait' | 'landscape'
type OutputFormatOption = 'pdf' | 'png' | 'jpg'
type LayoutVariant =
  | 'editorial-portrait'
  | 'editorial-landscape'
  | 'compact-portrait'
  | 'compact-landscape'
  | 'square-showcase'
  | 'vertical-story'
  | 'custom-portrait'
  | 'custom-landscape'

type SlotContentType = 'empty' | 'photo' | 'ai' | 'pricing' | 'contact'

type LayoutSlot = {
  id: string
  label: string
}

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type LayoutRatios = {
  bottomLeftRatio?: number
  heroHeightRatio?: number
  heroWidthRatio?: number
  mediaTopRatio?: number
  mediaMiddleRatio?: number
  middleHeightRatio?: number
  middleRowRatio?: number
  rightColumnTopRatio?: number
  topHeightRatio?: number
  topRowLeftRatio?: number
}

type PreviewHandle = {
  cursor: string
  id: string
  x: number
  y: number
}

type LayoutMerges = {
  mergeBottom?: boolean
  mergeMediaStack?: boolean
  mergeRightColumn?: boolean
  mergeTopRow?: boolean
}

type LayoutGeometry = {
  hiddenSlotIds: string[]
  rects: Record<string, Rect>
}

type LayoutBoxNode = {
  assignment: SlotContentType
  children?: [LayoutBoxNode, LayoutBoxNode]
  id: string
  label: string
  sourceSlotId: string
  splitDirection?: 'horizontal' | 'vertical'
  splitRatio?: number
}

type RenderedLayoutBox = {
  node: LayoutBoxNode
  rect: Rect
}

type AdMarketingFrame = {
  body?: string
  eyebrow?: string
  style?: 'accent' | 'detail' | 'highlight'
  title?: string
}

type GeneratedAdCopy = {
  cta?: string
  description?: string
  headline?: string
  highlights?: string[]
  marketingFrames?: AdMarketingFrame[]
  sections?: {
    lifestyleBody?: string
    lifestyleTitle?: string
    locationBody?: string
    locationTitle?: string
    pricingBody?: string
    pricingTitle?: string
  }
  subheadline?: string
  toneTag?: string
}

const DOCUMENTS_BUCKET = 'documents'
const PROPERTY_IMAGES_BUCKET = 'property-images'
const OUTER_PADDING = 24
const FRAME_PADDING = 12
const INNER_GAP = 8
const HANDLE_RADIUS = 7
const MIN_RATIO = 0.2
const MAX_RATIO = 0.8
const DOUBLE_CLICK_MS = 320

const LAYOUT_VARIANT_LABELS: Record<LayoutVariant, { pt: string; en: string }> = {
  'editorial-portrait': { pt: 'Editorial retrato', en: 'Editorial portrait' },
  'editorial-landscape': { pt: 'Editorial paisagem', en: 'Editorial landscape' },
  'compact-portrait': { pt: 'Compacto retrato', en: 'Compact portrait' },
  'compact-landscape': { pt: 'Compacto paisagem', en: 'Compact landscape' },
  'square-showcase': { pt: 'Vitrine quadrada', en: 'Square showcase' },
  'vertical-story': { pt: 'Story vertical', en: 'Vertical story' },
  'custom-portrait': { pt: 'Personalizado retrato', en: 'Custom portrait' },
  'custom-landscape': { pt: 'Personalizado paisagem', en: 'Custom landscape' },
}

const SLOT_CONTENT_LABELS: Record<SlotContentType, { pt: string; en: string }> = {
  empty: { pt: 'Vazio', en: 'Empty' },
  photo: { pt: 'Fotos', en: 'Photos' },
  ai: { pt: 'Conteúdo IA', en: 'AI content' },
  pricing: { pt: 'Valores', en: 'Pricing' },
  contact: { pt: 'Contato', en: 'Contact' },
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
}

function getPageSpec(pageSize: PageSizeOption, disposition: DispositionOption, customWidthPx: number, customHeightPx: number) {
  const dpiRatio = 25.4 / 96

  if (pageSize === 'custom') {
    const safeWidthPx = Math.max(320, customWidthPx || 1080)
    const safeHeightPx = Math.max(320, customHeightPx || 1350)
    return {
      widthPx: safeWidthPx,
      heightPx: safeHeightPx,
      pdfFormat: [safeWidthPx * dpiRatio, safeHeightPx * dpiRatio] as [number, number],
      pdfOrientation: safeWidthPx > safeHeightPx ? 'landscape' as const : 'portrait' as const,
    }
  }

  if (pageSize === 'square') {
    const widthPx = 1080
    const heightPx = 1080
    return {
      widthPx,
      heightPx,
      pdfFormat: [widthPx * dpiRatio, heightPx * dpiRatio] as [number, number],
      pdfOrientation: 'portrait' as const,
    }
  }

  if (pageSize === 'story') {
    const widthPx = 1080
    const heightPx = 1920
    return {
      widthPx,
      heightPx,
      pdfFormat: [widthPx * dpiRatio, heightPx * dpiRatio] as [number, number],
      pdfOrientation: 'portrait' as const,
    }
  }

  if (pageSize === 'a5') {
    return disposition === 'landscape'
      ? { widthPx: 794, heightPx: 559, pdfFormat: 'a5' as const, pdfOrientation: 'landscape' as const }
      : { widthPx: 559, heightPx: 794, pdfFormat: 'a5' as const, pdfOrientation: 'portrait' as const }
  }

  return disposition === 'landscape'
    ? { widthPx: 1123, heightPx: 794, pdfFormat: 'a4' as const, pdfOrientation: 'landscape' as const }
    : { widthPx: 794, heightPx: 1123, pdfFormat: 'a4' as const, pdfOrientation: 'portrait' as const }
}

function getLayoutVariant(
  pageSize: PageSizeOption,
  disposition: DispositionOption,
  widthPx: number,
  heightPx: number,
): LayoutVariant {
  if (pageSize === 'story') return 'vertical-story'
  if (pageSize === 'square') return 'square-showcase'
  if (pageSize === 'a5') return disposition === 'landscape' ? 'compact-landscape' : 'compact-portrait'
  if (pageSize === 'custom') return widthPx > heightPx ? 'custom-landscape' : 'custom-portrait'
  return disposition === 'landscape' ? 'editorial-landscape' : 'editorial-portrait'
}

function getLayoutSlots(layoutVariant: LayoutVariant, isEnglish: boolean): LayoutSlot[] {
  const labels = {
    hero: isEnglish ? 'Hero' : 'Hero',
    mediaA: isEnglish ? 'Media A' : 'Midia A',
    mediaB: isEnglish ? 'Media B' : 'Midia B',
    mediaC: isEnglish ? 'Media C' : 'Midia C',
    content: isEnglish ? 'Main content' : 'Conteudo principal',
    sideA: isEnglish ? 'Side A' : 'Lateral A',
    sideB: isEnglish ? 'Side B' : 'Lateral B',
  }

  if (layoutVariant === 'vertical-story' || layoutVariant === 'compact-portrait') {
    return [
      { id: 'hero', label: labels.hero },
      { id: 'media-a', label: labels.mediaA },
      { id: 'media-b', label: labels.mediaB },
      { id: 'content-main', label: labels.content },
      { id: 'content-side-a', label: labels.sideA },
      { id: 'content-side-b', label: labels.sideB },
    ]
  }

  if (layoutVariant === 'square-showcase') {
    return [
      { id: 'hero', label: labels.hero },
      { id: 'media-a', label: labels.mediaA },
      { id: 'media-b', label: labels.mediaB },
      { id: 'content-main', label: labels.content },
      { id: 'content-side-a', label: labels.sideA },
      { id: 'content-side-b', label: labels.sideB },
    ]
  }

  return [
    { id: 'hero', label: labels.hero },
    { id: 'media-a', label: labels.mediaA },
    { id: 'media-b', label: labels.mediaB },
    { id: 'media-c', label: labels.mediaC },
    { id: 'content-main', label: labels.content },
    { id: 'content-side-a', label: labels.sideA },
    { id: 'content-side-b', label: labels.sideB },
  ]
}

function getDefaultSlotAssignments(layoutVariant: LayoutVariant): Record<string, SlotContentType> {
  const base: Record<string, SlotContentType> = {
    hero: 'photo',
    'media-a': 'photo',
    'media-b': 'photo',
    'media-c': 'photo',
    'content-main': 'ai',
    'content-side-a': 'pricing',
    'content-side-b': 'contact',
  }

  if (layoutVariant === 'square-showcase') {
    return {
      hero: 'photo',
      'media-a': 'photo',
      'media-b': 'photo',
      'content-main': 'ai',
      'content-side-a': 'pricing',
      'content-side-b': 'contact',
    }
  }

  if (layoutVariant === 'vertical-story' || layoutVariant === 'compact-portrait') {
    return {
      hero: 'photo',
      'media-a': 'photo',
      'media-b': 'photo',
      'content-main': 'ai',
      'content-side-a': 'pricing',
      'content-side-b': 'contact',
    }
  }

  return base
}

function getSlotPalette(contentType: SlotContentType, isEnglish: boolean) {
  const label = SLOT_CONTENT_LABELS[contentType][isEnglish ? 'en' : 'pt']

  switch (contentType) {
    case 'photo':
      return {
        label,
        previewClass: 'bg-sky-200 text-sky-950',
      }
    case 'ai':
      return {
        label,
        previewClass: 'bg-stone-100 text-stone-800',
      }
    case 'pricing':
      return {
        label,
        previewClass: 'bg-emerald-100 text-emerald-900',
      }
    case 'contact':
      return {
        label,
        previewClass: 'bg-amber-100 text-amber-900',
      }
    case 'empty':
    default:
      return {
        label,
        previewClass: 'bg-slate-100 text-slate-500',
      }
  }
}

function getSlotSvgPalette(contentType: SlotContentType, isEnglish: boolean) {
  const label = SLOT_CONTENT_LABELS[contentType][isEnglish ? 'en' : 'pt']

  switch (contentType) {
    case 'photo':
      return { bg: '#bae6fd', fg: '#082f49', label }
    case 'ai':
      return { bg: '#f5f5f4', fg: '#44403c', label }
    case 'pricing':
      return { bg: '#d1fae5', fg: '#065f46', label }
    case 'contact':
      return { bg: '#fef3c7', fg: '#92400e', label }
    case 'empty':
    default:
      return { bg: '#f1f5f9', fg: '#64748b', label }
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function clampRatio(value: number) {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value))
}

function getDefaultLayoutRatios(layoutVariant: LayoutVariant): LayoutRatios {
  if (layoutVariant === 'square-showcase') {
    return {
      topHeightRatio: 0.38,
      middleHeightRatio: 0.27,
      heroWidthRatio: 0.6,
      mediaTopRatio: 0.5,
      bottomLeftRatio: 0.5,
    }
  }

  if (layoutVariant === 'vertical-story' || layoutVariant === 'compact-portrait') {
    return {
      heroHeightRatio: 0.34,
      middleRowRatio: 0.5,
      topRowLeftRatio: 0.5,
      bottomLeftRatio: 0.5,
      rightColumnTopRatio: 0.5,
    }
  }

  return {
    topHeightRatio: 0.32,
    middleHeightRatio: 0.34,
    heroWidthRatio: 0.6,
    mediaTopRatio: 1 / 3,
    mediaMiddleRatio: 1 / 3,
    bottomLeftRatio: layoutVariant.includes('landscape') ? 0.5 : 0.6,
  }
}

function getDefaultLayoutMerges(): LayoutMerges {
  return {}
}

function getContentBounds(widthPx: number, heightPx: number) {
  const contentX = OUTER_PADDING + FRAME_PADDING
  const contentY = OUTER_PADDING + FRAME_PADDING
  const contentWidth = widthPx - (OUTER_PADDING + FRAME_PADDING) * 2
  const contentHeight = heightPx - (OUTER_PADDING + FRAME_PADDING) * 2
  return { contentHeight, contentWidth, contentX, contentY }
}

function getLayoutGeometry(
  layoutVariant: LayoutVariant,
  widthPx: number,
  heightPx: number,
  ratios: LayoutRatios = getDefaultLayoutRatios(layoutVariant),
  merges: LayoutMerges = getDefaultLayoutMerges(),
): LayoutGeometry {
  const { contentHeight, contentWidth, contentX, contentY } = getContentBounds(widthPx, heightPx)
  const hiddenSlotIds = new Set<string>()

  if (layoutVariant === 'square-showcase') {
    const topRatio = clampRatio(ratios.topHeightRatio ?? 0.38)
    const middleRatio = clampRatio(ratios.middleHeightRatio ?? 0.27)
    const heroWidthRatio = clampRatio(ratios.heroWidthRatio ?? 0.6)
    const mediaTopRatio = clampRatio(ratios.mediaTopRatio ?? 0.5)
    const bottomLeftRatio = clampRatio(ratios.bottomLeftRatio ?? 0.5)
    const totalVerticalAvailable = contentHeight - INNER_GAP * 2
    const topHeight = Math.round(totalVerticalAvailable * topRatio)
    const middleHeight = Math.round(totalVerticalAvailable * middleRatio)
    const bottomHeight = contentHeight - topHeight - middleHeight - INNER_GAP * 2
    const heroWidth = Math.round((contentWidth - INNER_GAP) * heroWidthRatio)
    const sideWidth = contentWidth - heroWidth - INNER_GAP
    const mediaHeight = Math.round((topHeight - INNER_GAP) * mediaTopRatio)
    const sideRectWidth = Math.round((contentWidth - INNER_GAP) * bottomLeftRatio)

    const rects = {
      hero: { x: contentX, y: contentY, width: heroWidth, height: topHeight },
      'media-a': { x: contentX + heroWidth + INNER_GAP, y: contentY, width: sideWidth, height: mediaHeight },
      'media-b': { x: contentX + heroWidth + INNER_GAP, y: contentY + mediaHeight + INNER_GAP, width: sideWidth, height: topHeight - mediaHeight - INNER_GAP },
      'content-main': { x: contentX, y: contentY + topHeight + INNER_GAP, width: contentWidth, height: middleHeight },
      'content-side-a': { x: contentX, y: contentY + topHeight + INNER_GAP + middleHeight + INNER_GAP, width: sideRectWidth, height: bottomHeight },
      'content-side-b': { x: contentX + sideRectWidth + INNER_GAP, y: contentY + topHeight + INNER_GAP + middleHeight + INNER_GAP, width: contentWidth - sideRectWidth - INNER_GAP, height: bottomHeight },
    }

    if (merges.mergeMediaStack) {
      rects['media-a'] = { ...rects['media-a'], height: rects['media-a'].height + INNER_GAP + rects['media-b'].height }
      hiddenSlotIds.add('media-b')
    }

    if (merges.mergeBottom) {
      rects['content-side-a'] = { ...rects['content-side-a'], width: rects['content-side-a'].width + INNER_GAP + rects['content-side-b'].width }
      hiddenSlotIds.add('content-side-b')
    }

    return { hiddenSlotIds: Array.from(hiddenSlotIds), rects }
  }

  if (layoutVariant === 'vertical-story' || layoutVariant === 'compact-portrait') {
    const heroHeightRatio = clampRatio(ratios.heroHeightRatio ?? 0.34)
    const middleRowRatio = clampRatio(ratios.middleRowRatio ?? 0.5)
    const topRowLeftRatio = clampRatio(ratios.topRowLeftRatio ?? 0.5)
    const bottomLeftRatio = clampRatio(ratios.bottomLeftRatio ?? 0.5)
    const rightColumnTopRatio = clampRatio(ratios.rightColumnTopRatio ?? 0.5)
    const remainingHeight = contentHeight - Math.round(contentHeight * heroHeightRatio) - INNER_GAP
    const topRowHeight = Math.round((remainingHeight - INNER_GAP) * middleRowRatio)
    const bottomRowHeight = contentHeight - Math.round(contentHeight * heroHeightRatio) - topRowHeight - INNER_GAP * 2
    const topRowLeftWidth = Math.round((contentWidth - INNER_GAP) * topRowLeftRatio)
    const bottomLeftWidth = Math.round((contentWidth - INNER_GAP) * bottomLeftRatio)
    const rightColumnTopHeight = Math.round((bottomRowHeight - INNER_GAP) * rightColumnTopRatio)
    const heroHeight = contentHeight - remainingHeight - INNER_GAP

    const rects = {
      hero: { x: contentX, y: contentY, width: contentWidth, height: heroHeight },
      'media-a': { x: contentX, y: contentY + heroHeight + INNER_GAP, width: topRowLeftWidth, height: topRowHeight },
      'media-b': { x: contentX + topRowLeftWidth + INNER_GAP, y: contentY + heroHeight + INNER_GAP, width: contentWidth - topRowLeftWidth - INNER_GAP, height: topRowHeight },
      'content-main': { x: contentX, y: contentY + heroHeight + INNER_GAP + topRowHeight + INNER_GAP, width: bottomLeftWidth, height: bottomRowHeight },
      'content-side-a': { x: contentX + bottomLeftWidth + INNER_GAP, y: contentY + heroHeight + INNER_GAP + topRowHeight + INNER_GAP, width: contentWidth - bottomLeftWidth - INNER_GAP, height: rightColumnTopHeight },
      'content-side-b': { x: contentX + bottomLeftWidth + INNER_GAP, y: contentY + heroHeight + INNER_GAP + topRowHeight + INNER_GAP + rightColumnTopHeight + INNER_GAP, width: contentWidth - bottomLeftWidth - INNER_GAP, height: bottomRowHeight - rightColumnTopHeight - INNER_GAP },
    }

    if (merges.mergeTopRow) {
      rects['media-a'] = { ...rects['media-a'], width: rects['media-a'].width + INNER_GAP + rects['media-b'].width }
      hiddenSlotIds.add('media-b')
    }

    if (merges.mergeRightColumn) {
      rects['content-side-a'] = { ...rects['content-side-a'], height: rects['content-side-a'].height + INNER_GAP + rects['content-side-b'].height }
      hiddenSlotIds.add('content-side-b')
    }

    return { hiddenSlotIds: Array.from(hiddenSlotIds), rects }
  }

  const topRatio = clampRatio(ratios.topHeightRatio ?? 0.32)
  const middleRatio = clampRatio(ratios.middleHeightRatio ?? 0.34)
  const heroWidthRatio = clampRatio(ratios.heroWidthRatio ?? 0.6)
  const mediaTopRatio = clampRatio(ratios.mediaTopRatio ?? 1 / 3)
  const mediaMiddleRatio = clampRatio(ratios.mediaMiddleRatio ?? 1 / 3)
  const bottomLeftRatio = clampRatio(ratios.bottomLeftRatio ?? (layoutVariant.includes('landscape') ? 0.5 : 0.6))
  const totalVerticalAvailable = contentHeight - INNER_GAP * 2
  const topHeight = Math.round(totalVerticalAvailable * topRatio)
  const middleHeight = Math.round(totalVerticalAvailable * middleRatio)
  const bottomHeight = contentHeight - topHeight - middleHeight - INNER_GAP * 2
  const heroWidth = Math.round((contentWidth - INNER_GAP) * heroWidthRatio)
  const sideWidth = contentWidth - heroWidth - INNER_GAP
  const sideTotalHeight = topHeight - INNER_GAP * 2
  const mediaHeightA = Math.round(sideTotalHeight * mediaTopRatio)
  const mediaHeightB = Math.round(sideTotalHeight * mediaMiddleRatio)
  const mediaHeightC = topHeight - mediaHeightA - mediaHeightB - INNER_GAP * 2
  const bottomLeftWidth = Math.round((contentWidth - INNER_GAP) * bottomLeftRatio)

  const rects = {
    hero: { x: contentX, y: contentY, width: heroWidth, height: topHeight },
    'media-a': { x: contentX + heroWidth + INNER_GAP, y: contentY, width: sideWidth, height: mediaHeightA },
    'media-b': { x: contentX + heroWidth + INNER_GAP, y: contentY + mediaHeightA + INNER_GAP, width: sideWidth, height: mediaHeightB },
    'media-c': { x: contentX + heroWidth + INNER_GAP, y: contentY + mediaHeightA + INNER_GAP + mediaHeightB + INNER_GAP, width: sideWidth, height: mediaHeightC },
    'content-main': { x: contentX, y: contentY + topHeight + INNER_GAP, width: contentWidth, height: middleHeight },
    'content-side-a': { x: contentX, y: contentY + topHeight + INNER_GAP + middleHeight + INNER_GAP, width: bottomLeftWidth, height: bottomHeight },
    'content-side-b': { x: contentX + bottomLeftWidth + INNER_GAP, y: contentY + topHeight + INNER_GAP + middleHeight + INNER_GAP, width: contentWidth - bottomLeftWidth - INNER_GAP, height: bottomHeight },
  }

  if (merges.mergeMediaStack) {
    rects['media-a'] = { ...rects['media-a'], height: rects['media-a'].height + INNER_GAP + rects['media-b'].height + INNER_GAP + rects['media-c'].height }
    hiddenSlotIds.add('media-b')
    hiddenSlotIds.add('media-c')
  }

  if (merges.mergeBottom) {
    rects['content-side-a'] = { ...rects['content-side-a'], width: rects['content-side-a'].width + INNER_GAP + rects['content-side-b'].width }
    hiddenSlotIds.add('content-side-b')
  }

  return { hiddenSlotIds: Array.from(hiddenSlotIds), rects }
}

function getSlotRects(
  layoutVariant: LayoutVariant,
  widthPx: number,
  heightPx: number,
  ratios: LayoutRatios = getDefaultLayoutRatios(layoutVariant),
  merges: LayoutMerges = getDefaultLayoutMerges(),
) {
  return getLayoutGeometry(layoutVariant, widthPx, heightPx, ratios, merges).rects
}

function buildFlyerSvgMarkup(
  widthPx: number,
  heightPx: number,
  layoutVariant: LayoutVariant,
  renderedBoxes: RenderedLayoutBox[],
  property: Property | null,
  ownerContact: string,
  adCopy: GeneratedAdCopy | null,
  isEnglish: boolean,
  photoUrls: string[] = [],
  ratios: LayoutRatios = getDefaultLayoutRatios(layoutVariant),
  merges: LayoutMerges = getDefaultLayoutMerges(),
) {
  const photoBoxes = renderedBoxes.filter(({ node }) => node.assignment === 'photo')
  const photoUrlBySlotId = photoBoxes.reduce<Record<string, string>>((acc, box, index) => {
    if (photoUrls.length === 0) return acc
    acc[box.node.id] = photoUrls[index % photoUrls.length]
    return acc
  }, {})
  const slotsMarkup = renderedBoxes.map(({ node, rect }) => {
    const palette = getSlotSvgPalette(node.assignment || 'empty', isEnglish)
    const photoUrl = photoUrlBySlotId[node.id]
    const pricingMarkup = node.assignment === 'pricing'
      ? buildPricingBoxMarkup(rect, property, isEnglish, palette.bg, palette.fg)
      : ''
    const contactMarkup = node.assignment === 'contact'
      ? buildContactBoxMarkup(rect, ownerContact, isEnglish, palette.bg, palette.fg)
      : ''
    const aiMarkup = node.assignment === 'ai'
      ? buildAiBoxMarkup(rect, property, adCopy, isEnglish, palette.bg, palette.fg)
      : ''
    const imageMarkup = photoUrl ? `
        <defs>
          <clipPath id="clip-${node.id}">
            <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="14" ry="14" />
          </clipPath>
        </defs>
        <image href="${photoUrl}" x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${node.id})" />
        <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="14" ry="14" fill="rgba(255,255,255,0.16)" />
    ` : ''

    return `
      <g>
        ${node.assignment === 'pricing' || node.assignment === 'contact' || node.assignment === 'ai' ? '' : `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="14" ry="14" fill="${palette.bg}" />`}
        ${imageMarkup}
        ${pricingMarkup}
        ${contactMarkup}
        ${aiMarkup}
      </g>
    `
  }).join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
      <rect width="${widthPx}" height="${heightPx}" fill="#f5f1ea" />
      <rect x="24" y="24" width="${widthPx - 48}" height="${heightPx - 48}" rx="28" ry="28" fill="#f5f1ea" stroke="#e2e8f0" stroke-width="1.5" />
      <rect x="36" y="36" width="${widthPx - 72}" height="${heightPx - 72}" rx="24" ry="24" fill="#ffffff" />
      ${slotsMarkup}
    </svg>
  `
}

function buildSvgDataUrl(svgMarkup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`
}

function formatPriceLabel(kind: 'night' | 'month', isEnglish: boolean) {
  if (isEnglish) return kind === 'night' ? 'Per night' : 'Per month'
  return kind === 'night' ? 'Por noite' : 'Por mes'
}

function formatCurrencyValue(value: number, isEnglish: boolean) {
  return new Intl.NumberFormat(isEnglish ? 'en-US' : 'pt-BR', {
    currency: isEnglish ? 'USD' : 'BRL',
    style: 'currency',
  }).format(value)
}

type AdaptiveBoxProfile = {
  compact: boolean
  landscape: boolean
  padding: number
  showTitle: boolean
  tall: boolean
  tone: 'compact' | 'balanced' | 'showcase'
  valueSize: number
}

function getAdaptiveBoxProfile(rect: Rect): AdaptiveBoxProfile {
  const aspectRatio = rect.width / Math.max(rect.height, 1)
  const area = rect.width * rect.height
  const compact = rect.width < 240 || rect.height < 120 || area < 36000
  const showcase = !compact && (rect.width > 320 || rect.height > 200 || area > 65000)

  return {
    compact,
    landscape: aspectRatio >= 1.2,
    padding: Math.max(14, Math.min(24, Math.min(rect.width, rect.height) * 0.1)),
    showTitle: !compact,
    tall: aspectRatio <= 0.82,
    tone: compact ? 'compact' : showcase ? 'showcase' : 'balanced',
    valueSize: compact ? 16 : showcase ? 24 : 20,
  }
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []

  if (!words.length) return lines

  let currentLine = ''
  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine
      continue
    }

    if (currentLine) lines.push(currentLine)
    currentLine = word

    if (lines.length === maxLines - 1) break
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine)
  }

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxCharsPerLine - 1)).trimEnd()}...`
  }

  return lines
}

function buildWrappedTextMarkup(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  textColor: string,
  fontWeight = 700,
) {
  return lines.map((line, index) => `
    <text
      x="${x}"
      y="${y + index * lineHeight}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${fontSize}"
      font-weight="${fontWeight}"
      fill="${textColor}"
    >${escapeXml(line)}</text>
  `).join('')
}

function parseOwnerContact(ownerContact: string) {
  const pieces = ownerContact.split('•').map((item) => item.trim()).filter(Boolean)
  const email = pieces.find((item) => item.includes('@')) || ''
  const phone = pieces.find((item) => /\d/.test(item) && !item.includes('@')) || ''
  const name = pieces.find((item) => item !== email && item !== phone) || pieces[0] || ''

  return { name, phone, email }
}

function buildAiBoxMarkup(
  rect: Rect,
  property: Property | null,
  adCopy: GeneratedAdCopy | null,
  isEnglish: boolean,
  fillColor: string,
  textColor: string,
) {
  const profile = getAdaptiveBoxProfile(rect)
  const innerPadding = profile.padding
  const eyebrowSize = profile.compact ? 9 : 10
  const headlineSize = profile.compact ? 16 : profile.tone === 'showcase' ? 28 : 22
  const subheadlineSize = profile.compact ? 10 : 12
  const cardTitleSize = profile.compact ? 10 : 12
  const cardBodySize = profile.compact ? 9 : 10
  const ctaSize = profile.compact ? 11 : 12
  const fallbackHeadline = property?.name || (isEnglish ? 'Featured property' : 'Imovel em destaque')
  const fallbackSubheadline = property?.city
    ? (isEnglish ? `Live well in ${property.city}` : `Viva bem em ${property.city}`)
    : (isEnglish ? 'A composed property presentation' : 'Uma apresentacao pensada para o anuncio')
  const fallbackDescription = property?.description?.trim()
    || (isEnglish ? 'Comfort, clarity and a polished presentation shaped for this flyer format.' : 'Conforto, clareza e uma apresentacao refinada para este formato de flyer.')
  const marketingFrames = (adCopy?.marketingFrames?.filter((frame) => frame.title || frame.body) || []).slice(0, profile.compact ? 1 : profile.landscape ? 3 : 2)
  const defaultFrames: AdMarketingFrame[] = [
    {
      eyebrow: isEnglish ? 'Location' : 'Localizacao',
      title: property?.city || (isEnglish ? 'Strategic address' : 'Endereco estrategico'),
      body: property?.address || (isEnglish ? 'A place designed to communicate value at first glance.' : 'Um endereco pensado para comunicar valor no primeiro olhar.'),
      style: 'detail',
    },
    {
      eyebrow: isEnglish ? 'Stay style' : 'Estilo de estadia',
      title: property?.capacity ? `${property.capacity} ${isEnglish ? 'guest capacity' : 'pessoas'}` : (isEnglish ? 'Flexible occupation' : 'Ocupacao flexivel'),
      body: property?.conservationState || property?.type || (isEnglish ? 'Presented with a clean and premium marketing tone.' : 'Apresentado com uma linguagem limpa e premium.'),
      style: 'highlight',
    },
    {
      eyebrow: isEnglish ? 'Highlights' : 'Destaques',
      title: property?.environments?.slice(0, 2).join(' • ') || (isEnglish ? 'Selected amenities' : 'Ambientes selecionados'),
      body: property?.furnitureItems?.slice(0, 3).join(', ') || fallbackDescription,
      style: 'accent',
    },
  ]
  const frames = marketingFrames.length ? marketingFrames : defaultFrames.slice(0, profile.compact ? 1 : profile.landscape ? 3 : 2)
  const eyebrow = adCopy?.toneTag || (isEnglish ? 'AI-crafted marketing' : 'Marketing por IA')
  const headline = adCopy?.headline || fallbackHeadline
  const subheadline = adCopy?.subheadline || fallbackSubheadline
  const description = adCopy?.description || fallbackDescription
  const cta = adCopy?.cta || (isEnglish ? 'Request details and schedule a viewing' : 'Peca detalhes e agende uma visita')
  const headlineLines = wrapText(headline, Math.max(14, Math.floor((rect.width - innerPadding * 2) / (headlineSize * 0.58))), profile.compact ? 2 : 3)
  const subheadlineLines = wrapText(subheadline, Math.max(18, Math.floor((rect.width - innerPadding * 2) / 9)), profile.compact ? 1 : 2)
  const descriptionLines = wrapText(description, Math.max(20, Math.floor((rect.width - innerPadding * 2) / 8.4)), profile.compact ? 2 : profile.tall ? 4 : 3)
  const headerHeight = 18
  const titleBlockHeight = headlineLines.length * (headlineSize + 3)
  const subheadlineBlockHeight = subheadlineLines.length * (subheadlineSize + 4)
  const descriptionBlockHeight = descriptionLines.length * (subheadlineSize + 5)
  const cardsTop = rect.y + innerPadding + headerHeight + titleBlockHeight + subheadlineBlockHeight + descriptionBlockHeight + 28
  const ctaHeight = profile.compact ? 34 : 40
  const cardsAreaHeight = Math.max(56, rect.y + rect.height - innerPadding - ctaHeight - 14 - cardsTop)
  const frameGap = 10

  const cardsMarkup = profile.landscape && frames.length > 1
    ? frames.map((frame, index) => {
        const cardWidth = (rect.width - innerPadding * 2 - frameGap * (frames.length - 1)) / frames.length
        const cardX = rect.x + innerPadding + index * (cardWidth + frameGap)
        const cardY = cardsTop
        const styleFill = frame.style === 'accent'
          ? 'rgba(14, 116, 144, 0.12)'
          : frame.style === 'highlight'
            ? 'rgba(22, 163, 74, 0.10)'
            : 'rgba(255,255,255,0.74)'
        const titleLines = wrapText(frame.title || '', Math.max(10, Math.floor((cardWidth - 20) / 7.2)), profile.compact ? 1 : 2)
        const bodyLines = wrapText(frame.body || '', Math.max(12, Math.floor((cardWidth - 20) / 8.4)), profile.compact ? 2 : 3)
        return `
          <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardsAreaHeight}" rx="12" ry="12" fill="${styleFill}" />
          ${frame.eyebrow ? `<text x="${cardX + 12}" y="${cardY + 18}" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700" fill="${textColor}" opacity="0.58">${escapeXml(frame.eyebrow)}</text>` : ''}
          ${buildWrappedTextMarkup(titleLines, cardX + 12, cardY + 36, cardTitleSize, cardTitleSize + 3, textColor, 800)}
          ${buildWrappedTextMarkup(bodyLines, cardX + 12, cardY + 36 + titleLines.length * (cardTitleSize + 3) + 10, cardBodySize, cardBodySize + 4, textColor, 600)}
        `
      }).join('')
    : frames.map((frame, index) => {
        const cardX = rect.x + innerPadding
        const cardHeight = Math.max(52, (cardsAreaHeight - frameGap * (frames.length - 1)) / frames.length)
        const cardY = cardsTop + index * (cardHeight + frameGap)
        const styleFill = frame.style === 'accent'
          ? 'rgba(14, 116, 144, 0.12)'
          : frame.style === 'highlight'
            ? 'rgba(22, 163, 74, 0.10)'
            : 'rgba(255,255,255,0.74)'
        const titleLines = wrapText(frame.title || '', Math.max(14, Math.floor((rect.width - innerPadding * 2 - 24) / 7.4)), 2)
        const bodyLines = wrapText(frame.body || '', Math.max(16, Math.floor((rect.width - innerPadding * 2 - 24) / 8.7)), profile.compact ? 1 : 2)
        return `
          <rect x="${cardX}" y="${cardY}" width="${rect.width - innerPadding * 2}" height="${cardHeight}" rx="12" ry="12" fill="${styleFill}" />
          ${frame.eyebrow ? `<text x="${cardX + 12}" y="${cardY + 18}" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700" fill="${textColor}" opacity="0.58">${escapeXml(frame.eyebrow)}</text>` : ''}
          ${buildWrappedTextMarkup(titleLines, cardX + 12, cardY + 36, cardTitleSize, cardTitleSize + 3, textColor, 800)}
          ${buildWrappedTextMarkup(bodyLines, cardX + 12, cardY + 36 + titleLines.length * (cardTitleSize + 3) + 10, cardBodySize, cardBodySize + 4, textColor, 600)}
        `
      }).join('')

  return `
    <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="14" ry="14" fill="${fillColor}" />
    <text x="${rect.x + innerPadding}" y="${rect.y + innerPadding + eyebrowSize}" font-family="Arial, Helvetica, sans-serif" font-size="${eyebrowSize}" font-weight="700" fill="${textColor}" opacity="0.62">${escapeXml(eyebrow)}</text>
    ${buildWrappedTextMarkup(headlineLines, rect.x + innerPadding, rect.y + innerPadding + headerHeight + headlineSize, headlineSize, headlineSize + 3, textColor, 800)}
    ${buildWrappedTextMarkup(subheadlineLines, rect.x + innerPadding, rect.y + innerPadding + headerHeight + titleBlockHeight + subheadlineSize + 10, subheadlineSize, subheadlineSize + 4, textColor, 700)}
    ${buildWrappedTextMarkup(descriptionLines, rect.x + innerPadding, rect.y + innerPadding + headerHeight + titleBlockHeight + subheadlineBlockHeight + 24, subheadlineSize, subheadlineSize + 5, textColor, 600)}
    ${cardsMarkup}
    <rect x="${rect.x + innerPadding}" y="${rect.y + rect.height - innerPadding - ctaHeight}" width="${rect.width - innerPadding * 2}" height="${ctaHeight}" rx="999" ry="999" fill="rgba(15,23,42,0.08)" />
    <text x="${rect.x + rect.width / 2}" y="${rect.y + rect.height - innerPadding - ctaHeight / 2 + ctaSize / 3}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${ctaSize}" font-weight="800" fill="${textColor}">${escapeXml(cta)}</text>
  `
}

function buildPricingBoxMarkup(
  rect: Rect,
  property: Property | null,
  isEnglish: boolean,
  fillColor: string,
  textColor: string,
) {
  if (!property) return ''

  const entries = [
    property.pricePerNight > 0 ? { kind: 'night' as const, label: formatPriceLabel('night', isEnglish), value: formatCurrencyValue(property.pricePerNight, isEnglish) } : null,
    property.pricePerMonth > 0 ? { kind: 'month' as const, label: formatPriceLabel('month', isEnglish), value: formatCurrencyValue(property.pricePerMonth, isEnglish) } : null,
  ].filter((entry): entry is { kind: 'night' | 'month'; label: string; value: string } => Boolean(entry))

  if (entries.length === 0) return ''

  const profile = getAdaptiveBoxProfile(rect)
  const innerPadding = profile.padding
  const titleSize = profile.compact ? 11 : profile.tone === 'showcase' ? 16 : 14
  const eyebrowSize = profile.compact ? 9 : 10
  const valueSize = profile.valueSize
  const labelSize = profile.compact ? 9 : 11
  const eyebrow = isEnglish
    ? (entries.length > 1 ? 'Flexible pricing' : 'Rate highlight')
    : (entries.length > 1 ? 'Valores flexiveis' : 'Valor em destaque')
  const title = isEnglish
    ? (entries.length > 1 ? 'Stay your way' : 'Special condition')
    : (entries.length > 1 ? 'Escolha a melhor estada' : 'Condicao especial')
  const subtitle = isEnglish
    ? (entries.length > 1 ? 'Short and long stay options arranged to fit the property.' : 'A straightforward pricing frame sized for this ad.')
    : (entries.length > 1 ? 'Opcoes de curta e longa permanencia organizadas para caber no flyer.' : 'Um quadro direto de valores ajustado ao espaco deste anuncio.')

  const cardGap = profile.compact ? 8 : 10
  const cardHeight = profile.compact
    ? rect.height - innerPadding * 2
    : profile.landscape
      ? Math.min(88, rect.height - innerPadding * 2 - 42)
      : Math.min(96, (rect.height - innerPadding * 2 - (profile.showTitle ? 54 : 10) - cardGap) / Math.min(entries.length, 2))
  const visibleEntries = profile.compact ? entries.slice(0, 1) : entries.slice(0, 2)

  const cardsMarkup = profile.landscape && visibleEntries.length > 1
    ? visibleEntries.map((entry, index) => {
        const cardWidth = (rect.width - innerPadding * 2 - cardGap) / 2
        const cardX = rect.x + innerPadding + index * (cardWidth + cardGap)
        const cardY = rect.y + rect.height - innerPadding - cardHeight
        return `
          <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="12" ry="12" fill="rgba(255,255,255,0.72)" />
          <text x="${cardX + 14}" y="${cardY + 22}" font-family="Arial, Helvetica, sans-serif" font-size="${labelSize}" font-weight="700" fill="${textColor}" opacity="0.74">${escapeXml(entry.label)}</text>
          <text x="${cardX + 14}" y="${cardY + 22 + valueSize}" font-family="Arial, Helvetica, sans-serif" font-size="${valueSize}" font-weight="800" fill="${textColor}">${escapeXml(entry.value)}</text>
        `
      }).join('')
    : visibleEntries.map((entry, index) => {
        const cardWidth = rect.width - innerPadding * 2
        const cardX = rect.x + innerPadding
        const cardY = rect.y + rect.height - innerPadding - cardHeight * visibleEntries.length - cardGap * (visibleEntries.length - 1) + index * (cardHeight + cardGap)
        return `
          <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="12" ry="12" fill="rgba(255,255,255,0.72)" />
          <text x="${cardX + 14}" y="${cardY + 22}" font-family="Arial, Helvetica, sans-serif" font-size="${labelSize}" font-weight="700" fill="${textColor}" opacity="0.74">${escapeXml(entry.label)}</text>
          <text x="${cardX + 14}" y="${cardY + 22 + valueSize}" font-family="Arial, Helvetica, sans-serif" font-size="${valueSize}" font-weight="800" fill="${textColor}">${escapeXml(entry.value)}</text>
        `
      }).join('')

  const subtitleLines = profile.compact
    ? []
    : wrapText(subtitle, Math.max(18, Math.floor((rect.width - innerPadding * 2) / 8.5)), profile.tall ? 3 : 2)

  return `
    <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="14" ry="14" fill="${fillColor}" />
    ${profile.showTitle ? `<text x="${rect.x + innerPadding}" y="${rect.y + innerPadding + eyebrowSize}" font-family="Arial, Helvetica, sans-serif" font-size="${eyebrowSize}" font-weight="700" fill="${textColor}" opacity="0.64">${escapeXml(eyebrow)}</text>` : ''}
    ${profile.showTitle ? `<text x="${rect.x + innerPadding}" y="${rect.y + innerPadding + eyebrowSize + titleSize + 10}" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800" fill="${textColor}">${escapeXml(title)}</text>` : ''}
    ${buildWrappedTextMarkup(
      subtitleLines,
      rect.x + innerPadding,
      rect.y + innerPadding + eyebrowSize + titleSize + 28,
      profile.tone === 'showcase' ? 11 : 10,
      profile.tone === 'showcase' ? 16 : 14,
      textColor,
      600,
    )}
    ${cardsMarkup}
  `
}

function parseDisplayOwnerContact(ownerContact: string) {
  const pieces = ownerContact
    .split(/\s+[•|]\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const email = pieces.find((item) => item.includes('@')) || ''
  const phone = pieces.find((item) => /\d/.test(item) && !item.includes('@')) || ''
  const name = pieces.find((item) => item !== email && item !== phone) || pieces[0] || ''

  return { name, phone, email }
}

function buildContactBoxMarkup(
  rect: Rect,
  ownerContact: string,
  isEnglish: boolean,
  fillColor: string,
  textColor: string,
) {
  const normalizedContact = ownerContact.trim()
  if (!normalizedContact) return ''

  const profile = getAdaptiveBoxProfile(rect)
  const innerPadding = profile.padding
  const eyebrowSize = profile.compact ? 9 : 10
  const titleSize = profile.compact ? 12 : profile.tone === 'showcase' ? 16 : 14
  const bodySize = profile.compact ? 11 : profile.tone === 'showcase' ? 14 : 12
  const ctaSize = profile.compact ? 14 : profile.tone === 'showcase' ? 18 : 16
  const { name, phone, email } = parseDisplayOwnerContact(normalizedContact)
  const title = isEnglish ? 'Book a viewing' : 'Agende uma visita'
  const eyebrow = isEnglish ? 'Direct contact' : 'Contato direto'
  const bodyLead = isEnglish
    ? (profile.tall ? 'Speak with the owner and move faster.' : 'Owner details arranged for this format.')
    : (profile.tall ? 'Fale direto com o proprietario e acelere a negociacao.' : 'Dados do proprietario organizados para este formato.')
  const primaryLine = phone || email || name
  const secondaryLine = phone && email ? email : phone && name && name !== primaryLine ? name : email && name && name !== primaryLine ? name : ''
  const supportingLines = wrapText(bodyLead, Math.max(18, Math.floor((rect.width - innerPadding * 2) / 8.3)), profile.compact ? 1 : profile.tall ? 3 : 2)
  const primaryLines = wrapText(primaryLine, Math.max(16, Math.floor((rect.width - innerPadding * 2 - 24) / 8)), profile.compact ? 1 : 2)
  const secondaryLines = secondaryLine
    ? wrapText(secondaryLine, Math.max(18, Math.floor((rect.width - innerPadding * 2) / 9)), 1)
    : []
  const cardY = rect.y + rect.height - innerPadding - Math.min(profile.tone === 'showcase' ? 78 : 68, rect.height * 0.42)
  const cardHeight = rect.y + rect.height - innerPadding - cardY

  return `
    <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="14" ry="14" fill="${fillColor}" />
    ${profile.showTitle ? `<text x="${rect.x + innerPadding}" y="${rect.y + innerPadding + eyebrowSize}" font-family="Arial, Helvetica, sans-serif" font-size="${eyebrowSize}" font-weight="700" fill="${textColor}" opacity="0.64">${escapeXml(eyebrow)}</text>` : ''}
    <text x="${rect.x + innerPadding}" y="${rect.y + innerPadding + eyebrowSize + titleSize + 10}" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800" fill="${textColor}">${escapeXml(title)}</text>
    ${buildWrappedTextMarkup(
      supportingLines,
      rect.x + innerPadding,
      rect.y + innerPadding + eyebrowSize + titleSize + 30,
      bodySize,
      bodySize + 4,
      textColor,
      600,
    )}
    <rect x="${rect.x + innerPadding}" y="${cardY}" width="${rect.width - innerPadding * 2}" height="${cardHeight}" rx="12" ry="12" fill="rgba(255,255,255,0.72)" />
    ${buildWrappedTextMarkup(
      primaryLines,
      rect.x + innerPadding + 14,
      cardY + 24,
      ctaSize,
      ctaSize + 4,
      textColor,
      800,
    )}
    ${buildWrappedTextMarkup(
      secondaryLines,
      rect.x + innerPadding + 14,
      cardY + 24 + primaryLines.length * (ctaSize + 4) + 8,
      bodySize,
      bodySize + 3,
      textColor,
      700,
    )}
  `
}

function buildBaseLayoutBoxes(
  layoutSlots: LayoutSlot[],
  assignments: Record<string, SlotContentType>,
  hiddenSlotIds: string[],
): LayoutBoxNode[] {
  return layoutSlots
    .filter((slot) => !hiddenSlotIds.includes(slot.id))
    .map((slot) => ({
      assignment: assignments[slot.id] || 'empty',
      id: slot.id,
      label: slot.label,
      sourceSlotId: slot.id,
    }))
}

function flattenLayoutBoxes(nodes: LayoutBoxNode[]): LayoutBoxNode[] {
  return nodes.flatMap((node) => node.children ? flattenLayoutBoxes(node.children) : [node])
}

function mapLayoutBoxesToRects(
  nodes: LayoutBoxNode[],
  baseRects: Record<string, Rect>,
): { boxes: RenderedLayoutBox[]; parentRects: Record<string, Rect>; splitHandles: PreviewHandle[] } {
  const boxes: RenderedLayoutBox[] = []
  const parentRects: Record<string, Rect> = {}
  const splitHandles: PreviewHandle[] = []

  const walk = (node: LayoutBoxNode, rect: Rect) => {
    if (!node.children || !node.splitDirection) {
      boxes.push({ node, rect })
      return
    }

    parentRects[node.id] = rect

    if (node.splitDirection === 'vertical') {
      const splitRatio = clampRatio(node.splitRatio ?? 0.5)
      const childWidth = (rect.width - INNER_GAP) * splitRatio
      const leftRect: Rect = { x: rect.x, y: rect.y, width: childWidth, height: rect.height }
      const rightRect: Rect = { x: rect.x + childWidth + INNER_GAP, y: rect.y, width: rect.width - childWidth - INNER_GAP, height: rect.height }
      splitHandles.push({
        cursor: 'ew-resize',
        id: `custom-${node.id}`,
        x: rect.x + childWidth + INNER_GAP / 2,
        y: rect.y + rect.height / 2,
      })
      walk(node.children[0], leftRect)
      walk(node.children[1], rightRect)
      return
    }

    const splitRatio = clampRatio(node.splitRatio ?? 0.5)
    const childHeight = (rect.height - INNER_GAP) * splitRatio
    const topRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: childHeight }
    const bottomRect: Rect = { x: rect.x, y: rect.y + childHeight + INNER_GAP, width: rect.width, height: rect.height - childHeight - INNER_GAP }
    splitHandles.push({
      cursor: 'ns-resize',
      id: `custom-${node.id}`,
      x: rect.x + rect.width / 2,
      y: rect.y + childHeight + INNER_GAP / 2,
    })
    walk(node.children[0], topRect)
    walk(node.children[1], bottomRect)
  }

  nodes.forEach((node) => {
    const baseRect = baseRects[node.sourceSlotId]
    if (baseRect) walk(node, baseRect)
  })

  return { boxes, parentRects, splitHandles }
}

function updateLayoutBoxes(
  nodes: LayoutBoxNode[],
  targetId: string,
  updater: (node: LayoutBoxNode) => LayoutBoxNode,
): LayoutBoxNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return updater(node)
    }

    if (!node.children) return node

    return {
      ...node,
      children: updateLayoutBoxes(node.children, targetId, updater) as [LayoutBoxNode, LayoutBoxNode],
    }
  })
}

function findRenderedBox(boxes: RenderedLayoutBox[], id: string) {
  return boxes.find((box) => box.node.id === id) || null
}

function findLayoutNode(nodes: LayoutBoxNode[], id: string): LayoutBoxNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const match = findLayoutNode(node.children, id)
      if (match) return match
    }
  }
  return null
}

async function fileToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to convert image'))
    }
    reader.onerror = () => reject(new Error('Failed to convert image'))
    reader.readAsDataURL(blob)
  })
}

function getPreviewHandles(layoutVariant: LayoutVariant, rects: Record<string, Rect>, merges: LayoutMerges): PreviewHandle[] {
  if (layoutVariant === 'square-showcase') {
    return [
      { id: 'top-height', x: rects.hero.x + rects.hero.width / 2, y: rects.hero.y + rects.hero.height + INNER_GAP / 2, cursor: 'ns-resize' },
      { id: 'middle-height', x: rects.hero.x + rects.hero.width / 2, y: rects['content-main'].y + rects['content-main'].height + INNER_GAP / 2, cursor: 'ns-resize' },
      { id: 'top-split', x: rects.hero.x + rects.hero.width + INNER_GAP / 2, y: rects.hero.y + rects.hero.height / 2, cursor: 'ew-resize' },
      ...(!merges.mergeMediaStack ? [{ id: 'media-split', x: rects['media-a'].x + rects['media-a'].width / 2, y: rects['media-a'].y + rects['media-a'].height + INNER_GAP / 2, cursor: 'ns-resize' }] : []),
      ...(!merges.mergeBottom ? [{ id: 'bottom-split', x: rects['content-side-a'].x + rects['content-side-a'].width + INNER_GAP / 2, y: rects['content-side-a'].y + rects['content-side-a'].height / 2, cursor: 'ew-resize' }] : []),
    ]
  }

  if (layoutVariant === 'vertical-story' || layoutVariant === 'compact-portrait') {
    return [
      { id: 'hero-height', x: rects.hero.x + rects.hero.width / 2, y: rects.hero.y + rects.hero.height + INNER_GAP / 2, cursor: 'ns-resize' },
      { id: 'rows-split', x: rects['media-a'].x + rects['media-a'].width / 2, y: rects['media-a'].y + rects['media-a'].height + INNER_GAP / 2, cursor: 'ns-resize' },
      ...(!merges.mergeTopRow ? [{ id: 'top-row-split', x: rects['media-a'].x + rects['media-a'].width + INNER_GAP / 2, y: rects['media-a'].y + rects['media-a'].height / 2, cursor: 'ew-resize' }] : []),
      { id: 'bottom-row-split', x: rects['content-main'].x + rects['content-main'].width + INNER_GAP / 2, y: rects['content-main'].y + rects['content-main'].height / 2, cursor: 'ew-resize' },
      ...(!merges.mergeRightColumn ? [{ id: 'right-column-split', x: rects['content-side-a'].x + rects['content-side-a'].width / 2, y: rects['content-side-a'].y + rects['content-side-a'].height + INNER_GAP / 2, cursor: 'ns-resize' }] : []),
    ]
  }

  return [
    { id: 'top-height', x: rects.hero.x + rects.hero.width / 2, y: rects.hero.y + rects.hero.height + INNER_GAP / 2, cursor: 'ns-resize' },
    { id: 'middle-height', x: rects.hero.x + rects.hero.width / 2, y: rects['content-main'].y + rects['content-main'].height + INNER_GAP / 2, cursor: 'ns-resize' },
    { id: 'top-split', x: rects.hero.x + rects.hero.width + INNER_GAP / 2, y: rects.hero.y + rects.hero.height / 2, cursor: 'ew-resize' },
    ...(!merges.mergeMediaStack ? [
      { id: 'media-a-split', x: rects['media-a'].x + rects['media-a'].width / 2, y: rects['media-a'].y + rects['media-a'].height + INNER_GAP / 2, cursor: 'ns-resize' },
      { id: 'media-b-split', x: rects['media-b'].x + rects['media-b'].width / 2, y: rects['media-b'].y + rects['media-b'].height + INNER_GAP / 2, cursor: 'ns-resize' },
    ] : []),
    ...(!merges.mergeBottom ? [{ id: 'bottom-split', x: rects['content-side-a'].x + rects['content-side-a'].width + INNER_GAP / 2, y: rects['content-side-a'].y + rects['content-side-a'].height / 2, cursor: 'ew-resize' }] : []),
  ]
}

function applyHandleDrag(
  handleId: string,
  layoutVariant: LayoutVariant,
  x: number,
  y: number,
  widthPx: number,
  heightPx: number,
  currentRatios: LayoutRatios,
) {
  const next = { ...currentRatios }
  const { contentHeight, contentWidth, contentX, contentY } = getContentBounds(widthPx, heightPx)

  if (layoutVariant === 'square-showcase') {
    const availableHeight = contentHeight - INNER_GAP * 2
    const availableTopWidth = contentWidth - INNER_GAP
    if (handleId === 'top-height') next.topHeightRatio = clampRatio((y - contentY - INNER_GAP / 2) / availableHeight)
    if (handleId === 'middle-height') next.middleHeightRatio = clampRatio((y - contentY - (next.topHeightRatio ?? 0.38) * availableHeight - INNER_GAP * 1.5) / availableHeight)
    if (handleId === 'top-split') next.heroWidthRatio = clampRatio((x - contentX - INNER_GAP / 2) / availableTopWidth)
    if (handleId === 'media-split') {
      const rects = getSlotRects(layoutVariant, widthPx, heightPx, next)
      next.mediaTopRatio = clampRatio((y - rects['media-a'].y - INNER_GAP / 2) / (rects.hero.height - INNER_GAP))
    }
    if (handleId === 'bottom-split') next.bottomLeftRatio = clampRatio((x - contentX - INNER_GAP / 2) / availableTopWidth)
    return next
  }

  if (layoutVariant === 'vertical-story' || layoutVariant === 'compact-portrait') {
    const availableWidth = contentWidth - INNER_GAP
    if (handleId === 'hero-height') next.heroHeightRatio = clampRatio((y - contentY - INNER_GAP / 2) / contentHeight)
    if (handleId === 'top-row-split') next.topRowLeftRatio = clampRatio((x - contentX - INNER_GAP / 2) / availableWidth)
    if (handleId === 'bottom-row-split') next.bottomLeftRatio = clampRatio((x - contentX - INNER_GAP / 2) / availableWidth)
    if (handleId === 'rows-split' || handleId === 'right-column-split') {
      const rects = getSlotRects(layoutVariant, widthPx, heightPx, next)
      if (handleId === 'rows-split') {
        const bottomAreaHeight = rects['content-main'].height + INNER_GAP + rects['media-a'].height
        next.middleRowRatio = clampRatio((y - rects['media-a'].y - INNER_GAP / 2) / bottomAreaHeight)
      } else {
        next.rightColumnTopRatio = clampRatio((y - rects['content-side-a'].y - INNER_GAP / 2) / (rects['content-side-a'].height + rects['content-side-b'].height))
      }
    }
    return next
  }

  const availableHeight = contentHeight - INNER_GAP * 2
  const availableWidth = contentWidth - INNER_GAP
  if (handleId === 'top-height') next.topHeightRatio = clampRatio((y - contentY - INNER_GAP / 2) / availableHeight)
  if (handleId === 'middle-height') next.middleHeightRatio = clampRatio((y - contentY - (next.topHeightRatio ?? 0.32) * availableHeight - INNER_GAP * 1.5) / availableHeight)
  if (handleId === 'top-split') next.heroWidthRatio = clampRatio((x - contentX - INNER_GAP / 2) / availableWidth)
  if (handleId === 'bottom-split') next.bottomLeftRatio = clampRatio((x - contentX - INNER_GAP / 2) / availableWidth)
  if (handleId === 'media-a-split' || handleId === 'media-b-split') {
    const rects = getSlotRects(layoutVariant, widthPx, heightPx, next)
    const totalSideHeight = rects['media-a'].height + rects['media-b'].height + rects['media-c'].height
    if (handleId === 'media-a-split') {
      next.mediaTopRatio = clampRatio((y - rects['media-a'].y - INNER_GAP / 2) / totalSideHeight)
    } else {
      const mediaATopRatio = next.mediaTopRatio ?? 1 / 3
      next.mediaMiddleRatio = clampRatio((y - rects['media-b'].y - INNER_GAP / 2) / totalSideHeight)
      next.mediaMiddleRatio = Math.min(next.mediaMiddleRatio, 0.8 - mediaATopRatio)
    }
  }
  return next
}

type FlyerLayoutProps = {
  fillHeight?: boolean
  heightPx: number
  isEnglish: boolean
  layoutSlots: LayoutSlot[]
  layoutVariant: LayoutVariant
  selectedSlotId?: string | null
  slotAssignments: Record<string, SlotContentType>
  onSelectSlot?: (slotId: string) => void
}

function SlotBox({
  className,
  isEnglish,
  isSelected,
  slot,
  slotAssignments,
  onSelectSlot,
}: {
  className: string
  isEnglish: boolean
  isSelected: boolean
  slot: LayoutSlot
  slotAssignments: Record<string, SlotContentType>
  onSelectSlot?: (slotId: string) => void
}) {
  const palette = getSlotPalette(slotAssignments[slot.id] || 'empty', isEnglish)
  const content = (
    <>
      <span className="absolute left-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        {slot.label}
      </span>
      <span className="px-2 text-center text-[11px] font-semibold tracking-tight">
        {palette.label}
      </span>
    </>
  )

  if (onSelectSlot) {
    return (
      <button
        type="button"
        onClick={() => onSelectSlot(slot.id)}
        className={`relative flex items-center justify-center overflow-hidden rounded-md border border-white/60 transition ${palette.previewClass} ${className} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-md border border-white/60 ${palette.previewClass} ${className}`}>
      {content}
    </div>
  )
}

function FlyerLayout({
  fillHeight = false,
  heightPx,
  isEnglish,
  layoutSlots,
  layoutVariant,
  selectedSlotId,
  slotAssignments,
  onSelectSlot,
}: FlyerLayoutProps) {
  const renderSlot = (slotId: string, className: string) => {
    const slot = layoutSlots.find((item) => item.id === slotId)
    if (!slot) return null

    return (
      <SlotBox
        key={slotId}
        className={className}
        isEnglish={isEnglish}
        isSelected={selectedSlotId === slotId}
        slot={slot}
        slotAssignments={slotAssignments}
        onSelectSlot={onSelectSlot}
      />
    )
  }

  const frame = layoutVariant === 'square-showcase'
    ? (
        <div className="flex h-full flex-col gap-2 rounded-[24px] bg-white p-3">
          <div className="grid h-[38%] grid-cols-[1.2fr_0.8fr] gap-2">
            {renderSlot('hero', '')}
            <div className="grid grid-rows-2 gap-2">
              {renderSlot('media-a', '')}
              {renderSlot('media-b', '')}
            </div>
          </div>
          {renderSlot('content-main', 'h-full')}
          <div className="grid flex-1 grid-cols-2 gap-2">
            {renderSlot('content-side-a', '')}
            {renderSlot('content-side-b', '')}
          </div>
        </div>
      )
    : layoutVariant === 'vertical-story' || layoutVariant === 'compact-portrait'
      ? (
          <div className="flex h-full flex-col gap-2 rounded-[24px] bg-white p-3">
            {renderSlot('hero', 'h-[34%]')}
            <div className="grid flex-1 grid-rows-2 gap-2">
              <div className="grid grid-cols-2 gap-2">
                {renderSlot('media-a', '')}
                {renderSlot('media-b', '')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {renderSlot('content-main', 'min-h-0')}
                <div className="grid grid-rows-2 gap-2">
                  {renderSlot('content-side-a', '')}
                  {renderSlot('content-side-b', '')}
                </div>
              </div>
            </div>
          </div>
        )
      : (
          <div className="flex h-full flex-col gap-2 rounded-[24px] bg-white p-3">
            <div className="grid h-[32%] grid-cols-[1.2fr_0.8fr] gap-2">
              {renderSlot('hero', '')}
              <div className="grid grid-rows-3 gap-2">
                {renderSlot('media-a', '')}
                {renderSlot('media-b', '')}
                {renderSlot('media-c', '')}
              </div>
            </div>
            {renderSlot('content-main', 'h-full')}
            <div className={`grid flex-1 gap-2 ${layoutVariant.includes('landscape') ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1.2fr_0.8fr]'}`}>
              {renderSlot('content-side-a', '')}
              {renderSlot('content-side-b', '')}
            </div>
          </div>
        )

  return (
    <div
      className="box-border overflow-hidden rounded-[28px] border border-slate-200 bg-[#f5f1ea] p-6 shadow-sm"
      style={fillHeight ? { height: '100%' } : { height: heightPx }}
    >
      {frame}
    </div>
  )
}

function generatePDFfromCanvas(
  canvas: HTMLCanvasElement,
  options: {
    pdfFormat: 'a4' | 'a5' | [number, number]
    pdfOrientation: 'portrait' | 'landscape'
    marginTopMm: number
    marginSideMm: number
    marginBottomMm: number
  },
) {
  const pdf = new jsPDF({
    orientation: options.pdfOrientation,
    unit: 'mm',
    format: options.pdfFormat,
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const availableWidth = pageWidth - options.marginSideMm * 2
  const availableHeight = pageHeight - options.marginTopMm - options.marginBottomMm
  const aspectRatio = canvas.height / canvas.width
  const renderHeight = Math.min(availableHeight, availableWidth * aspectRatio)
  const renderWidth = renderHeight / aspectRatio
  const offsetX = options.marginSideMm + (availableWidth - renderWidth) / 2

  pdf.addImage(
    canvas.toDataURL('image/png', 1),
    'PNG',
    offsetX,
    options.marginTopMm,
    renderWidth,
    renderHeight,
  )

  return pdf
}

export function PropertyAdDialog({ open, onOpenChange, property, currentStatus }: PropertyAdDialogProps) {
  const { currentTenantId } = useAuth()
  const { t, language } = useLanguage()
  const [owners] = useKV<Owner[]>('owners', [])
  const [, setDocuments] = useKV<Document[]>('documents', [])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingDocument, setIsSavingDocument] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [adCopy, setAdCopy] = useState<GeneratedAdCopy | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4')
  const [disposition, setDisposition] = useState<DispositionOption>('portrait')
  const [outputFormat, setOutputFormat] = useState<OutputFormatOption>('pdf')
  const [customWidthPx, setCustomWidthPx] = useState('1080')
  const [customHeightPx, setCustomHeightPx] = useState('1350')
  const [layoutRatiosByVariant, setLayoutRatiosByVariant] = useState<Partial<Record<LayoutVariant, LayoutRatios>>>({})
  const [layoutMergesByVariant, setLayoutMergesByVariant] = useState<Partial<Record<LayoutVariant, LayoutMerges>>>({})
  const [layoutBoxesByVariant, setLayoutBoxesByVariant] = useState<Partial<Record<LayoutVariant, LayoutBoxNode[]>>>({})
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([])
  const previewSvgRef = useRef<SVGSVGElement | null>(null)
  const lastBoxClickRef = useRef<{ slotId: string; time: number } | null>(null)
  const lastDividerClickRef = useRef<{ handleId: string; time: number } | null>(null)

  const isEnglish = language === 'en'
  const pageSpec = useMemo(
    () => getPageSpec(pageSize, disposition, Number(customWidthPx), Number(customHeightPx)),
    [customHeightPx, customWidthPx, disposition, pageSize],
  )
  const layoutVariant = useMemo(
    () => getLayoutVariant(pageSize, disposition, pageSpec.widthPx, pageSpec.heightPx),
    [disposition, pageSize, pageSpec.heightPx, pageSpec.widthPx],
  )
  const layoutSlots = useMemo(
    () => getLayoutSlots(layoutVariant, isEnglish),
    [isEnglish, layoutVariant],
  )
  const currentLayoutRatios = layoutRatiosByVariant[layoutVariant] || getDefaultLayoutRatios(layoutVariant)
  const currentLayoutMerges = layoutMergesByVariant[layoutVariant] || getDefaultLayoutMerges()
  const previewGeometry = useMemo(
    () => getLayoutGeometry(layoutVariant, pageSpec.widthPx, pageSpec.heightPx, currentLayoutRatios, currentLayoutMerges),
    [currentLayoutMerges, currentLayoutRatios, layoutVariant, pageSpec.heightPx, pageSpec.widthPx],
  )
  const previewRects = useMemo(
    () => previewGeometry.rects,
    [previewGeometry],
  )
  const previewHandles = useMemo(
    () => getPreviewHandles(layoutVariant, previewRects, currentLayoutMerges),
    [currentLayoutMerges, layoutVariant, previewRects],
  )
  const [slotAssignments, setSlotAssignments] = useState<Record<string, SlotContentType>>(() => getDefaultSlotAssignments('editorial-portrait'))

  useEffect(() => {
    setSlotAssignments(getDefaultSlotAssignments(layoutVariant))
    setSelectedSlotId(getLayoutSlots(layoutVariant, isEnglish)[0]?.id || null)
    setIsGenerated(false)
    setAdCopy(null)
  }, [isEnglish, layoutVariant])

  useEffect(() => {
    setLayoutRatiosByVariant((current) => current[layoutVariant]
      ? current
      : { ...current, [layoutVariant]: getDefaultLayoutRatios(layoutVariant) })
  }, [layoutVariant])

  useEffect(() => {
    setLayoutMergesByVariant((current) => current[layoutVariant]
      ? current
      : { ...current, [layoutVariant]: getDefaultLayoutMerges() })
  }, [layoutVariant])

  const rootLayoutBoxes = useMemo(
    () => layoutBoxesByVariant[layoutVariant]
      || buildBaseLayoutBoxes(layoutSlots, slotAssignments, previewGeometry.hiddenSlotIds),
    [layoutBoxesByVariant, layoutSlots, layoutVariant, previewGeometry.hiddenSlotIds, slotAssignments],
  )
  const renderedLayout = useMemo(
    () => mapLayoutBoxesToRects(rootLayoutBoxes, previewRects),
    [previewRects, rootLayoutBoxes],
  )
  const leafBoxes = useMemo(
    () => flattenLayoutBoxes(rootLayoutBoxes),
    [rootLayoutBoxes],
  )

  useEffect(() => {
    setLayoutBoxesByVariant((current) => {
      if (current[layoutVariant]) return current
      return {
        ...current,
        [layoutVariant]: buildBaseLayoutBoxes(layoutSlots, slotAssignments, previewGeometry.hiddenSlotIds),
      }
    })
  }, [layoutSlots, layoutVariant, previewGeometry.hiddenSlotIds, slotAssignments])

  useEffect(() => {
    let isMounted = true

    const loadPhotoDataUrls = async () => {
      if (!open || !property?.photos?.length) {
        if (isMounted) setPhotoDataUrls([])
        return
      }

      const orderedPhotos = [...property.photos]
        .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder)

      const results = await Promise.all(orderedPhotos.map(async (photo) => {
        if (!photo.filePath) return null

        const { data, error } = await supabase.storage
          .from(PROPERTY_IMAGES_BUCKET)
          .createSignedUrl(photo.filePath, 60 * 30)

        if (error || !data?.signedUrl) {
          console.warn('Failed to create property image signed URL:', error?.message)
          return null
        }

        try {
          const response = await fetch(data.signedUrl)
          if (!response.ok) return null
          const blob = await response.blob()
          return await fileToDataUrl(blob)
        } catch (fetchError) {
          console.warn('Failed to load property image for ad:', fetchError)
          return null
        }
      }))

      if (isMounted) {
        setPhotoDataUrls(results.filter((value): value is string => Boolean(value)))
      }
    }

    void loadPhotoDataUrls()

    return () => {
      isMounted = false
    }
  }, [open, property])

  const normalizedSlotAssignments = useMemo(() => {
    const defaults = getDefaultSlotAssignments(layoutVariant)
    return layoutSlots.reduce<Record<string, SlotContentType>>((acc, slot) => {
      acc[slot.id] = slotAssignments[slot.id] || defaults[slot.id] || 'empty'
      return acc
    }, {})
  }, [layoutSlots, layoutVariant, slotAssignments])
  const ownerContact = useMemo(() => {
    if (!property?.ownerIds?.length || !owners.length) return ''

    const linkedOwners = property.ownerIds
      .map((ownerId) => owners.find((owner) => owner.id === ownerId))
      .filter((owner): owner is Owner => Boolean(owner))

    if (!linkedOwners.length) return ''

    const [primaryOwner] = linkedOwners
    const primaryPieces = [primaryOwner.name, primaryOwner.phone, primaryOwner.email].filter(Boolean)

    if (!primaryPieces.length) return ''

    if (linkedOwners.length === 1) {
      return primaryPieces.join(' • ')
    }

    const extraOwners = linkedOwners
      .slice(1)
      .map((owner) => owner.name)
      .filter(Boolean)

    return [...primaryPieces, ...extraOwners].join(' • ')
  }, [owners, property?.ownerIds])

  const normalizedOwnerContact = ownerContact.replace(/\u00e2\u20ac\u00a2/g, '•')
  const layoutVariantLabel = t.properties_view.ad_layout_types?.[layoutVariant]
    || LAYOUT_VARIANT_LABELS[layoutVariant][isEnglish ? 'en' : 'pt']
  const selectedSlot = leafBoxes.find((slot) => slot.id === selectedSlotId) || leafBoxes[0] || null
  const slotOptions = useMemo(
    () => (Object.keys(SLOT_CONTENT_LABELS) as SlotContentType[]).map((value) => ({
      value,
      label: SLOT_CONTENT_LABELS[value][isEnglish ? 'en' : 'pt'],
    })),
    [isEnglish],
  )
  const flyerSvgMarkup = useMemo(
    () => isGenerated ? buildFlyerSvgMarkup(pageSpec.widthPx, pageSpec.heightPx, layoutVariant, renderedLayout.boxes, property, normalizedOwnerContact, adCopy, isEnglish, photoDataUrls, currentLayoutRatios, currentLayoutMerges) : '',
    [adCopy, currentLayoutMerges, currentLayoutRatios, isEnglish, isGenerated, layoutVariant, normalizedOwnerContact, pageSpec.heightPx, pageSpec.widthPx, photoDataUrls, property, renderedLayout.boxes],
  )
  const flyerSvgDataUrl = useMemo(
    () => flyerSvgMarkup ? buildSvgDataUrl(flyerSvgMarkup) : '',
    [flyerSvgMarkup],
  )

  const getExportBaseName = () => property
    ? `anuncio-${sanitizeFileName(property.name).replace(/\.[^/.]+$/, '').toLowerCase()}`
    : 'anuncio-imovel'

  const renderFlyerCanvas = async () => {
    if (!flyerSvgDataUrl) {
      throw new Error(t.properties_view.ad_generate_first)
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(t.properties_view.ad_export_error))
      img.src = flyerSvgDataUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = pageSpec.widthPx
    canvas.height = pageSpec.heightPx
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error(t.properties_view.ad_export_error)
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  const updateCurrentLayoutRatios = (nextRatios: LayoutRatios) => {
    setLayoutRatiosByVariant((current) => ({
      ...current,
      [layoutVariant]: nextRatios,
    }))
    setIsGenerated(false)
  }

  const updateCurrentLayoutMerges = (nextMerges: LayoutMerges) => {
    setLayoutMergesByVariant((current) => ({
      ...current,
      [layoutVariant]: nextMerges,
    }))
    setIsGenerated(false)
  }

  const resetCurrentLayout = () => {
    setLayoutRatiosByVariant((current) => ({
      ...current,
      [layoutVariant]: getDefaultLayoutRatios(layoutVariant),
    }))
    setLayoutMergesByVariant((current) => ({
      ...current,
      [layoutVariant]: getDefaultLayoutMerges(),
    }))
    setLayoutBoxesByVariant((current) => ({
      ...current,
      [layoutVariant]: buildBaseLayoutBoxes(layoutSlots, slotAssignments, previewGeometry.hiddenSlotIds),
    }))
    setSelectedSlotId(getLayoutSlots(layoutVariant, isEnglish)[0]?.id || null)
    setIsGenerated(false)
  }

  const deleteDivider = (handleId: string) => {
    if (handleId === 'media-split' || handleId === 'media-a-split' || handleId === 'media-b-split') {
      updateCurrentLayoutMerges({ ...currentLayoutMerges, mergeMediaStack: true })
      return
    }

    if (handleId === 'bottom-split') {
      updateCurrentLayoutMerges({ ...currentLayoutMerges, mergeBottom: true })
      return
    }

    if (handleId === 'top-row-split') {
      updateCurrentLayoutMerges({ ...currentLayoutMerges, mergeTopRow: true })
      return
    }

    if (handleId === 'right-column-split') {
      updateCurrentLayoutMerges({ ...currentLayoutMerges, mergeRightColumn: true })
      return
    }
  }

  const splitBox = (slotId: string) => {
    const rendered = renderedLayout.boxes.find((box) => box.node.id === slotId)
    if (!rendered) return

    const splitDirection = rendered.rect.width >= rendered.rect.height ? 'vertical' : 'horizontal'

    setLayoutBoxesByVariant((current) => {
      const currentBoxes = current[layoutVariant] || rootLayoutBoxes
      return {
        ...current,
        [layoutVariant]: updateLayoutBoxes(currentBoxes, slotId, (node) => ({
          ...node,
          children: [
            {
              assignment: node.assignment,
              id: `${node.id}-a`,
              label: `${node.label} A`,
              sourceSlotId: node.sourceSlotId,
            },
            {
              assignment: 'empty',
              id: `${node.id}-b`,
              label: `${node.label} B`,
              sourceSlotId: node.sourceSlotId,
            },
          ],
          splitDirection,
          splitRatio: 0.5,
        })),
      }
    })
    setIsGenerated(false)
  }

  const handleBoxClick = (slotId: string) => {
    const now = Date.now()
    const last = lastBoxClickRef.current
    setSelectedSlotId(slotId)

    if (last && last.slotId === slotId && now - last.time <= DOUBLE_CLICK_MS) {
      splitBox(slotId)
      lastBoxClickRef.current = null
      return
    }

    lastBoxClickRef.current = { slotId, time: now }
  }

  const handleDividerClick = (handleId: string) => {
    const now = Date.now()
    const last = lastDividerClickRef.current

    if (last && last.handleId === handleId && now - last.time <= DOUBLE_CLICK_MS) {
      if (handleId.startsWith('custom-')) {
        handleCustomDividerDelete(handleId.replace(/^custom-/, ''))
      } else {
        deleteDivider(handleId)
      }
      lastDividerClickRef.current = null
      return
    }

    lastDividerClickRef.current = { handleId, time: now }
  }

  const handleCustomDividerDelete = (boxId: string) => {
    setLayoutBoxesByVariant((current) => {
      const currentBoxes = current[layoutVariant] || rootLayoutBoxes
      return {
        ...current,
        [layoutVariant]: updateLayoutBoxes(currentBoxes, boxId, (node) => ({
          ...node,
          children: undefined,
          splitDirection: undefined,
        })),
      }
    })
    setIsGenerated(false)
  }

  const updateCustomSplitRatio = (boxId: string, ratio: number) => {
    setLayoutBoxesByVariant((current) => {
      const currentBoxes = current[layoutVariant] || rootLayoutBoxes
      return {
        ...current,
        [layoutVariant]: updateLayoutBoxes(currentBoxes, boxId, (node) => ({
          ...node,
          splitRatio: clampRatio(ratio),
        })),
      }
    })
    setIsGenerated(false)
  }

  const handlePreviewResizeStart = (handleId: string) => (event: any) => {
    if (!previewSvgRef.current) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const svg = previewSvgRef.current
    if (handleId.startsWith('custom-')) {
      const boxId = handleId.replace(/^custom-/, '')
      const targetRect = renderedLayout.parentRects[boxId]

      const updateFromPointer = (clientX: number, clientY: number) => {
        const bounds = svg.getBoundingClientRect()
        const x = ((clientX - bounds.left) / bounds.width) * pageSpec.widthPx
        const y = ((clientY - bounds.top) / bounds.height) * pageSpec.heightPx
        if (!targetRect) return
        const parentNode = findLayoutNode(rootLayoutBoxes, boxId)
        if (!parentNode?.splitDirection) return
        const ratio = parentNode.splitDirection === 'vertical'
          ? (x - targetRect.x - INNER_GAP / 2) / (targetRect.width - INNER_GAP)
          : (y - targetRect.y - INNER_GAP / 2) / (targetRect.height - INNER_GAP)
        updateCustomSplitRatio(boxId, ratio)
      }

      updateFromPointer(event.clientX, event.clientY)

      const handleMove = (moveEvent: PointerEvent) => updateFromPointer(moveEvent.clientX, moveEvent.clientY)
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      return
    }

    const updateFromPointer = (clientX: number, clientY: number) => {
      const bounds = svg.getBoundingClientRect()
      const x = ((clientX - bounds.left) / bounds.width) * pageSpec.widthPx
      const y = ((clientY - bounds.top) / bounds.height) * pageSpec.heightPx
      const nextRatios = applyHandleDrag(handleId, layoutVariant, x, y, pageSpec.widthPx, pageSpec.heightPx, currentLayoutRatios)
      updateCurrentLayoutRatios(nextRatios)
    }

    updateFromPointer(event.clientX, event.clientY)

    const handleMove = (moveEvent: PointerEvent) => updateFromPointer(moveEvent.clientX, moveEvent.clientY)
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const buildExportFile = async (): Promise<{ blob: Blob; fileName: string; mimeType: string }> => {
    if (!property) throw new Error('Property not loaded')
    if (!isGenerated) throw new Error(t.properties_view.ad_generate_first)

    const baseName = getExportBaseName()

    if (outputFormat === 'pdf') {
      const canvas = await renderFlyerCanvas()
      const pdf = generatePDFfromCanvas(canvas, {
        pdfFormat: pageSpec.pdfFormat,
        pdfOrientation: pageSpec.pdfOrientation,
        marginTopMm: 4,
        marginSideMm: 4,
        marginBottomMm: 6,
      })

      return {
        blob: pdf.output('blob'),
        fileName: `${baseName}.pdf`,
        mimeType: 'application/pdf',
      }
    }

    const canvas = await renderFlyerCanvas()
    const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg'
    const quality = outputFormat === 'png' ? 1 : 0.92
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality))
    if (!blob) throw new Error(t.properties_view.ad_export_error)

    return {
      blob,
      fileName: `${baseName}.${outputFormat}`,
      mimeType,
    }
  }

  const handlePdfAction = async (action: 'download' | 'view') => {
    if (!property) return
    if (!isGenerated) {
      toast.error(t.properties_view.ad_generate_first)
      return
    }

    const canvas = await renderFlyerCanvas()
    const pdf = generatePDFfromCanvas(canvas, {
      pdfFormat: pageSpec.pdfFormat,
      pdfOrientation: pageSpec.pdfOrientation,
      marginTopMm: 4,
      marginSideMm: 4,
      marginBottomMm: 6,
    })
    const filename = `${getExportBaseName()}.pdf`

    if (action === 'download') {
      downloadPDF(pdf, filename)
      return
    }

    openPDFInNewTab(pdf)
  }

  const downloadImage = async (format: 'png' | 'jpg') => {
    if (!isGenerated) {
      toast.error(t.properties_view.ad_generate_first)
      return
    }
    const canvas = await renderFlyerCanvas()
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    const quality = format === 'png' ? 1 : 0.92
    const url = canvas.toDataURL(mimeType, quality)
    const link = document.createElement('a')
    link.href = url
    link.download = `${getExportBaseName()}.${format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleExport = async () => {
    try {
      if (outputFormat === 'pdf') {
        await handlePdfAction('download')
        return
      }

      await downloadImage(outputFormat)
    } catch (error: any) {
      toast.error(error?.message || t.properties_view.ad_export_error)
    }
  }

  const generateAd = async () => {
    if (!property) return

    setIsGenerating(true)
    setIsGenerated(false)
    try {
      const { data, error } = await supabase.functions.invoke<{ copy?: GeneratedAdCopy; error?: string }>('generate-property-ad', {
        body: {
          property,
          language,
          ownerContact,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setAdCopy(data?.copy || null)
      setIsGenerated(true)
    } catch (error: any) {
      setAdCopy(null)
      toast.error(error?.message || t.properties_view.ad_generate_error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveToDocuments = async () => {
    if (!property) return
    if (!currentTenantId) {
      toast.error(t.properties_view.ad_documents_tenant_required)
      return
    }

    setIsSavingDocument(true)

    try {
      const id = createId()
      const exportFile = await buildExportFile()
      const safeFileName = sanitizeFileName(exportFile.fileName)
      const filePath = `${currentTenantId}/${id}/${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(filePath, exportFile.blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: exportFile.mimeType,
        })

      if (uploadError) throw uploadError

      const newDocument: Document = {
        id,
        name: `${t.properties_view.generate_ad} - ${property.name}`,
        category: 'other',
        notes: `${t.properties_view.ad_saved_document_note_prefix} (${outputFormat.toUpperCase()}).`,
        relationType: 'property',
        relationId: property.id,
        propertyId: property.id,
        fileName: exportFile.fileName,
        filePath,
        fileSize: exportFile.blob.size,
        mimeType: exportFile.mimeType,
        uploadDate: new Date().toISOString(),
      }

      setDocuments((current) => [...(current || []), newDocument])
      toast.success(t.properties_view.ad_saved_to_documents)
    } catch (error: any) {
      toast.error(error?.message || t.properties_view.ad_save_document_error)
    } finally {
      setIsSavingDocument(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.properties_view.ad_generator_title}</DialogTitle>
          <DialogDescription>{t.properties_view.ad_generate_hint}</DialogDescription>
        </DialogHeader>

        {!property ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t.properties_view.type[property.type]}</Badge>
                {currentStatus ? <Badge>{t.properties_view.status[currentStatus]}</Badge> : null}
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={() => void generateAd()} disabled={isGenerating}>
                <ArrowsClockwise size={16} className={isGenerating ? 'animate-spin' : ''} />
                {t.properties_view.ad_generate_now}
              </Button>
            </div>

            <div className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>{t.properties_view.ad_page_size}</Label>
                <Select value={pageSize} onValueChange={(value) => setPageSize(value as PageSizeOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a5">A5</SelectItem>
                    <SelectItem value="square">{t.properties_view.ad_page_square}</SelectItem>
                    <SelectItem value="story">{t.properties_view.ad_page_story}</SelectItem>
                    <SelectItem value="custom">{t.properties_view.ad_page_custom}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.properties_view.ad_layout}</Label>
                <Select
                  value={disposition}
                  onValueChange={(value) => setDisposition(value as DispositionOption)}
                  disabled={pageSize === 'square' || pageSize === 'story' || pageSize === 'custom'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">{t.properties_view.ad_layout_portrait}</SelectItem>
                    <SelectItem value="landscape">{t.properties_view.ad_layout_landscape}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.properties_view.ad_output_format}</Label>
                <Select value={outputFormat} onValueChange={(value) => setOutputFormat(value as OutputFormatOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpg">JPG</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pageSize === 'custom' ? (
                <>
                  <div className="space-y-2">
                    <Label>{t.properties_view.ad_pixel_width}</Label>
                    <Input type="number" min={320} step={10} value={customWidthPx} onChange={(event) => setCustomWidthPx(event.target.value)} placeholder="1080" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.properties_view.ad_pixel_height}</Label>
                    <Input type="number" min={320} step={10} value={customHeightPx} onChange={(event) => setCustomHeightPx(event.target.value)} placeholder="1350" />
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t.properties_view.ad_layout_preview}</p>
                  <p className="text-xs text-muted-foreground">{layoutVariantLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={resetCurrentLayout}>
                    <ArrowCounterClockwise size={14} />
                    Resetar layout
                  </Button>
                  <Badge variant="outline">{pageSpec.widthPx} x {pageSpec.heightPx}px</Badge>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="relative w-full max-w-[380px] overflow-hidden rounded-xl border bg-[#f5f1ea] p-2 shadow-sm"
                  style={{ aspectRatio: `${pageSpec.widthPx} / ${pageSpec.heightPx}` }}
                >
                  <svg
                    ref={previewSvgRef}
                    viewBox={`0 0 ${pageSpec.widthPx} ${pageSpec.heightPx}`}
                    className="block h-full w-full touch-none"
                  >
                    <rect width={pageSpec.widthPx} height={pageSpec.heightPx} fill="#f5f1ea" />
                    <rect x={24} y={24} width={pageSpec.widthPx - 48} height={pageSpec.heightPx - 48} rx={28} ry={28} fill="#f5f1ea" stroke="#e2e8f0" strokeWidth={1.5} />
                    <rect x={36} y={36} width={pageSpec.widthPx - 72} height={pageSpec.heightPx - 72} rx={24} ry={24} fill="#ffffff" />
                    {renderedLayout.boxes.map(({ node, rect }) => {
                      const palette = getSlotSvgPalette(node.assignment || 'empty', isEnglish)
                      const isSelected = selectedSlot?.id === node.id
                      const pillWidth = Math.min(rect.width - 24, Math.max(72, node.label.length * 9))
                      return (
                        <g
                          key={node.id}
                          className="cursor-pointer"
                          onClick={() => handleBoxClick(node.id)}
                        >
                          <rect
                            x={rect.x}
                            y={rect.y}
                            width={rect.width}
                            height={rect.height}
                            rx={14}
                            ry={14}
                            fill={palette.bg}
                            stroke={isSelected ? '#2563eb' : '#ffffff'}
                            strokeWidth={isSelected ? 4 : 1.5}
                          />
                          <rect
                            x={rect.x + 14}
                            y={rect.y + 14}
                            width={pillWidth}
                            height={28}
                            rx={14}
                            ry={14}
                            fill="rgba(255,255,255,0.82)"
                          />
                          <text x={rect.x + 14 + pillWidth / 2} y={rect.y + 32} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="13" fontWeight="700" letterSpacing="1.2" fill="#475569">
                            {node.label.toUpperCase()}
                          </text>
                          <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2 + 6} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="18" fontWeight="700" fill={palette.fg}>
                            {palette.label}
                          </text>
                        </g>
                      )
                    })}
                    {[...previewHandles, ...renderedLayout.splitHandles].map((handle) => (
                      <g key={handle.id}>
                        <circle
                          cx={handle.x}
                          cy={handle.y}
                          r={HANDLE_RADIUS + 6}
                          fill="transparent"
                          className="cursor-pointer"
                          style={{ cursor: handle.cursor }}
                          onClick={() => handleDividerClick(handle.id)}
                          onPointerDown={handlePreviewResizeStart(handle.id)}
                        />
                        <circle
                          cx={handle.x}
                          cy={handle.y}
                          r={HANDLE_RADIUS}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={2}
                          style={{ cursor: handle.cursor }}
                          onClick={() => handleDividerClick(handle.id)}
                          onPointerDown={handlePreviewResizeStart(handle.id)}
                        />
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <p>{t.properties_view.ad_layout_preview_hint}</p>
                  <p>{t.properties_view.ad_layout_size_hint.replace('{width}', String(pageSpec.widthPx)).replace('{height}', String(pageSpec.heightPx))}</p>
                  {selectedSlot ? (
                    <div className="mt-4 rounded-xl border bg-background p-3 text-foreground">
                      <p className="text-sm font-medium">{selectedSlot.label}</p>
                      <p className="mb-3 text-xs text-muted-foreground">{t.properties_view.ad_slot_assignment_hint}</p>
                      <Select
                        value={selectedSlot.assignment || 'empty'}
                        onValueChange={(value) => {
                          setLayoutBoxesByVariant((current) => {
                            const currentBoxes = current[layoutVariant] || rootLayoutBoxes
                            return {
                              ...current,
                              [layoutVariant]: updateLayoutBoxes(currentBoxes, selectedSlot.id, (node) => ({
                                ...node,
                                assignment: value as SlotContentType,
                              })),
                            }
                          })
                          setIsGenerated(false)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {slotOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {isGenerating ? (
              <div className="rounded-[28px] border bg-card p-10 text-center text-muted-foreground">
                {t.properties_view.ad_generating}
              </div>
            ) : !isGenerated ? (
              <div className="rounded-[28px] border border-dashed bg-card p-10 text-center text-muted-foreground">
                {t.properties_view.ad_generate_hint}
              </div>
            ) : (
              <div className="overflow-auto rounded-[28px] border bg-muted/20 p-3">
                <img
                  src={flyerSvgDataUrl}
                  alt={t.properties_view.ad_generator_title}
                  className="block h-auto max-w-full rounded-[28px] border border-slate-200 bg-[#f5f1ea] shadow-sm"
                  width={pageSpec.widthPx}
                  height={pageSpec.heightPx}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.properties_view.form.cancel}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handlePdfAction('view')} disabled={!property || !isGenerated || isGenerating || outputFormat !== 'pdf'}>
            <Eye size={16} />
            {t.properties_view.ad_preview_pdf}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handleSaveToDocuments()} disabled={!property || !isGenerated || isGenerating || isSavingDocument}>
            <FloppyDisk size={16} />
            {t.properties_view.ad_save_to_documents}
          </Button>
          <Button type="button" className="gap-2" onClick={() => void handleExport()} disabled={!property || !isGenerated || isGenerating}>
            {outputFormat === 'pdf' ? <FilePdf size={16} /> : <FileArrowDown size={16} />}
            {outputFormat === 'pdf' ? t.properties_view.ad_download_pdf : t.properties_view.ad_download_image}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
