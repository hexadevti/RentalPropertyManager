import { useState } from 'react'
import type { FormEvent } from 'react'
import { EnvelopeSimple, PaperPlaneTilt } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

interface InviteTenantUserDialogProps {
  tenantId: string
  triggerLabel: string
  title: string
  description: string
  emailLabel: string
  roleLabel: string
  messageLabel: string
  messagePlaceholder: string
  cancelLabel: string
  submitLabel: string
  submittingLabel: string
  emailRequiredMessage: string
  successMessage: string
  errorMessage: string
  roleAdminLabel: string
  roleGuestLabel: string
  onInvited?: () => void
}

async function readFunctionErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (typeof context === 'string' && context) return context
    if (context instanceof Response) {
      const bodyText = await context.text().catch(() => '')
      try {
        const parsed = bodyText ? JSON.parse(bodyText) : null
        if (parsed?.error) return parsed.error
      } catch {}
      if (bodyText) return bodyText
    }
  }
  if (error instanceof Error && error.message) return error.message
  return 'Failed to send invitation.'
}

export function InviteTenantUserDialog({
  tenantId,
  triggerLabel,
  title,
  description,
  emailLabel,
  roleLabel,
  messageLabel,
  messagePlaceholder,
  cancelLabel,
  submitLabel,
  submittingLabel,
  emailRequiredMessage,
  successMessage,
  errorMessage,
  roleAdminLabel,
  roleGuestLabel,
  onInvited,
}: InviteTenantUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('guest')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = () => {
    setEmail('')
    setRole('guest')
    setMessage('')
    setIsSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      reset()
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!email.trim()) {
      toast.error(emailRequiredMessage)
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean
        invitationId?: string
        error?: string
      }>('tenant-user-invitations', {
        body: {
          action: 'send',
          tenantId,
          email: email.trim(),
          role,
          message: message.trim(),
          appBaseUrl: window.location.origin,
        },
      })

      if (error) {
        throw new Error(await readFunctionErrorMessage(error))
      }
      if (data?.error) {
        throw new Error(data.error)
      }

      toast.success(successMessage)
      handleOpenChange(false)
      onInvited?.()
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : errorMessage
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={!tenantId}>
          <EnvelopeSimple size={16} weight="duotone" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{emailLabel}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">{roleLabel}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{roleAdminLabel}</SelectItem>
                <SelectItem value="guest">{roleGuestLabel}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-message">{messageLabel}</Label>
            <Textarea
              id="invite-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder={messagePlaceholder}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
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
