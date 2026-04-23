import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Guest, Owner, Property, ServiceProvider, Task, TaskAssigneeType, TaskPriority, TaskStatus } from '@/types'
import helpContent from '@/docs/tasks.md?raw'
import formHelpContent from '@/docs/form-task.md?raw'
import { HelpButton } from '@/components/HelpButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, CheckSquare, Trash, ArrowsClockwise, PencilSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/LanguageContext'

export default function TasksView() {
  const { t } = useLanguage()
  const tv = t.tasks_view
  const [tasks, setTasks] = useKV<Task[]>('tasks', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus,
    assigneeType: '' as TaskAssigneeType | '',
    assigneeId: '',
    propertyId: ''
  })

  const personOptionsForType = (type: TaskAssigneeType | ''): { id: string; name: string }[] => {
    if (type === 'owner') return (owners || []).map(o => ({ id: o.id, name: o.name }))
    if (type === 'guest') return (guests || []).map(g => ({ id: g.id, name: g.name }))
    if (type === 'service-provider') return (serviceProviders || []).map(sp => ({ id: sp.id, name: sp.name }))
    return []
  }

  const resolveAssigneeName = (type: TaskAssigneeType | '', id: string): string | undefined => {
    if (!type || !id) return undefined
    return personOptionsForType(type).find(p => p.id === id)?.name
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const assigneeName = resolveAssigneeName(formData.assigneeType, formData.assigneeId)
    const assigneeType = formData.assigneeType || undefined
    const assigneeId = formData.assigneeId || undefined

    if (editingTask) {
      const updatedTask: Task = {
        id: editingTask.id,
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        priority: formData.priority,
        status: formData.status,
        assigneeName,
        assigneeType,
        assigneeId,
        propertyId: formData.propertyId || undefined,
        createdAt: editingTask.createdAt,
      }
      setTasks((current) => (current || []).map((task) => task.id === editingTask.id ? updatedTask : task))
      toast.success(tv.form.updated_success)
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        priority: formData.priority,
        status: formData.status,
        assigneeName,
        assigneeType,
        assigneeId,
        propertyId: formData.propertyId || undefined,
        createdAt: new Date().toISOString()
      }
      setTasks((current) => [...(current || []), newTask])
      toast.success(tv.form.created_success)
    }

    resetForm()
  }

  const emptyForm = () => ({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus,
    assigneeType: '' as TaskAssigneeType | '',
    assigneeId: '',
    propertyId: ''
  })

  const resetForm = () => {
    setFormData(emptyForm())
    setEditingTask(null)
    setIsDialogOpen(false)
  }

  const handleOpenCreate = () => {
    setEditingTask(null)
    setFormData(emptyForm())
    setIsDialogOpen(true)
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      assigneeType: task.assigneeType || '',
      assigneeId: task.assigneeId || '',
      propertyId: task.propertyId || ''
    })
    setIsDialogOpen(true)
  }

  const handleToggle = (taskId: string) => {
    setTasks((current) =>
      (current || []).map(task =>
        task.id === taskId
          ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' }
          : task
      )
    )
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setTasks((current) => (current || []).filter(t => t.id !== id))
    toast.success(tv.deleted_success)
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'bg-destructive/10 text-destructive-foreground border-destructive/20'
      case 'medium': return 'bg-accent/10 text-accent-foreground border-accent/20'
      case 'low': return 'bg-muted text-muted-foreground border-border'
    }
  }

  const sortedTasks = [...(tasks || [])].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'completed' ? 1 : -1
    }
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  const handleRefresh = () => {
    setTasks((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{tv.title}</h2>
            <HelpButton content={helpContent} title="Ajuda — Tarefas" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : resetForm()}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={handleOpenCreate}>
                <Plus weight="bold" size={16} />
                {tv.add_task}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1">
                {editingTask ? tv.form.title_edit : tv.form.title_new}
                <HelpButton content={formHelpContent} title="Ajuda — Formulário de Tarefa" />
              </DialogTitle>
              <DialogDescription>{editingTask ? tv.form.updated_success : tv.form.created_success}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{tv.form.task_title}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={tv.form.title_placeholder}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{tv.form.description}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={tv.form.description_placeholder}
                  rows={3}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">{tv.form.due_date}</Label>
                  <DateInput
                    id="dueDate"
                    value={formData.dueDate}
                    onChange={(value) => setFormData({ ...formData, dueDate: value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">{tv.form.priority}</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}>
                    <SelectTrigger id="priority">
                      <SelectValue placeholder={tv.form.select_priority} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{tv.priority.low}</SelectItem>
                      <SelectItem value="medium">{tv.priority.medium}</SelectItem>
                      <SelectItem value="high">{tv.priority.high}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assigneeType">{tv.form.assignee_type} {tv.form.optional}</Label>
                  <Select
                    value={formData.assigneeType || 'none'}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      assigneeType: value === 'none' ? '' : value as TaskAssigneeType,
                      assigneeId: ''
                    })}
                  >
                    <SelectTrigger id="assigneeType">
                      <SelectValue placeholder={tv.form.select_assignee_type} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tv.no_assignee}</SelectItem>
                      <SelectItem value="owner">{tv.assignee_types.owner}</SelectItem>
                      <SelectItem value="guest">{tv.assignee_types.guest}</SelectItem>
                      <SelectItem value="service-provider">{tv.assignee_types.service_provider}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigneeId">{tv.form.assignee}</Label>
                  <Select
                    value={formData.assigneeId || 'none'}
                    disabled={!formData.assigneeType}
                    onValueChange={(value) => setFormData({ ...formData, assigneeId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger id="assigneeId">
                      <SelectValue placeholder={tv.form.select_person} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tv.form.assignee_placeholder}</SelectItem>
                      {personOptionsForType(formData.assigneeType).map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyId">{tv.form.property} {tv.form.optional}</Label>
                <Select value={formData.propertyId || 'none'} onValueChange={(value) => setFormData({ ...formData, propertyId: value === 'none' ? '' : value })}>
                  <SelectTrigger id="propertyId">
                    <SelectValue placeholder={tv.form.select_property} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tv.no_property}</SelectItem>
                    {(properties || []).map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{tv.form.status}</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder={tv.form.select_status} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{tv.status.pending}</SelectItem>
                    <SelectItem value="in-progress">{tv.status['in-progress']}</SelectItem>
                    <SelectItem value="completed">{tv.status.completed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {tv.form.cancel}
                </Button>
                <Button type="submit">{tv.form.save}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {!tasks || tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckSquare weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{tv.no_tasks}</h3>
            <p className="text-sm text-muted-foreground mb-4">{tv.add_first}</p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus weight="bold" size={16} />
              {tv.add_task}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const property = (properties || []).find(p => p.id === task.propertyId)
            const isPastDue = new Date(task.dueDate) < new Date() && task.status !== 'completed'

            return (
              <Card key={task.id} className={task.status === 'completed' ? 'opacity-60' : ''}>
                <CardContent className="flex items-start gap-4 p-4">
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={() => handleToggle(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {task.title}
                      </h3>
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {tv.priority[task.priority]}
                      </Badge>
                      {isPastDue && <Badge variant="destructive" className="text-xs">{tv.overdue}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{tv.due_date}: {format(new Date(task.dueDate), 'MMM dd, yyyy')}</span>
                      {task.assigneeName && (
                        <span>• {tv.assignee}: {task.assigneeName}{task.assigneeType ? ` (${tv.assignee_types[task.assigneeType === 'service-provider' ? 'service_provider' : task.assigneeType]})` : ''}</span>
                      )}
                      {property && <span>• {property.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(task)}>
                      <PencilSimple size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(task.id)}>
                      <Trash size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
