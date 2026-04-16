import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Property } from '@/types'

export function usePropertyMigration() {
  const [properties, setProperties] = useKV<Property[]>('properties', [])

  useEffect(() => {
    if (!properties || properties.length === 0) return

    let needsMigration = false
    const migratedProperties = properties.map(property => {
      if (!property.ownerIds) {
        needsMigration = true
        return {
          ...property,
          ownerIds: []
        }
      }
      return property
    })

    if (needsMigration) {
      setProperties(migratedProperties)
    }
  }, [properties, setProperties])
}
