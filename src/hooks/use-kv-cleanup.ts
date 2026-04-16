import { useEffect } from 'react'

export function useKVCleanup() {
  useEffect(() => {
    const cleanupOldKVs = async () => {
      try {
        const allKeys = await spark.kv.keys()
        
        const deprecatedKVs = ['bookings']
        
        for (const key of deprecatedKVs) {
          if (allKeys.includes(key)) {
            await spark.kv.delete(key)
            console.log(`KV limpo: ${key}`)
          }
        }
        
        const migrationComplete = await spark.kv.get<boolean>('kv-migration-v1')
        if (!migrationComplete) {
          await spark.kv.set('kv-migration-v1', true)
          console.log('Migração de KVs concluída')
        }
      } catch (error) {
        console.error('Erro ao limpar KVs:', error)
      }
    }

    cleanupOldKVs()
  }, [])
}
