import type { PropertyType } from '@/types'

export type ListingImportDraft = {
  sourceUrl: string
  name: string
  description: string
  address: string
  city: string
  capacity: number
  pricePerNight: number
  pricePerMonth: number
  type: PropertyType
  photoUrls: string[]
}

const DEFAULT_DRAFT: Omit<ListingImportDraft, 'sourceUrl' | 'name'> = {
  description: '',
  address: '',
  city: '',
  capacity: 1,
  pricePerNight: 0,
  pricePerMonth: 0,
  type: 'apartment',
  photoUrls: [],
}

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function parsePriceToNumber(raw: string) {
  const cleaned = raw.replace(/[^\d.,]/g, '').trim()
  if (!cleaned) return 0
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(',', '.')) || 0
  }
  return Number(cleaned) || 0
}

function pickFirst(...values: Array<string | undefined | null>) {
  return (values.find((value) => typeof value === 'string' && value.trim().length > 0) || '').trim()
}

function extractMeta(html: string, prop: string) {
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
  const match = html.match(regex)
  return match ? decodeHtml(match[1]) : ''
}

function uniqueHttpUrls(urls: string[]) {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const raw of urls) {
    const url = raw.trim()
    if (!/^https?:\/\//i.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    normalized.push(url)
  }
  return normalized
}

function extractScriptBlocks(html: string) {
  const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  return matches
    .map((block) => block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim())
    .filter(Boolean)
}

function toJsonObjects(rawBlock: string): any[] {
  const parsed: any[] = []
  try {
    const value = JSON.parse(rawBlock)
    if (Array.isArray(value)) return value
    return [value]
  } catch {
    const sanitized = rawBlock
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
    try {
      const value = JSON.parse(sanitized)
      if (Array.isArray(value)) return value
      return [value]
    } catch {
      return parsed
    }
  }
}

function findListingNode(objects: any[]) {
  const queue = [...objects]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue

    const typeValue = current['@type']
    const typeAsText = Array.isArray(typeValue) ? typeValue.join(' ') : String(typeValue || '')
    if (/lodgingbusiness|hotel|residence|apartment|house|accommodation/i.test(typeAsText)) {
      return current
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        queue.push(...value)
      } else if (value && typeof value === 'object') {
        queue.push(value)
      }
    }
  }
  return null
}

function extractImagesFromListingNode(listingNode: any) {
  const candidateUrls: string[] = []

  const imageValue = listingNode?.image
  if (typeof imageValue === 'string') {
    candidateUrls.push(imageValue)
  } else if (Array.isArray(imageValue)) {
    for (const item of imageValue) {
      if (typeof item === 'string') candidateUrls.push(item)
      else if (item && typeof item === 'object' && typeof item.url === 'string') candidateUrls.push(item.url)
    }
  } else if (imageValue && typeof imageValue === 'object' && typeof imageValue.url === 'string') {
    candidateUrls.push(imageValue.url)
  }

  return uniqueHttpUrls(candidateUrls).slice(0, 12)
}

function extractCapacity(text: string) {
  const match = text.match(/(\d+)\s*(?:guests?|h[oó]spedes?|people|persons?)/i)
  const parsed = Number(match?.[1] || 0)
  return parsed > 0 ? parsed : 1
}

function mapTypeFromText(text: string): PropertyType {
  if (/room|quarto/i.test(text)) return 'room'
  if (/parking|garage|garagem|estacionamento/i.test(text)) return 'parking'
  if (/house|casa/i.test(text)) return 'house'
  return 'apartment'
}

