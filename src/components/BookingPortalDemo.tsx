import { useEffect } from 'react'

interface BookingPortalDemoProps {
  onClose: () => void
  lang: 'pt' | 'en'
  t: any
}

export function BookingPortalDemo({ onClose }: BookingPortalDemoProps) {
  useEffect(() => {
    // Abrir o portal real em outra aba
    window.open(`${window.location.origin}/demo`, '_blank')
    // Voltar para a homepage
    onClose()
  }, [onClose])

  return null
}
