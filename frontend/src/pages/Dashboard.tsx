import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useToast } from '../components/Toast'
import {
  ShieldExclamationIcon,
  UserGroupIcon,
  CircleStackIcon,
  BellIcon,
  PlayIcon,
  StopIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  CpuChipIcon,
  ServerIcon,
  FingerPrintIcon,
  EyeIcon,
  ShieldCheckIcon,
  FireIcon,
  ClockIcon,
  KeyIcon,
  SignalIcon,
  SparklesIcon,
  ArrowPathIcon,
  ServerStackIcon
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
}

const severityBgColors: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30',
  high: 'bg-orange-500/10 border-orange-500/30',
  medium: 'bg-yellow-500/10 border-yellow-500/30',
  low: 'bg-green-500/10 border-green-500/30'
}

interface ScrapeStatus {
  status: string
  progress: number
  total: number
  success: number
  failed: number
  current_url: string
  logs: string[]
  start_time?: string
  end_time?: string
}

interface StatCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ElementType
  color: string
  trend?: { value: number; positive: boolean }
  onClick?: () => void
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-dark-700/50 backdrop-blur-sm border border-dark-600 p-6 transition-all duration-300 hover:border-dark-500 hover:shadow-xl hover:shadow-${color}/5 cursor-pointer group`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-${color}/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-${color}/10`}>
            <Icon className={`w-6 h-6 text-${color}`} />
          </div>
          {trend && (
            <span className={`text-sm font-medium ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.positive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        <p className="text-sm text-gray-400">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

interface SeverityBadgeProps {
  severity: string
  count: number
  total: number
}

function SeverityBadge({ severity, count, total }: SeverityBadgeProps) {
  const color = severityColors[severity]
  const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0'
  
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-dark-700/30 border border-dark-600">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <FireIcon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white capitalize">{severity}</span>
          <span className="text-sm font-bold" style={{ color }}>{count}</span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">{percentage}%</span>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data: stats, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/v1/stats/dashboard')
      setLastUpdated(new Date())
      return response.data
    },
    refetchInterval: 30000,
  })

  const { data: recentLeaks } = useQuery({
    queryKey: ['recent-leaks'],
    queryFn: async () => {
      const response = await api.get('/v1/leaks', { params: { limit: 5 } })
      return response.data
    },
  })

  const { data: actorsData } = useQuery({
    queryKey: ['top-actors'],
    queryFn: async () => {
      const response = await api.get('/v1/threat-actors', { params: { limit: 10 } })
      return response.data
    },
  })

  useEffect(() => {
    const checkScrapeStatus = async () => {
      try {
        const response = await api.get('/v1/scrape/status')
        const status = response.data
        setScrapeStatus(status)
        setIsScraping(status.status === 'running' || status.status === 'starting')
      } catch {
        console.error('Failed to get scrape status')
      }
    }

    if (isScraping) {
      checkScrapeStatus()
      const interval = setInterval(checkScrapeStatus, 3000)
      return () => clearInterval(interval)
    }
  }, [isScraping])

  const handleStartScrape = async () => {
    showToast('Starting Tor scraper...', 'info')
    setIsScraping(true)
    try {
      const response = await api.post('/v1/scrape/trigger')
      if (response.data.status === 'started') {
        showToast('Scraping via Tor! Watch the progress below.', 'success')
      }
    } catch (err: any) {
      showToast('Failed to start scrape: ' + (err.message || 'Unknown'), 'error')
      setIsScraping(false)
    }
  }

  const handleStopScrape = async () => {
    try {
      await api.post('/v1/scrape/stop')
      showToast('Scrape stopped', 'warning')
      setIsScraping(false)
    } catch {
      showToast('Failed to stop scrape', 'error')
    }
  }

  const severityBreakdown: Record<string, number> = stats?.leaks?.by_severity || {}
  const totalLeaks = Object.values(severityBreakdown).reduce((a, b) => a + b, 0)

  const progress = scrapeStatus?.total ? Math.min(Math.max((scrapeStatus.progress / scrapeStatus.total) * 100, 0), 100) : 0

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-dark-600 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-accent-primary rounded-full animate-spin" style={{ borderRightColor: 'transparent', borderBottomColor: 'transparent' }}></div>
          </div>
          <p className="text-gray-400 text-lg">Loading threat intelligence...</p>
          <p className="text-gray-500 text-sm mt-2">Connecting to data sources</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                  <ShieldExclamationIcon className="w-6 h-6 text-white" />
                </div>
                Threat Intelligence
              </h1>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                <LockClosedIcon className="w-4 h-4 text-purple-400" />
                Real-time dark web monitoring
                <span className="text-gray-500">•</span>
                <span className="text-xs">Last updated: {lastUpdated.toLocaleTimeString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-xs text-gray-500">{currentTime.toLocaleDateString()}</p>
                <p className="text-lg font-mono text-gray-300">{currentTime.toLocaleTimeString()}</p>
              </div>
              <button
                onClick={() => refetch()}
                className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
                title="Refresh data"
              >
                <ArrowPathIcon className="w-5 h-5 text-gray-400" />
              </button>
              {!isScraping ? (
                <button
                  onClick={handleStartScrape}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20"
                >
                  <PlayIcon className="w-5 h-5" />
                  Start Scrape
                </button>
              ) : (
                <button
                  onClick={handleStopScrape}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-colors"
                >
                  <StopIcon className="w-5 h-5" />
                  Stop Scrape
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Live Scrape Progress */}
        {isScraping && scrapeStatus && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/20 p-6">
            <div className="absolute top-0 left-0 right-0 h-1 bg-dark-700">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <LockClosedIcon className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-dark-800 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    Tor Scrape in Progress
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                  </h3>
                  <p className="text-sm text-gray-400">
                    {scrapeStatus.progress} of {scrapeStatus.total} sources • {scrapeStatus.success} successful, {scrapeStatus.failed} failed
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-indigo-400">{Math.round(progress)}%</p>
                <p className="text-xs text-gray-500">Complete</p>
              </div>
            </div>
            <div className="bg-dark-900/50 rounded-xl p-3 border border-dark-700 font-mono text-xs">
              <span className="text-gray-500">Current:</span>{' '}
              <span className="text-indigo-400 truncate max-w-md inline-block align-bottom">
                {scrapeStatus.current_url || 'Initializing...'}
              </span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Leaks"
            value={stats?.leaks?.total || 0}
            subtitle={`${stats?.leaks?.new_today || 0} new today`}
            icon={ShieldExclamationIcon}
            color="blue-400"
            onClick={() => navigate('/leaks')}
          />
          <StatCard
            title="Threat Actors"
            value={stats?.threat_actors?.total || 0}
            subtitle={`${stats?.threat_actors?.active || 0} active`}
            icon={UserGroupIcon}
            color="purple-400"
            onClick={() => navigate('/actors')}
          />
          <StatCard
            title="IOCs Collected"
            value={stats?.iocs?.total || 0}
            subtitle="Indicators of compromise"
            icon={CircleStackIcon}
            color="green-400"
            onClick={() => navigate('/iocs')}
          />
          <StatCard
            title="Active Sources"
            value={stats?.sources?.active || 0}
            subtitle="Dark web monitoring"
            icon={GlobeAltIcon}
            color="yellow-400"
            onClick={() => navigate('/sources')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Severity Distribution */}
          <div className="lg:col-span-2 rounded-2xl bg-dark-700/50 border border-dark-600 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                Severity Distribution
              </h2>
              <span className="text-sm text-gray-400">{totalLeaks} total leaks</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(severityBreakdown).map(([severity, count]) => (
                <SeverityBadge
                  key={severity}
                  severity={severity}
                  count={count as number}
                  total={totalLeaks}
                />
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-dark-600 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-red-400">{severityBreakdown.critical || 0}</p>
                <p className="text-xs text-gray-500">Critical</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{severityBreakdown.high || 0}</p>
                <p className="text-xs text-gray-500">High</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{severityBreakdown.medium || 0}</p>
                <p className="text-xs text-gray-500">Medium</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{severityBreakdown.low || 0}</p>
                <p className="text-xs text-gray-500">Low</p>
              </div>
            </div>
          </div>

          {/* Threat Actors */}
          <div className="rounded-2xl bg-dark-700/50 border border-dark-600 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-purple-400" />
                Threat Actors
              </h2>
              <button
                onClick={() => navigate('/actors')}
                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                View All <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {actorsData?.actors?.slice(0, 5).map((actor: any) => (
                <div
                  key={actor.id}
                  onClick={() => navigate('/actors')}
                  className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50 border border-dark-600 hover:border-dark-500 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                    <UserGroupIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{actor.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{actor.risk_level || 'medium'} risk</p>
                  </div>
                  {actor.is_active ? (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                      Inactive
                    </span>
                  )}
                </div>
              ))}
              {(!actorsData?.actors || actorsData.actors.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No threat actors tracked yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leaks */}
          <div className="rounded-2xl bg-dark-700/50 border border-dark-600 overflow-hidden">
            <div className="p-4 border-b border-dark-600 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ServerStackIcon className="w-5 h-5 text-green-400" />
              System Status
            </h2>
              <button
                onClick={() => navigate('/leaks')}
                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                View All <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-dark-600">
              {recentLeaks?.leaks?.slice(0, 5).map((leak: any) => (
                <div
                  key={leak.id}
                  onClick={() => navigate('/leaks')}
                  className="p-4 hover:bg-dark-600/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: severityColors[leak.severity] || '#6b7280' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{leak.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {leak.victim_name || 'Unknown'} • {new Date(leak.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className="px-3 py-1 rounded-lg text-xs font-bold uppercase"
                      style={{
                        backgroundColor: `${severityColors[leak.severity]}15`,
                        color: severityColors[leak.severity],
                        border: `1px solid ${severityColors[leak.severity]}30`
                      }}
                    >
                      {leak.severity}
                    </span>
                  </div>
                </div>
              ))}
              {(!recentLeaks?.leaks || recentLeaks.leaks.length === 0) && (
                <div className="p-12 text-center text-gray-500">
                  <ShieldExclamationIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No leaks detected yet</p>
                </div>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="rounded-2xl bg-dark-700/50 border border-dark-600 p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <SignalIcon className="w-5 h-5 text-green-400" />
              System Status
            </h2>
            <div className="space-y-4">
              {[
                { name: 'API Server', status: 'online', color: 'green' },
                { name: 'Tor Network', status: isScraping ? 'scraping' : 'connected', color: isScraping ? 'yellow' : 'green' },
                { name: 'Database', status: 'connected', color: 'green' },
                { name: 'Scraper', status: isScraping ? 'running' : 'idle', color: isScraping ? 'yellow' : 'gray' },
              ].map(({ name, status, color }) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-dark-800/50 border border-dark-600">
                  <span className="text-sm text-white">{name}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${color}-500 ${color === 'yellow' ? 'animate-pulse' : ''}`} />
                    <span className={`text-sm font-medium text-${color}-400 capitalize`}>{status}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-dark-600">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-600">
                  <p className="text-2xl font-bold text-white">{stats?.leaks?.total || 0}</p>
                  <p className="text-xs text-gray-500">Total Data</p>
                </div>
                <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-600">
                  <p className="text-2xl font-bold text-white">{stats?.iocs?.total || 0}</p>
                  <p className="text-xs text-gray-500">IOCs</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl bg-dark-700/50 border border-dark-600 p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <SparklesIcon className="w-5 h-5 text-yellow-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={handleStartScrape}
              disabled={isScraping}
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 hover:border-indigo-500/50 hover:from-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CpuChipIcon className="w-5 h-5" />
              <span className="font-medium">{isScraping ? 'Scraping...' : 'Start Scrape'}</span>
            </button>
            <button
              onClick={() => navigate('/leaks')}
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-dark-800/50 border border-dark-600 text-gray-300 hover:border-dark-500 hover:text-white transition-all"
            >
              <ShieldExclamationIcon className="w-5 h-5" />
              <span>View Leaks</span>
            </button>
            <button
              onClick={() => navigate('/iocs')}
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-dark-800/50 border border-dark-600 text-gray-300 hover:border-dark-500 hover:text-white transition-all"
            >
              <KeyIcon className="w-5 h-5" />
              <span>Analyze IOCs</span>
            </button>
            <button
              onClick={() => navigate('/alerts')}
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-dark-800/50 border border-dark-600 text-gray-300 hover:border-dark-500 hover:text-white transition-all"
            >
              <BellIcon className="w-5 h-5" />
              <span>View Alerts</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
