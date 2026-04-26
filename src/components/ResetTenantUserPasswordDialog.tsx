import { useState } from 'react'
import type { FormEvent } from 'react'
import { Key, PaperPlaneTilt } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getEdgeFunctionErrorFromInvokeError, getEdgeFunctionErrorFromPayload, getEdgeFunctionMessage } from '@/lib/edgeFunctionMessages'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/lib/LanguageContext'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'

interface ResetTenantUserPasswordDialogProps {
  tenantId: string
  login: string
  email: string
  triggerLabel: string
  title: string
  description: string
  messageLabel: string
  messagePlaceholder: string
  cancelLabel: string
  submitLabel: string
  submittingLabel: string
  successMessage: string
  errorMessage: string
  onSent?: () => void
}

export function ResetTenantUserPasswordDialog({
  tenantId,
  login,
  email,
  triggerLabel,
  title,
  description,
  messageLabel,
  messagePlaceholder,
  cancelLabel,
  submitLabel,
  submittingLabel,
  successMessage,
  errorMessage,
  onSent,
}: ResetTenantUserPasswordDialogProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean
        error?: string
        errorKey?: string
        errorParams?: Record<string, string | number>
      }>('tenant-user-invitations', {
        body: {
          action: 'send-password-reset',
          tenantId,
          login,
          email,
          message: message.trim(),
          appBaseUrl: window.location.origin,
        },
      })

      if (error) throw await getEdgeFunctionErrorFromInvokeError(error, errorMessage)
      const responseError = getEdgeFunctionErrorFromPayload(data, errorMessage)
      if (responseError) throw responseError

      toast.success(successMessage)
      setOpen(false)
      setMessage('')
      onSent?.()
    } catch (error: unknown) {
      toast.error(getEdgeFunctionMessage(error, t, errorMessage))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={!tenantId || !email}>
          <Key size={16} weight="duotone" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p><strong>Usuário:</strong> {login}</p>
            <p><strong>E-mail:</strong> {email}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`reset-password-message-${login}`}>{messageLabel}</Label>
            <Textarea
              id={`reset-password-message-${login}`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder={messagePlaceholder}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <PaperPlaneTilt size={16} weight="duotone" className="mr-2" />
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
