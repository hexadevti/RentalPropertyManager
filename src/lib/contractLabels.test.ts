import { describe, expect, it } from 'vitest'

import { getContractSelectionLabel } from '@/lib/contractLabels'
import type { Contract, Property } from '@/types'

describe('getContractSelectionLabel', () => {
  const properties: Property[] = [
    {
      id: 'p1',
      name: 'Quarto 10',
      type: 'room',
      capacity: 1,
      pricePerNight: 150,
      pricePerMonth: 2000,
      address: '',
      city: '',
      conservationState: '',
      environments: [],
      furnitureItems: [],
      inspectionItems: [],
      description: '',
      ownerIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      status: 'available',
    },
  ]

  it('builds the selection label with property and contract dates', () => {
    const contract: Contract = {
      id: 'c1',
      guestId: 'g1',
      propertyIds: ['p1'],
      rentalType: 'monthly',
      startDate: '2026-01-15',
      endDate: '2026-02-15',
      paymentDueDay: 10,
      monthlyAmount: 2000,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    expect(getContractSelectionLabel(contract, properties)).toBe('Quarto 10 - 15/01/2026 - 15/02/2026')
  })

  it('uses the fallback property name when the property is not found', () => {
    const contract: Contract = {
      id: 'c2',
      guestId: 'g1',
      propertyIds: ['missing'],
      rentalType: 'monthly',
      startDate: '2026-03-01',
      endDate: '2026-04-01',
      paymentDueDay: 10,
      monthlyAmount: 2200,
      status: 'active',
      createdAt: '2026-03-01T00:00:00.000Z',
    }

    expect(getContractSelectionLabel(contract, properties, 'Imovel nao encontrado')).toBe('Imovel nao encontrado - 01/03/2026 - 01/04/2026')
  })

  it('lists multiple properties in the selection label', () => {
    const contract: Contract = {
      id: 'c3',
      guestId: 'g1',
      propertyIds: ['p1', 'p2'],
      rentalType: 'monthly',
      startDate: '2026-05-01',
      endDate: '2026-06-01',
      paymentDueDay: 10,
      monthlyAmount: 2500,
      status: 'active',
      createdAt: '2026-05-01T00:00:00.000Z',
    }
    const multiProperties = [
      ...properties,
      {
        ...properties[0],
        id: 'p2',
        name: 'Quarto 11',
      },
    ]

    expect(getContractSelectionLabel(contract, multiProperties)).toBe('Quarto 10, Quarto 11 - 01/05/2026 - 01/06/2026')
  })
})
