import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Booking, Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar as CalendarIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isWithinInterval } from 'date-fns'

export default function CalendarView() {
  const [bookings, setBookings] = useKV<Booking[]>('bookings', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  const [formData, setFormData] = useState({
    propertyId: '',
    guestName: '',
    checkIn: '',
    checkOut: '',
    totalAmount: 0,
    platform: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newBooking: Booking = {
      ...formData,
      id: Date.now().toString(),
      status: 'confirmed',
      createdAt: new Date().toISOString()
    }
    setBookings((current) => [...(current || []), newBooking])
    toast.success('Booking added successfully')
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      propertyId: '',
      guestName: '',
      checkIn: '',
      checkOut: '',
      totalAmount: 0,
      platform: ''
    })
    setIsDialogOpen(false)
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getBookingsForDay = (day: Date, propertyId: string) => {
    return (bookings || []).filter(booking => 
      booking.propertyId === propertyId &&
      isWithinInterval(day, {
        start: new Date(booking.checkIn),
        end: new Date(booking.checkOut)
      })
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Calendar</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage bookings and availability</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
              Previous
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
              Next
            </Button>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" size={16} />
                Add Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Booking</DialogTitle>
                <DialogDescription>Create a new booking for a property</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="propertyId">Property</Label>
                  <Select value={formData.propertyId} onValueChange={(value) => setFormData({ ...formData, propertyId: value })} required>
                    <SelectTrigger id="propertyId">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {(properties || []).map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guestName">Guest Name</Label>
                  <Input
                    id="guestName"
                    value={formData.guestName}
                    onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="checkIn">Check-in</Label>
                    <Input
                      id="checkIn"
                      type="date"
                      value={formData.checkIn}
                      onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkOut">Check-out</Label>
                    <Input
                      id="checkOut"
                      type="date"
                      value={formData.checkOut}
                      onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">Total Amount ($)</Label>
                    <Input
                      id="totalAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform (Optional)</Label>
                    <Input
                      id="platform"
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      placeholder="Airbnb, Booking.com"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Booking</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!properties || properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarIcon weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No properties available</h3>
            <p className="text-sm text-muted-foreground">Add properties first to manage bookings</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(properties || []).map((property) => (
            <Card key={property.id}>
              <CardHeader>
                <CardTitle className="text-lg">{property.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day) => {
                    const dayBookings = getBookingsForDay(day, property.id)
                    const hasBooking = dayBookings.length > 0
                    const isToday = isSameDay(day, new Date())
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`
                          p-3 rounded-lg border text-center transition-colors
                          ${isToday ? 'border-primary border-2' : 'border-border'}
                          ${hasBooking ? 'bg-accent/20' : 'bg-card'}
                        `}
                      >
                        <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                        <div className="text-sm font-semibold mt-1">{format(day, 'd')}</div>
                        {hasBooking && (
                          <div className="mt-2">
                            <Badge className="text-xs px-1 py-0">Booked</Badge>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.filter(b => new Date(b.checkOut) >= new Date()).map((booking) => {
              const property = (properties || []).find(p => p.id === booking.propertyId)
              return (
                <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">{booking.guestName}</p>
                    <p className="text-sm text-muted-foreground">
                      {property?.name} • {format(new Date(booking.checkIn), 'MMM dd')} - {format(new Date(booking.checkOut), 'MMM dd, yyyy')}
                    </p>
                    {booking.platform && <Badge variant="outline" className="mt-1 text-xs">{booking.platform}</Badge>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">${booking.totalAmount}</p>
                    <Badge className="mt-1">{booking.status}</Badge>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