function parseFromHtml(sourceUrl: string, html: string): ListingImportDraft {
  const scripts = extractScriptBlocks(html)
  const allJsonObjects = scripts.flatMap(toJsonObjects)
  const listingNode = findListingNode(allJsonObjects)

  const name = pickFirst(
    listingNode?.name,
    extractMeta(html, 'og:title'),
    extractMeta(html, 'twitter:title')
  )

  const description = pickFirst(
    listingNode?.description,
    extractMeta(html, 'og:description'),
    extractMeta(html, 'description')
  )

  const city = pickFirst(
    listingNode?.address?.addressLocality,
    listingNode?.address?.addressRegion
  )

  const address = pickFirst(
    listingNode?.address?.streetAddress,
    listingNode?.address?.name,
    city
  )

  const priceFromStructured = pickFirst(
    listingNode?.offers?.price,
    listingNode?.offers?.priceSpecification?.price,
    listingNode?.priceRange
  )

  const fallbackText = `${name} ${description}`
  const priceFromTextMatch = fallbackText.match(/(?:R\$|US\$|€|£|\$)\s?([\d.,]+)/i)
  const pricePerNight = parsePriceToNumber(priceFromStructured || (priceFromTextMatch?.[0] || ''))
  const photoUrls = uniqueHttpUrls([
    ...extractImagesFromListingNode(listingNode),
    extractMeta(html, 'og:image'),
    extractMeta(html, 'twitter:image'),
  ]).slice(0, 12)

  if (!name) {
    throw new Error('Could not identify listing title from the provided URL.')
  }

  return {
    sourceUrl,
    name,
    description,
    address,
    city,
    capacity: extractCapacity(fallbackText),
    pricePerNight,
    pricePerMonth: pricePerNight > 0 ? Math.round(pricePerNight * 30) : 0,
    type: mapTypeFromText(fallbackText),
    photoUrls,
  }
}

function parseFromProxyText(sourceUrl: string, text: string): ListingImportDraft {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const firstHeading = lines.find((line) => line.startsWith('# '))?.replace(/^#\s+/, '') || ''
  const descriptionCandidate = lines.slice(0, 12).join(' ').slice(0, 600)

  const cityMatch = text.match(/(?:in|em)\s+([A-ZÀ-ÿ][\wÀ-ÿ\s-]{2,40})/i)
  const priceMatch = text.match(/(?:R\$|US\$|€|£|\$)\s?([\d.,]+)/i)

  const name = firstHeading || pickFirst(lines[0], lines[1])
  if (!name) {
    throw new Error('Could not identify listing title from the provided URL.')
  }

  const pricePerNight = parsePriceToNumber(priceMatch?.[0] || '')

  return {
    sourceUrl,
    name,
    description: descriptionCandidate,
    address: cityMatch?.[1] || '',
    city: cityMatch?.[1] || '',
    capacity: extractCapacity(text),
    pricePerNight,
    pricePerMonth: pricePerNight > 0 ? Math.round(pricePerNight * 30) : 0,
    type: mapTypeFromText(text),
    photoUrls: [],
  }
}

export async function fetchListingImportDraft(inputUrl: string): Promise<ListingImportDraft> {
  const normalizedUrl = normalizeUrl(inputUrl)
  if (!normalizedUrl) {
    throw new Error('Please provide a valid URL.')
  }

  let directHtml = ''
  try {
    const response = await fetch(normalizedUrl)
    if (response.ok) {
      directHtml = await response.text()
      if (directHtml && /<html/i.test(directHtml)) {
        return { ...DEFAULT_DRAFT, ...parseFromHtml(normalizedUrl, directHtml) }
      }
    }
  } catch {
    // Ignore direct fetch errors and fallback to proxy text extraction.
  }

  const proxyUrl = `https://r.jina.ai/http://${normalizedUrl.replace(/^https?:\/\//i, '')}`
  const proxyResponse = await fetch(proxyUrl)
  if (!proxyResponse.ok) {
    throw new Error('Could not fetch page data for import.')
  }

  const proxyText = await proxyResponse.text()
  if (!proxyText.trim()) {
    throw new Error('Could not extract listing data from this URL.')
  }

  if (/<html/i.test(proxyText)) {
    return { ...DEFAULT_DRAFT, ...parseFromHtml(normalizedUrl, proxyText) }
  }

  return { ...DEFAULT_DRAFT, ...parseFromProxyText(normalizedUrl, proxyText) }
}
