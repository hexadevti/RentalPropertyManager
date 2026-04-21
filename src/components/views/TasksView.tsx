import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Task, TaskPriority, TaskStatus, Property } from '@/types'
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
  const [tasks, setTasks] = useKV<Task[]>('tasks', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus,
    assignee: '',
    propertyId: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingTask) {
      const updatedTask: Task = {
        ...formData,
        id: editingTask.id,
        createdAt: editingTask.createdAt,
      }
      setTasks((current) => (current || []).map((task) => task.id === editingTask.id ? updatedTask : task))
      toast.success('Task updated successfully')
    } else {
      const newTask: Task = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      }
      setTasks((current) => [...(current || []), newTask])
      toast.success('Task added successfully')
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      status: 'pending',
      assignee: '',
      propertyId: ''
    })
    setEditingTask(null)
    setIsDialogOpen(false)
  }

  const handleOpenCreate = () => {
    setEditingTask(null)
    setFormData({
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      status: 'pending',
      assignee: '',
      propertyId: ''
    })
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
      assignee: task.assignee || '',
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
    setTasks((current) => (current || []).filter(t => t.id !== id))
    toast.success('Task deleted')
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">Tasks & Appointments</h2>
            <HelpButton content={helpContent} title="Ajuda — Tarefas" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Manage maintenance and administrative tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : resetForm()}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={handleOpenCreate}>
                <Plus weight="bold" size={16} />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1">
                {editingTask ? 'Edit Task' : 'Add Task'}
                <HelpButton content={formHelpContent} title="Ajuda — Formulário de Tarefa" />
              </DialogTitle>
              <DialogDescription>{editingTask ? 'Update task details and status' : 'Create a new task or appointment'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Fix leaking faucet"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Task details..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <DateInput
                    id="dueDate"
                    value={formData.dueDate}
                    onChange={(value) => setFormData({ ...formData, dueDate: value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignee">Assignee (Optional)</Label>
                  <Input
                    id="assignee"
                    value={formData.assignee}
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                    placeholder="Service provider or person"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyId">Property (Optional)</Label>
                  <Select value={formData.propertyId || 'none'} onValueChange={(value) => setFormData({ ...formData, propertyId: value === 'none' ? '' : value })}>
                    <SelectTrigger id="propertyId">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(properties || []).map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">{editingTask ? 'Save Changes' : 'Add Task'}</Button>
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
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first task to get started</p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus weight="bold" size={16} />
              Add Task
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
                        {task.priority}
                      </Badge>
                      {isPastDue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}</span>
                      {task.assignee && <span>• Assigned to: {task.assignee}</span>}
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
