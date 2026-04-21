import { describe, expect, it } from 'vitest'

import { buildPropertyAvailability, getPropertyAvailabilityStatus, normalizeRelationIds } from '@/lib/propertyAvailability'

describe('propertyAvailability', () => {
  it('normalizes related property ids from strings or objects', () => {
    expect(normalizeRelationIds(['p1', { property_id: 'p2' }, { other: 'x' }], 'property_id')).toEqual(['p1', 'p2'])
  })

  it('marks a property as occupied only when there is an active linked contract', () => {
    const properties = [
      { id: 'p1', name: 'Quarto 1', type: 'room' },
      { id: 'p2', name: 'Quarto 2', type: 'room' },
    ]
    const contracts = [
      { id: 'c1', status: 'active', guest_id: 'g1', property_ids: [{ property_id: 'p1' }] },
      { id: 'c2', status: 'expired', guest_id: 'g2', property_ids: [{ property_id: 'p2' }] },
    ]
    const guests = [
      { id: 'g1', name: 'Maria' },
      { id: 'g2', name: 'Joao' },
    ]

    expect(buildPropertyAvailability({ properties, contracts, guests })).toEqual([
      {
        id: 'p1',
        name: 'Quarto 1',
        type: 'room',
        computed_availability: 'occupied',
        availability_rule: 'occupied when there is at least one active contract linked to this property; otherwise available',
        active_contracts: [
          {
            id: 'c1',
            guest_id: 'g1',
            guest_name: 'Maria',
            start_date: null,
            end_date: null,
            status: 'active',
          },
        ],
      },
      {
        id: 'p2',
        name: 'Quarto 2',
        type: 'room',
        computed_availability: 'available',
        availability_rule: 'occupied when there is at least one active contract linked to this property; otherwise available',
        active_contracts: [],
      },
    ])
  })

  it('returns available when the property has no active contract', () => {
    expect(getPropertyAvailabilityStatus('p2', [
      { id: 'c1', status: 'expired', property_ids: [{ property_id: 'p2' }] },
      { id: 'c2', status: 'active', property_ids: [{ property_id: 'p1' }] },
    ])).toBe('available')
  })
})
