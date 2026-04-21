import { format, parseISO } from 'date-fns'
import type { Contract, Property } from '@/types'

function parseContractDate(value: string) {
  return value.includes('T') ? new Date(value) : parseISO(value)
}

export function getContractSelectionLabel(
  contract: Contract,
  properties: Property[] | undefined,
  fallbackPropertyName = 'Propriedade não encontrada'
) {
  const propertyNames = (contract.propertyIds || [])
    .map((propertyId) => (properties || []).find((property) => property.id === propertyId)?.name)
    .filter(Boolean)
    .join(', ')

  const resolvedPropertyNames = propertyNames || fallbackPropertyName
  const startDate = format(parseContractDate(contract.startDate), 'dd/MM/yyyy')
  const endDate = format(parseContractDate(contract.endDate), 'dd/MM/yyyy')

  return `${resolvedPropertyNames} - ${startDate} - ${endDate}`
}
