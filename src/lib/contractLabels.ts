import { format } from 'date-fns'
import type { Contract, Property } from '@/types'

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
  const startDate = format(new Date(contract.startDate), 'dd/MM/yyyy')
  const endDate = format(new Date(contract.endDate), 'dd/MM/yyyy')

  return `${resolvedPropertyNames} - ${startDate} - ${endDate}`
}
