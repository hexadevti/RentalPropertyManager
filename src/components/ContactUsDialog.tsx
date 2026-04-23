import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChatCircleDots } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { supabase } from '@/lib/supabase'

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
  return 'Failed to send the message.'
}

export function ContactUsDialog({ fullWidth }: { fullWidth?: boolean } = {}) {
  const { currentUser, currentTenantId } = useAuth()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setSubject('')
    setDescription('')
    setIsSubmitting(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetForm()
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!currentTenantId || !currentUser) {
      toast.error(t.contact_us_dialog.session_error)
      return
    }

    if (!subject.trim()) {
      toast.error(t.contact_us_dialog.subject_required)
      return
    }

    if (!description.trim()) {
      toast.error(t.contact_us_dialog.description_required)
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke<{ success?: boolean; sentTo?: number; error?: string }>('contact-admins', {
        body: {
          tenantId: currentTenantId,
          subject: subject.trim(),
          description: description.trim(),
          senderLogin: currentUser.login,
          senderEmail: currentUser.email || null,
          currentUrl: window.location.href,
        },
      })

      if (error) {
        throw new Error(await readFunctionErrorMessage(error))
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      toast.success(t.contact_us_dialog.created_success)
      setOpen(false)
      resetForm()
    } catch (error: unknown) {
      const message = error instanceof Error && error.message
        ? error.message
        : t.contact_us_dialog.create_error
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-2${fullWidth ? ' w-full' : ''}`}>
          <ChatCircleDots size={16} weight="duotone" />
          {t.contact_us_dialog.trigger_label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.contact_us_dialog.title}</DialogTitle>
          <DialogDescription>{t.contact_us_dialog.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-us-subject">{t.contact_us_dialog.subject}</Label>
            <Input
              id="contact-us-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t.contact_us_dialog.subject_placeholder}
              maxLength={140}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-us-description">{t.contact_us_dialog.question_description}</Label>
            <Textarea
              id="contact-us-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              placeholder={t.contact_us_dialog.question_placeholder}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              {t.contact_us_dialog.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t.contact_us_dialog.submitting : t.contact_us_dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
