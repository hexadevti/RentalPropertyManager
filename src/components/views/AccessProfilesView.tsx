import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ACCESS_ROLES, AccessLevel, AccessProfile, AccessProfileRole, AccessRoleId } from '@/types'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Pencil, Plus, ShieldCheck, Trash } from '@phosphor-icons/react'

type AccessProfileFormState = {
  id: string
  name: string
  description: string
  isSystem: boolean
  accessLevels: Record<AccessRoleId, AccessLevel>
}

const EMPTY_LEVELS = ACCESS_ROLES.reduce((acc, role) => {
  acc[role.id] = 'none'
  return acc
}, {} as Record<AccessRoleId, AccessLevel>)

export default function AccessProfilesView({ readOnly = false }: { readOnly?: boolean }) {
  const { currentTenantId } = useAuth()
  const { t } = useLanguage()
  const [profiles, setProfiles] = useState<AccessProfile[]>([])
  const [profileRoles, setProfileRoles] = useState<AccessProfileRole[]>([])
  const [availableRoleIds, setAvailableRoleIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [formState, setFormState] = useState<AccessProfileFormState>({
    id: '',
    name: '',
    description: '',
    isSystem: false,
    accessLevels: { ...EMPTY_LEVELS },
  })

  const loadAccessProfiles = useCallback(async () => {
    if (!currentTenantId) {
      setProfiles([])
      setProfileRoles([])
      return
    }

    setIsLoading(true)
    const [
      { data: profileRows, error: profilesError },
      { data: roleRows, error: rolesError },
      { data: accessRoleRows, error: accessRolesError },
    ] = await Promise.all([
      supabase
        .from('access_profiles')
        .select('tenant_id, id, name, description, is_system, created_at, updated_at')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: true }),
      supabase
        .from('access_profile_roles')
        .select('tenant_id, access_profile_id, access_role_id, access_level, created_at, updated_at')
        .eq('tenant_id', currentTenantId),
      supabase
        .from('access_roles')
        .select('id'),
    ])

    if (profilesError || rolesError || accessRolesError) {
      toast.error(profilesError?.message || rolesError?.message || accessRolesError?.message || t.access_profiles_view.load_error)
      setProfiles([])
      setProfileRoles([])
      setAvailableRoleIds(new Set())
      setIsLoading(false)
      return
    }

    setAvailableRoleIds(new Set((accessRoleRows || []).map((row: any) => String(row.id))))

    setProfiles((profileRows || []).map((row: any) => ({
      tenantId: row.tenant_id,
      id: row.id,
      name: row.name,
      description: row.description || '',
      isSystem: !!row.is_system,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })))
    setProfileRoles((roleRows || []).map((row: any) => ({
      tenantId: row.tenant_id,
      accessProfileId: row.access_profile_id,
      accessRoleId: row.access_role_id,
      accessLevel: row.access_level,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })))
    setIsLoading(false)
  }, [currentTenantId])

  const effectiveAccessRoles = useMemo(() => {
    if (availableRoleIds.size === 0) return ACCESS_ROLES
    return ACCESS_ROLES.filter((role) => availableRoleIds.has(role.id))
  }, [availableRoleIds])

  useEffect(() => {
    void loadAccessProfiles()
  }, [loadAccessProfiles])

  const permissionSummary = useMemo(() => {
    return new Map(
      profiles.map((profile) => {
        const levels = effectiveAccessRoles.map((role) => {
          const found = profileRoles.find((item) => item.accessProfileId === profile.id && item.accessRoleId === role.id)
          return found
            ? `${role.label}: ${found.accessLevel === 'write' ? t.access_profiles_view.permission_read_write : t.access_profiles_view.permission_read_only}`
            : null
        }).filter(Boolean) as string[]
        return [profile.id, levels]
      })
    )
  }, [effectiveAccessRoles, profileRoles, profiles, t])

  const resetForm = () => {
    setEditingProfileId(null)
    setFormState({
      id: '',
      name: '',
      description: '',
      isSystem: false,
      accessLevels: { ...EMPTY_LEVELS },
    })
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (profile: AccessProfile) => {
    const nextLevels = { ...EMPTY_LEVELS }
    profileRoles
      .filter((item) => item.accessProfileId === profile.id)
      .forEach((item) => {
        nextLevels[item.accessRoleId] = item.accessLevel
      })

    setEditingProfileId(profile.id)
    setFormState({
      id: profile.id,
      name: profile.name,
      description: profile.description || '',
      isSystem: profile.isSystem,
      accessLevels: nextLevels,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!currentTenantId) return
    if (!formState.name.trim()) {
      toast.error(t.access_profiles_view.name_required)
      return
    }

    setIsSaving(true)
    try {
      const profileId = editingProfileId || `custom-${Date.now()}`
      const nowIso = new Date().toISOString()

      const { error: profileError } = await supabase
        .from('access_profiles')
        .upsert({
          tenant_id: currentTenantId,
          id: profileId,
          name: formState.name.trim(),
          description: formState.description.trim(),
          is_system: formState.isSystem,
          created_at: editingProfileId ? undefined : nowIso,
          updated_at: nowIso,
        }, { onConflict: 'tenant_id,id' })

      if (profileError) throw profileError

      const selectedRoles = Object.entries(formState.accessLevels)
        .filter(([, level]) => level !== 'none')
        .filter(([accessRoleId]) => availableRoleIds.has(accessRoleId))
        .map(([accessRoleId, accessLevel]) => ({
          tenant_id: currentTenantId,
          access_profile_id: profileId,
          access_role_id: accessRoleId,
          access_level: accessLevel,
          created_at: nowIso,
          updated_at: nowIso,
        }))

      const previousRoleIds = profileRoles
        .filter((item) => item.accessProfileId === profileId)
        .map((item) => item.accessRoleId)

      const nextRoleIds = new Set(selectedRoles.map((item) => item.access_role_id))
      const idsToDelete = previousRoleIds.filter((item) => !nextRoleIds.has(item))

      if (idsToDelete.length > 0) {
        const { error: deleteRolesError } = await supabase
          .from('access_profile_roles')
          .delete()
          .eq('tenant_id', currentTenantId)
          .eq('access_profile_id', profileId)
          .in('access_role_id', idsToDelete)

        if (deleteRolesError) throw deleteRolesError
      }

      if (selectedRoles.length > 0) {
        const { error: rolesError } = await supabase
          .from('access_profile_roles')
          .upsert(selectedRoles, { onConflict: 'tenant_id,access_profile_id,access_role_id' })

        if (rolesError) throw rolesError
      }

      toast.success(editingProfileId ? t.access_profiles_view.updated_success : t.access_profiles_view.created_success)
      setIsDialogOpen(false)
      resetForm()
      await loadAccessProfiles()
    } catch (error: any) {
      toast.error(error?.message || t.access_profiles_view.save_error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (profile: AccessProfile) => {
    if (profile.id === 'system-administrator') {
      toast.error(t.access_profiles_view.cannot_delete_admin)
      return
    }
    if (!window.confirm(t.access_profiles_view.delete_confirm.replace('{name}', profile.name))) return
    try {
      const nowIso = new Date().toISOString()

      const { error: unlinkUsersError } = await supabase
        .from('user_profiles')
        .update({
          access_profile_id: null,
          updated_at: nowIso,
        })
        .eq('tenant_id', currentTenantId)
        .eq('access_profile_id', profile.id)

      if (unlinkUsersError) throw unlinkUsersError

      const { error } = await supabase
        .from('access_profiles')
        .delete()
        .eq('tenant_id', currentTenantId)
        .eq('id', profile.id)

      if (error) throw error
      toast.success(t.access_profiles_view.deleted_success)
      await loadAccessProfiles()
    } catch (error: any) {
      toast.error(error?.message || t.access_profiles_view.delete_error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t.access_profiles_view.title}</h2>
          <p className="text-sm text-muted-foreground">{t.access_profiles_view.subtitle}</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2" disabled={readOnly}>
          <Plus size={16} />
          {t.access_profiles_view.new_profile}
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">{t.access_profiles_view.loading}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck size={18} />
                      {profile.name}
                    </CardTitle>
                    <CardDescription>{profile.description || t.access_profiles_view.no_description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {profile.isSystem && <Badge variant="outline">{t.access_profiles_view.system_badge}</Badge>}
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(profile)} disabled={readOnly}>
                      <Pencil size={16} />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => void handleDelete(profile)} disabled={readOnly || profile.id === 'system-administrator'}>
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(permissionSummary.get(profile.id) || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(permissionSummary.get(profile.id) || []).map((item) => (
                      <Badge key={item} variant="secondary">{item}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.access_profiles_view.no_roles}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[92vh] sm:max-w-3xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{editingProfileId ? t.access_profiles_view.edit_title : t.access_profiles_view.create_title}</DialogTitle>
            <DialogDescription>{t.access_profiles_view.dialog_description}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="access-profile-name">{t.access_profiles_view.name_label}</Label>
                <Input
                  id="access-profile-name"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-profile-description">{t.access_profiles_view.description_label}</Label>
                <Input
                  id="access-profile-description"
                  value={formState.description}
                  onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t.access_profiles_view.roles_label}</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {effectiveAccessRoles.map((role) => (
                  <div key={role.id} className="rounded-lg border p-3 space-y-2">
                    <div>
                      <p className="font-medium">{role.label}</p>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                    <Select
                      value={formState.accessLevels[role.id]}
                      onValueChange={(value) => setFormState((current) => ({
                        ...current,
                        accessLevels: {
                          ...current.accessLevels,
                          [role.id]: value as AccessLevel,
                        },
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t.access_profiles_view.no_access}</SelectItem>
                        <SelectItem value="read">{t.access_profiles_view.permission_read_only}</SelectItem>
                        <SelectItem value="write">{t.access_profiles_view.permission_read_write}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>{t.access_profiles_view.cancel}</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? t.access_profiles_view.saving : t.access_profiles_view.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
