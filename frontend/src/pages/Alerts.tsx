import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { useToast } from '../components/Toast'
import { 
  BellIcon, 
  CheckIcon, 
  XMarkIcon, 
  FunnelIcon, 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  EyeIcon,
  EyeSlashIcon,
  FireIcon,
  ClockIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'

const severityConfig = {
  critical: { 
    color: '#ef4444', 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/30',
    icon: FireIcon,
    label: 'Critical'
  },
  high: { 
    color: '#f97316', 
    bg: 'bg-orange-500/10', 
    border: 'border-orange-500/30',
    icon: ExclamationTriangleIcon,
    label: 'High'
  },
  medium: { 
    color: '#eab308', 
    bg: 'bg-yellow-500/10', 
    border: 'border-yellow-500/30',
    icon: ShieldExclamationIcon,
    label: 'Medium'
  },
  low: { 
    color: '#22c55e', 
    bg: 'bg-green-500/10', 
    border: 'border-green-500/30',
    icon: ShieldCheckIcon,
    label: 'Low'
  },
}

export default function Alerts() {
  const [page, setPage] = useState(0)
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [showRead, setShowRead] = useState<boolean | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const LIMIT = 20

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['alerts', page, showRead, severityFilter],
    queryFn: async () => {
      const params: any = { skip: page * LIMIT, limit: LIMIT }
      if (showRead !== null) params.is_read = showRead
      if (severityFilter) params.severity = severityFilter
      const response = await api.get('/v1/alerts', { params })
      return response.data
    },
    refetchInterval: 30000,
  })

  const stats = {
    total: data?.total || 0,
    unread: data?.unread || 0,
    critical: data?.alerts?.filter((a: any) => a.severity === 'critical').length || 0,
    high: data?.alerts?.filter((a: any) => a.severity === 'high').length || 0,
    medium: data?.alerts?.filter((a: any) => a.severity === 'medium').length || 0,
    low: data?.alerts?.filter((a: any) => a.severity === 'low').length || 0,
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    showToast('Refreshing alerts...', 'info')
  }

  const markAsRead = useMutation({
    mutationFn: async (alertId: number) => {
      try {
        const response = await api.put(`/api/v1/alerts/${alertId}`, { is_read: true })
        return { success: true, data: response.data }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        showToast('Alert marked as read', 'success')
      } else {
        showToast('Failed to mark as read', 'error')
      }
    },
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const unreadAlerts = data?.alerts?.filter((a: any) => !a.is_read) || []
      for (const alert of unreadAlerts) {
        try {
          await api.put(`/api/v1/alerts/${alert.id}`, { is_read: true })
        } catch (e) {}
      }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      showToast('All alerts marked as read', 'success')
    },
  })

  const dismissAlert = useMutation({
    mutationFn: async (alertId: number) => {
      try {
        const response = await api.put(`/api/v1/alerts/${alertId}`, { is_dismissed: true })
        return { success: true, data: response.data }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['alerts'] })
        showToast('Alert dismissed', 'success')
      }
    },
  })

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
          Error loading alerts. Please try again.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10">
              <BellIcon className="w-6 h-6 text-yellow-400" />
            </div>
            Threat Alerts
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {stats.unread > 0 ? `${stats.unread} unread alerts need attention` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {stats.unread > 0 && (
            <button 
              onClick={() => markAllAsRead.mutate()} 
              disabled={markAllAsRead.isPending}
              className="btn btn-secondary flex items-center gap-2"
            >
              <CheckIcon className="w-5 h-5" />
              Mark All Read
            </button>
          )}
          <button onClick={handleRefresh} disabled={isFetching} className="btn btn-secondary flex items-center gap-2">
            <ArrowPathIcon className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => { setSeverityFilter(''); setShowRead(null); setPage(0); }}
          className={`card p-4 text-center transition-all hover:scale-[1.02] ${!severityFilter && showRead === null ? 'ring-2 ring-indigo-500' : ''}`}
        >
          <p className="text-3xl font-bold text-gray-100">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total</p>
        </button>
        {Object.entries(severityConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => { setSeverityFilter(key); setShowRead(null); setPage(0); }}
            className={`card p-4 text-center transition-all hover:scale-[1.02] ${severityFilter === key ? 'ring-2' : ''}`}
            style={{ 
              borderColor: severityFilter === key ? config.color : undefined,
              boxShadow: severityFilter === key ? `0 0 0 2px ${config.color}` : undefined
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <config.icon className="w-5 h-5" style={{ color: config.color }} />
              <p className="text-2xl font-bold" style={{ color: config.color }}>
                {data?.alerts?.filter((a: any) => a.severity === key).length || 0}
              </p>
            </div>
            <p className="text-xs text-gray-500">{config.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setShowRead(null); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              showRead === null ? 'bg-indigo-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setShowRead(false); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              showRead === false ? 'bg-indigo-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            <EyeIcon className="w-4 h-4" />
            Unread
            {stats.unread > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{stats.unread}</span>
            )}
          </button>
          <button
            onClick={() => { setShowRead(true); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              showRead === true ? 'bg-indigo-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            <EyeSlashIcon className="w-4 h-4" />
            Read
          </button>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
        >
          <FunnelIcon className="w-5 h-5" />
          More Filters
        </button>
      </div>

      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Severity</label>
            <select
              className="input w-full"
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => { setSeverityFilter(''); setShowRead(null); setPage(0); }} 
              className="btn btn-secondary"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-400">Loading alerts...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(!data?.alerts || data.alerts.length === 0) ? (
            <div className="card p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-dark-700 mx-auto mb-4 flex items-center justify-center">
                <BellIcon className="w-10 h-10 text-gray-600" />
              </div>
              <p className="text-gray-400 text-lg">No alerts found</p>
              <p className="text-gray-600 text-sm mt-2">
                {stats.total === 0 ? 'Start a scan to generate alerts' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            data.alerts.map((alert: any) => {
              const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.low
              const Icon = config.icon
              
              return (
                <div 
                  key={alert.id} 
                  className={`card border-l-4 overflow-hidden transition-all hover:shadow-lg hover:shadow-${alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'orange' : 'dark'}-500/10 ${
                    alert.is_dismissed ? 'opacity-50' : alert.is_read ? 'opacity-70' : ''
                  }`}
                  style={{ 
                    borderLeftColor: config.color,
                    borderLeftWidth: '4px'
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`p-3 rounded-xl ${config.bg}`}>
                        <Icon className="w-6 h-6" style={{ color: config.color }} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span 
                            className="px-3 py-1 rounded-lg text-xs font-bold uppercase"
                            style={{ 
                              backgroundColor: `${config.color}20`, 
                              color: config.color,
                              border: `1px solid ${config.color}40`
                            }}
                          >
                            {config.label}
                          </span>
                          <span className="px-2 py-1 rounded text-xs bg-dark-600 text-gray-400">
                            {alert.alert_type?.replace('_', ' ') || 'Alert'}
                          </span>
                          {alert.is_read && (
                            <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-400 flex items-center gap-1">
                              <EyeSlashIcon className="w-3 h-3" />
                              Read
                            </span>
                          )}
                          {alert.is_dismissed && (
                            <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-500">
                              Dismissed
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-100 mb-2 line-clamp-1">
                          {alert.title}
                        </h3>
                        
                        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                          {alert.description || 'No description available'}
                        </p>
                        
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {alert.source_url && (
                              <span className="flex items-center gap-1 text-purple-400">
                                <LockClosedIcon className="w-3 h-3" />
                                Tor Source
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" />
                              {new Date(alert.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          {!alert.is_dismissed && (
                            <div className="flex items-center gap-2">
                              {!alert.is_read ? (
                                <button
                                  onClick={() => markAsRead.mutate(alert.id)}
                                  disabled={markAsRead.isPending}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-all disabled:opacity-50"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                  Mark Read
                                </button>
                              ) : null}
                              <button
                                onClick={() => dismissAlert.mutate(alert.id)}
                                disabled={dismissAlert.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-red-400 border border-dark-500 transition-all disabled:opacity-50"
                              >
                                <XMarkIcon className="w-4 h-4" />
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > LIMIT && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            className="btn btn-secondary"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 px-4 py-2 bg-dark-700 rounded-lg">
              Page {page + 1} of {Math.ceil(data.total / LIMIT)}
            </span>
          </div>
          <button
            className="btn btn-secondary"
            disabled={(page + 1) * LIMIT >= data.total}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
