/** Get the Monday of the week containing the given date */
export function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Format a Date to YYYY-MM-DD */
export function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Get the 7 dates (Mon-Sun) of a week starting from the given Monday */
export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const MONTH_NAMES = [
  'jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

export const MONTH_NAMES_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

/** Format a week range for display: "24 fév. - 2 mars 2025" */
export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const mDay = monday.getDate()
  const mMonth = MONTH_NAMES[monday.getMonth()]
  const sDay = sunday.getDate()
  const sMonth = MONTH_NAMES[sunday.getMonth()]
  const year = sunday.getFullYear()
  if (monday.getMonth() === sunday.getMonth()) {
    return `${mDay} - ${sDay} ${sMonth} ${year}`
  }
  return `${mDay} ${mMonth} - ${sDay} ${sMonth} ${year}`
}

/** Get the ISO week number */
export function getWeekNumber(d: Date): number {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

/** Build display name for a client join object */
export function clientDisplayName(client?: { first_name?: string; last_name?: string; company_name?: string | null } | null): string {
  if (!client) return 'Client inconnu'
  if (client.company_name) return client.company_name
  return `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client inconnu'
}

/** Format time from HH:MM:SS to HH:MM */
export function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  return t.slice(0, 5)
}

/** Calculate duration in minutes from two HH:MM:SS or HH:MM strings */
export function getDurationMinutes(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

/** Format duration in minutes to "2h30" display format */
export function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  const mins = getDurationMinutes(start, end)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (m === 0) return `${h}h`
  return `${h}h${m.toString().padStart(2, '0')}`
}

/** Get all days in a month as a grid (including padding days from prev/next month) */
export function getMonthGrid(year: number, month: number): Array<{ date: Date; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Get the Monday before or on the first day
  const startDate = getMonday(firstDay)

  // We need enough rows to cover the month (always 6 rows = 42 cells for consistency)
  const days: Array<{ date: Date; isCurrentMonth: boolean }> = []
  const current = new Date(startDate)

  for (let i = 0; i < 42; i++) {
    days.push({
      date: new Date(current),
      isCurrentMonth: current.getMonth() === month,
    })
    current.setDate(current.getDate() + 1)
  }

  // Trim trailing row if all days are from next month
  if (!days[35].isCurrentMonth && lastDay.getDate() <= days[34].date.getDate() && days[34].isCurrentMonth === false) {
    return days.slice(0, 35)
  }

  return days
}
