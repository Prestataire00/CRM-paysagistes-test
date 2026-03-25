import { useQuery } from '@tanstack/react-query'
import { CloudSun } from 'lucide-react'

interface WeatherDay {
  date: string
  tempMax: number
  tempMin: number
  description: string
  icon: string
}

const WEATHER_ICONS: Record<string, string> = {
  Sunny: '☀️',
  Clear: '☀️',
  'Partly cloudy': '⛅',
  'Partly Cloudy': '⛅',
  Cloudy: '☁️',
  Overcast: '☁️',
  Mist: '🌫️',
  Fog: '🌫️',
  'Light rain': '🌦️',
  'Light drizzle': '🌦️',
  Rain: '🌧️',
  'Heavy rain': '🌧️',
  'Moderate rain': '🌧️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  'Light snow': '🌨️',
}

function getWeatherIcon(desc: string): string {
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (desc.toLowerCase().includes(key.toLowerCase())) return icon
  }
  return '🌤️'
}

async function fetchWeather(): Promise<WeatherDay[]> {
  const res = await fetch('https://wttr.in/Tours?format=j1')
  if (!res.ok) throw new Error('Weather API error')

  const data = await res.json()
  const forecast = data.weather ?? []

  return forecast.slice(0, 4).map((day: any) => ({
    date: day.date,
    tempMax: Number(day.maxtempC),
    tempMin: Number(day.mintempC),
    description: day.hourly?.[4]?.weatherDesc?.[0]?.value ?? 'N/A',
    icon: getWeatherIcon(day.hourly?.[4]?.weatherDesc?.[0]?.value ?? ''),
  }))
}

const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function WeatherWidget() {
  const { data: forecast, isLoading, isError } = useQuery({
    queryKey: ['weather', 'tours'],
    queryFn: fetchWeather,
    staleTime: 60 * 60 * 1000, // 1 hour cache
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-lg">
        <CloudSun className="w-3.5 h-3.5 animate-pulse" />
        <span>Météo...</span>
      </div>
    )
  }

  if (isError || !forecast || forecast.length === 0) {
    return null // Silent fallback
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg">
      {forecast.map((day, i) => {
        const d = new Date(day.date)
        const dayName = i === 0 ? "Auj" : DAY_NAMES_SHORT[d.getDay()]
        return (
          <div key={day.date} className="flex flex-col items-center gap-0.5" title={day.description}>
            <span className="text-[9px] text-slate-400 font-medium">{dayName}</span>
            <span className="text-sm leading-none">{day.icon}</span>
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] font-semibold text-slate-700">{day.tempMax}°</span>
              <span className="text-[9px] text-slate-400">{day.tempMin}°</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
