import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { useToast } from '../components/Toast'
import {
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  FunnelIcon,
  XMarkIcon,
  EyeIcon,
  PlayIcon,
  ShieldCheckIcon,
  CubeIcon,
  IdentificationIcon,
  LockClosedIcon,
  EnvelopeIcon,
  LinkIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface IOCResponse {
  iocs: any[]
  total: number
}

interface IOCSourcesResponse {
  names: string[]
}

const IOC_TYPES = [
  { id: 'ip', label: 'IP Addresses', color: '#3b82f6' },
  { id: 'domain', label: 'Domains', color: '#8b5cf6' },
  { id: 'file_hash', label: 'File Hashes', color: '#eab308' },
  { id: 'cve', label: 'CVEs', color: '#ef4444' },
  { id: 'crypto_wallet', label: 'Crypto Wallets', color: '#f97316' },
  { id: 'email', label: 'Emails', color: '#22c55e' },
  { id: 'url', label: 'URLs', color: '#06b6d4' },
  { id: 'onion_url', label: 'Onion URLs', color: '#ec4899' },
]

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'ip': return IdentificationIcon
    case 'domain': return LinkIcon
    case 'file_hash': return CubeIcon
    case 'cve': return ShieldCheckIcon
    case 'crypto_wallet': return LockClosedIcon
    case 'email': return EnvelopeIcon
    case 'url': return LinkIcon
    case 'onion_url': return EyeSlashIcon
    default: return ShieldCheckIcon
  }
}

