export type PropertyContractRelation = {
  property_id?: string
}

export type AvailabilityProperty = {
  id: string
  name: string
  type?: string
}

export type AvailabilityGuest = {
  id: string
  name: string
}

export type AvailabilityContract = {
  id: string
  guest_id?: string | null
  start_date?: string | null
  end_date?: string | null
  status: string
  property_ids?: Array<string | PropertyContractRelation> | null
}

type BuildPropertyAvailabilityInput = {
  properties: AvailabilityProperty[]
  contracts: AvailabilityContract[]
  guests?: AvailabilityGuest[]
}

export function normalizeRelationIds(value: unknown, key: string) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') return (item as Record<string, unknown>)[key]
      return null
    })
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export function buildPropertyAvailability({ properties, contracts, guests = [] }: BuildPropertyAvailabilityInput) {
  return properties.map((property) => {
    const activeContracts = contracts
      .filter((contract) => {
        const propertyIds = normalizeRelationIds(contract.property_ids, 'property_id')
        return contract.status === 'active' && propertyIds.includes(property.id)
      })
      .map((contract) => ({
        id: contract.id,
        guest_id: contract.guest_id ?? null,
        guest_name: guests.find((guest) => guest.id === contract.guest_id)?.name || null,
        start_date: contract.start_date ?? null,
        end_date: contract.end_date ?? null,
        status: contract.status,
      }))

    return {
      id: property.id,
      name: property.name,
      type: property.type,
      computed_availability: activeContracts.length > 0 ? 'occupied' : 'available',
      availability_rule: 'occupied when there is at least one active contract linked to this property; otherwise available',
      active_contracts: activeContracts,
    }
  })
}

export function getPropertyAvailabilityStatus(propertyId: string, contracts: AvailabilityContract[]) {
  const hasActiveContract = contracts.some((contract) => {
    const propertyIds = normalizeRelationIds(contract.property_ids, 'property_id')
    return contract.status === 'active' && propertyIds.includes(propertyId)
  })

  return hasActiveContract ? 'occupied' : 'available'
}
