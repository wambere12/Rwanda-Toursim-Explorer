import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSun, Droplets, Sun, Wind } from 'lucide-react';
import { WeatherForecast } from '../../types/tourism.ts';

interface WeatherCardProps {
  latitude: number;
  longitude: number;
  locationName: string;
}

function WeatherIcon({ condition, className = 'w-5 h-5' }: { condition: string; className?: string }) {
  switch (condition) {
    case 'clear':
      return <Sun className={`${className} text-[#D9A441]`} />;
    case 'rain':
    case 'storm':
      return <CloudRain className={`${className} text-[#16865B]`} />;
    case 'cloudy':
    case 'fog':
      return <Cloud className={`${className} text-[#69766E]`} />;
    default:
      return <CloudSun className={`${className} text-[#D9A441]`} />;
  }
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  latitude,
  longitude,
  locationName,
}) => {
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/external/weather?lat=${latitude}&lon=${longitude}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Weather data unavailable');
        return (await res.json()) as WeatherForecast;
      })
      .then((data) => {
        if (active) setWeather(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Weather unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  if (loading) {
    return (
      <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 animate-pulse space-y-4">
        <div className="h-4 w-40 bg-[#E3E9E4] rounded" />
        <div className="h-10 w-28 bg-[#E3E9E4] rounded" />
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className="h-16 bg-[#FAF9F5] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 text-sm text-[#69766E]">
        Live weather forecast for {locationName} is temporarily unavailable.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E3E9E4] rounded-xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#69766E]">
            Live Forecast · {locationName}
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-[#123D2B] tabular-nums">
              {Math.round(weather.current.temperatureC)}°C
            </span>
            <span className="text-sm font-medium text-[#202923]">
              {weather.current.label}
            </span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-lg bg-[#FAF9F5] border border-[#E3E9E4] flex items-center justify-center">
          <WeatherIcon condition={weather.current.condition} className="w-6 h-6" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1 border-t border-[#E3E9E4] text-xs">
        <div className="pt-3 flex items-center gap-2 text-[#202923]">
          <Droplets className="w-4 h-4 text-[#16865B]" />
          <div>
            <p className="text-[#69766E]">Rain Chance</p>
            <p className="font-semibold tabular-nums">{weather.current.rainProbability}%</p>
          </div>
        </div>
        <div className="pt-3 flex items-center gap-2 text-[#202923]">
          <Wind className="w-4 h-4 text-[#16865B]" />
          <div>
            <p className="text-[#69766E]">Wind</p>
            <p className="font-semibold tabular-nums">{Math.round(weather.current.windSpeedKmh)} km/h</p>
          </div>
        </div>
        <div className="pt-3 flex items-center gap-2 text-[#202923]">
          <Cloud className="w-4 h-4 text-[#16865B]" />
          <div>
            <p className="text-[#69766E]">Humidity</p>
            <p className="font-semibold tabular-nums">{weather.current.humidityPercent}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-[#E3E9E4]">
        {weather.forecast.map((day) => {
          const weekday = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
          });
          return (
            <div
              key={day.date}
              className="bg-[#FAF9F5] rounded-lg px-2 py-2.5 text-center space-y-1.5"
            >
              <p className="text-[11px] font-medium text-[#69766E]">{weekday}</p>
              <div className="flex justify-center">
                <WeatherIcon condition={day.condition} className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-[#202923] tabular-nums">
                {Math.round(day.tempMaxC)}° / {Math.round(day.tempMinC)}°
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-[#69766E]">Source: Open-Meteo (Africa/Kigali)</p>
    </div>
  );
};