export default function IOCs() {
  const [search, setSearch] = useState('')
  const [iocType, setIocType] = useState<string>('')
  const [source, setSource] = useState<string>('')
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIOC, setSelectedIOC] = useState<any>(null)
  const [isScraping, setIsScraping] = useState(false)
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const LIMIT = 25

  const { data: sourcesData } = useQuery<IOCSourcesResponse>({
    queryKey: ['ioc-sources'],
    queryFn: async () => {
      const response = await api.get('/v1/sources/names')
      return response.data
    },
  })

  const { data, isLoading, isFetching, refetch } = useQuery<IOCResponse>({
    queryKey: ['iocs', search, iocType, source, page],
    queryFn: async () => {
      const response = await api.get('/v1/iocs', {
        params: { search, ioc_type: iocType, source, skip: page * LIMIT, limit: LIMIT }
      })
      return response.data
    },
    placeholderData: (previousData) => previousData,
  })

  const handleRefresh = () => {
    refetch()
    showToast('Refreshing IOCs...', 'info')
  }

  const handleScrape = async () => {
    setIsScraping(true)
    showToast('Starting scrape...', 'info')
    try {
      const response = await api.post('/v1/scrape/trigger')
      if (response.data.status === 'started') {
        showToast('Scrape started!', 'success')
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['iocs'] })
          setIsScraping(false)
        }, 120000)
      }
    } catch (err: any) {
      showToast('Scrape error: ' + (err.message || 'Unknown'), 'error')
      setIsScraping(false)
    }
  }

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value)
    showToast('Copied to clipboard', 'success')
  }

  const exportToCSV = () => {
    if (!data?.iocs) return
    const headers = ['Type', 'Value', 'Source', 'Confidence', 'First Seen', 'Last Seen']
    const rows = data.iocs.map((ioc: any) => [
      ioc.type,
      ioc.value,
      ioc.source || 'Unknown',
      ((ioc.confidence || 0) * 100).toFixed(0) + '%',
      ioc.first_seen ? new Date(ioc.first_seen).toLocaleDateString() : 'Unknown',
      ioc.last_seen ? new Date(ioc.last_seen).toLocaleDateString() : 'Unknown',
    ])
    const csv = [headers, ...rows].map(row => row.map((cell: string) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iocs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    showToast('IOCs exported to CSV', 'success')
  }

  const exportToJSON = () => {
    if (!data?.iocs) return
    const json = JSON.stringify(data.iocs, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iocs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    showToast('IOCs exported to JSON', 'success')
  }

  const clearFilters = () => {
    setSearch('')
    setIocType('')
    setSource('')
    setPage(0)
  }

  const totalPages = Math.ceil((data?.total || 0) / LIMIT)

  const iocDistribution = IOC_TYPES.map(type => ({
    name: type.label,
    value: data?.iocs?.filter((i: any) => i.type === type.id).length || 0,
    color: type.color
  })).filter(t => t.value > 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
              <CircleStackIcon className="w-6 h-6 text-green-400" />
            </div>
            Indicators of Compromise
          </h1>
          <p className="text-gray-500 mt-1">
            {data?.total || 0} IOCs collected from dark web sources
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={isFetching} className="btn btn-secondary flex items-center gap-2">
            <ArrowPathIcon className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportToCSV} className="btn btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-5 h-5" />
            CSV
          </button>
          <button onClick={exportToJSON} className="btn btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-5 h-5" />
            JSON
          </button>
          <button onClick={handleScrape} disabled={isScraping} className="btn btn-primary flex items-center gap-2">
            <PlayIcon className={`w-5 h-5 ${isScraping ? 'animate-spin' : ''}`} />
            {isScraping ? 'Scraping...' : 'Scrape'}
          </button>
        </div>
      </div>

      {/* Stats & Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* IOC Type Stats */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-green-400" />
            IOC Distribution
          </h3>
          <div className="space-y-3">
            {IOC_TYPES.map(type => {
              const Icon = getTypeIcon(type.id)
              const count = data?.iocs?.filter((i: any) => i.type === type.id).length || 0
              const percentage = data?.total ? ((count / data.total) * 100).toFixed(1) : '0'
              return (
                <button
                  key={type.id}
                  onClick={() => { setIocType(iocType === type.id ? '' : type.id); setPage(0); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-dark-700/50 ${
                    iocType === type.id ? 'bg-dark-700 ring-2' : ''
                  }`}
                  style={{ boxShadow: iocType === type.id ? `0 0 0 2px ${type.color}` : undefined }}
                >
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${type.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: type.color }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-200">{type.label}</p>
                    <div className="w-full bg-dark-700 rounded-full h-1.5 mt-1">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percentage}%`, backgroundColor: type.color }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: type.color }}>{count}</p>
                    <p className="text-xs text-gray-500">{percentage}%</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <CircleStackIcon className="w-5 h-5 text-purple-400" />
            IOC Types
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={iocDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {iocDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#12121a', 
                    border: '1px solid #32324a', 
                    borderRadius: '8px', 
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {iocDistribution.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-gray-400">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Search */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <MagnifyingGlassIcon className="w-5 h-5 text-blue-400" />
            Quick Search
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Search by CVE</label>
              <input
                type="text"
                placeholder="CVE-2024-..."
                className="input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(e.currentTarget.value)
                    setIocType('cve')
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Search by IP</label>
              <input
                type="text"
                placeholder="192.168.1.1"
                className="input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(e.currentTarget.value)
                    setIocType('ip')
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Search by Domain</label>
              <input
                type="text"
                placeholder="example.com"
                className="input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(e.currentTarget.value)
                    setIocType('domain')
                  }
                }}
              />
            </div>
            <button 
              onClick={() => { setSearch(''); setIocType(''); }}
              className="w-full btn btn-secondary"
            >
              Clear Search
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {IOC_TYPES.map(type => {
          const Icon = getTypeIcon(type.id)
          return (
            <button
              key={type.id}
              className={`card p-3 cursor-pointer hover:bg-dark-700/50 transition-colors text-center ${
                iocType === type.id ? 'ring-2' : ''
              }`}
              onClick={() => { 
                setIocType(iocType === type.id ? '' : type.id); 
                setPage(0); 
              }}
              style={{ 
                borderColor: iocType === type.id ? type.color : undefined,
                boxShadow: iocType === type.id ? `0 0 0 2px ${type.color}` : undefined
              }}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: type.color }} />
              <p className="text-xs text-gray-400">{type.label}</p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search IOCs by value, hash, or CVE..."
            className="input pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
        >
          <FunnelIcon className="w-5 h-5" />
          Filters
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar">
        <button
          onClick={() => { setIocType(''); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!iocType ? 'bg-accent-primary text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
        >
          All ({data?.total || 0})
        </button>
        {IOC_TYPES.map(type => {
          const Icon = getTypeIcon(type.id)
          return (
            <button
              key={type.id}
              onClick={() => { setIocType(iocType === type.id ? '' : type.id); setPage(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2 ${iocType === type.id ? 'text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
              style={iocType === type.id ? { backgroundColor: type.color } : {}}
            >
              <Icon className="w-4 h-4" />
              {type.label}
            </button>
          )
        })}
      </div>

      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Source</label>
            <select
              className="input"
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(0); }}
            >
              <option value="">All Sources</option>
              {sourcesData?.names?.map((name: string) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="btn btn-secondary">
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-dark-600 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-dark-600 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-dark-600 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.iocs?.length === 0 ? (
            <div className="card p-12 text-center">
              <ShieldCheckIcon className="w-16 h-16 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500 text-lg">No IOCs found</p>
              <p className="text-gray-600 text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            data?.iocs?.map((ioc: any) => {
              const typeConfig = IOC_TYPES.find(t => t.id === ioc.type) || { label: 'Unknown', color: '#6b7280' }
              const Icon = getTypeIcon(ioc.type)
              return (
                <div
                  key={ioc.id}
                  className="card p-4 hover:bg-dark-700/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedIOC(ioc)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: typeConfig.color + '20' }}>
                      <Icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <code className="text-gray-200 font-mono text-sm bg-dark-700 px-3 py-1 rounded block truncate">
                        {ioc.value}
                      </code>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-2">
                      <span className="text-xs text-gray-500">{ioc.source || 'Unknown'}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(ioc.value); }}
                        className="p-2 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-accent-primary"
                        title="Copy"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedIOC(ioc); }}
                        className="p-2 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-accent-primary"
                        title="View"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button 
            className="btn btn-secondary flex items-center gap-1" 
            disabled={page === 0} 
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Previous
          </button>
          <span className="text-gray-400">Page {page + 1} of {totalPages}</span>
          <button 
            className="btn btn-secondary flex items-center gap-1" 
            disabled={page >= totalPages - 1} 
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {selectedIOC && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedIOC(null)}>
          <div className="bg-dark-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-dark-800 border-b border-dark-600 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-100">IOC Details</h2>
              <button onClick={() => setSelectedIOC(null)} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ backgroundColor: (IOC_TYPES.find(t => t.id === selectedIOC.type)?.color || '#6b7280') + '20' }}>
                  {(() => {
                    const Icon = getTypeIcon(selectedIOC.type)
                    return <Icon className="w-6 h-6" style={{ color: IOC_TYPES.find(t => t.id === selectedIOC.type)?.color }} />
                  })()}
                </div>
                <div>
                  <span className="text-sm text-gray-400">Type</span>
                  <p className="text-gray-200 font-medium">{IOC_TYPES.find(t => t.id === selectedIOC.type)?.label || selectedIOC.type}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Value</p>
                <div className="flex items-center gap-2 bg-dark-700 p-3 rounded-lg">
                  <code className="text-gray-200 font-mono text-sm flex-1 break-all">{selectedIOC.value}</code>
                  <button onClick={() => copyToClipboard(selectedIOC.value)} className="btn btn-secondary text-xs">
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Source</p>
                  <p className="text-gray-200">{selectedIOC.source || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-primary"
                        style={{ width: `${((selectedIOC.confidence || 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-200">{((selectedIOC.confidence || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">First Seen</p>
                  <p className="text-gray-200">{selectedIOC.first_seen ? new Date(selectedIOC.first_seen).toLocaleString() : 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Last Seen</p>
                  <p className="text-gray-200">{selectedIOC.last_seen ? new Date(selectedIOC.last_seen).toLocaleString() : 'Unknown'}</p>
                </div>
              </div>

              {selectedIOC.tags?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedIOC.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-dark-700 text-gray-300 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
