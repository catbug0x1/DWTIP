import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { useToast } from '../components/Toast'
import { 
  MagnifyingGlassIcon, 
  EyeIcon, 
  XMarkIcon, 
  PlayIcon, 
  LockClosedIcon, 
  GlobeAltIcon, 
  ExclamationTriangleIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ArrowsUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface LeaksResponse {
  leaks: any[]
  total: number
}

const severityOrder = ['critical', 'high', 'medium', 'low']
const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

const getSeverityStyle = (sev: string) => ({
  backgroundColor: `${severityColors[sev] || '#6b7280'}20`,
  color: severityColors[sev] || '#6b7280',
  borderColor: `${severityColors[sev] || '#6b7280'}50`
})

export default function Leaks() {
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState<string>('')
  const [isOnion, setIsOnion] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [selectedLeak, setSelectedLeak] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState<string>('')
  const [sortBy, setSortBy] = useState<'date' | 'severity'>('severity')
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const LIMIT = 20

  const { data, isLoading, refetch } = useQuery<LeaksResponse>({
    queryKey: ['leaks', search, severity, isOnion, page],
    queryFn: async () => {
      const params: any = { search, skip: page * LIMIT, limit: LIMIT }
      if (severity) params.severity = severity
      if (isOnion !== null) params.is_onion = isOnion
      const response = await api.get('/v1/leaks', { params })
      return response.data
    },
    refetchInterval: 30000,
    placeholderData: (previousData) => previousData,
  })

  const handleScrape = async () => {
    setIsScraping(true)
    setScrapeStatus('Starting Tor scrape...')
    showToast('Starting onion URL scrape via Tor...', 'info')
    
    try {
      const response = await api.post('/v1/scrape/trigger')
      if (response.data.status === 'started') {
        setScrapeStatus('Scraping via Tor network...')
        
        const checkStatus = setInterval(async () => {
          try {
            const statusRes = await api.get('/v1/scrape/status')
            const status = statusRes.data
            
            if (status.status === 'completed') {
              clearInterval(checkStatus)
              refetch()
              queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
              setScrapeStatus('')
              showToast(`Scrape complete! ${status.success} successful, ${status.failed} failed.`, 'success')
              setIsScraping(false)
            } else if (status.status === 'error') {
              clearInterval(checkStatus)
              setScrapeStatus('')
              showToast('Scrape error', 'error')
              setIsScraping(false)
            }
          } catch (e) {
            console.error('Status check failed')
          }
        }, 3000)
        
        setTimeout(() => {
          clearInterval(checkStatus)
          setIsScraping(false)
          setScrapeStatus('')
        }, 600000)
      }
    } catch (err: any) {
      showToast('Scrape failed: ' + err.message, 'error')
      setIsScraping(false)
      setScrapeStatus('')
    }
  }

  const exportLeaks = () => {
    if (!data?.leaks) return
    const headers = ['Title', 'Victim', 'Severity', 'Source URL', 'Status', 'Created']
    const rows = data.leaks.map((leak: any) => [
      leak.title,
      leak.victim_name || 'Unknown',
      leak.severity,
      leak.source_url || '',
      leak.status,
      new Date(leak.created_at).toLocaleDateString()
    ])
    const csv = [headers, ...rows].map((r: string[]) => r.map((c: string) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leaks-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    showToast('Exported to CSV', 'success')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard', 'success')
  }

  const sortedLeaks = data?.leaks ? [...data.leaks].sort((a, b) => {
    if (sortBy === 'severity') {
      const aIdx = severityOrder.indexOf(a.severity)
      const bIdx = severityOrder.indexOf(b.severity)
      return aIdx - bIdx
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }) : []

  const totalPages = Math.ceil((data?.total || 0) / LIMIT)
  const onionCount = data?.leaks?.filter((l: any) => l.source_url?.includes('.onion')).length || 0

  const getPreviewText = (description: string) => {
    const clean = stripHtml(description)
    return truncateText(clean, 150)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dark Web Leaks</h1>
          <p className="text-gray-500 mt-1">
            {data?.total || 0} leaks discovered • {onionCount} from Tor network
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportLeaks} className="btn btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-5 h-5" />
            Export
          </button>
          <button 
            onClick={handleScrape} 
            disabled={isScraping}
            className="btn btn-primary flex items-center gap-2"
          >
            <PlayIcon className={`w-5 h-5 ${isScraping ? 'animate-spin' : ''}`} />
            {isScraping ? 'Scraping...' : 'Scan Dark Web'}
          </button>
        </div>
      </div>

      {scrapeStatus && (
        <div className="card p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/50 flex items-center gap-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
          <div className="flex-1">
            <p className="text-indigo-400 font-medium">{scrapeStatus}</p>
            <p className="text-sm text-gray-500">Scanning onion sites via Tor network...</p>
          </div>
          <LockClosedIcon className="w-6 h-6 text-purple-400" />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search leaks, victims, or content..."
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
        <button
          onClick={() => setSortBy(sortBy === 'date' ? 'severity' : 'date')}
          className="btn btn-secondary flex items-center gap-2"
        >
          <ArrowsUpDownIcon className="w-5 h-5" />
          {sortBy === 'date' ? 'Date' : 'Severity'}
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar">
        <button
          onClick={() => { setSeverity(''); setIsOnion(null); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!severity && isOnion === null ? 'bg-indigo-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
        >
          All ({data?.total || 0})
        </button>
        <button
          onClick={() => { setSeverity('critical'); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap capitalize ${severity === 'critical' ? 'text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
          style={severity === 'critical' ? { backgroundColor: '#ef4444', color: '#fff' } : {}}
        >
          Critical
        </button>
        <button
          onClick={() => { setSeverity('high'); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap capitalize ${severity === 'high' ? 'text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
          style={severity === 'high' ? { backgroundColor: '#f97316', color: '#fff' } : {}}
        >
          High
        </button>
        <button
          onClick={() => { setSeverity('medium'); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap capitalize ${severity === 'medium' ? 'text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
          style={severity === 'medium' ? { backgroundColor: '#eab308', color: '#fff' } : {}}
        >
          Medium
        </button>
        <button
          onClick={() => { setSeverity('low'); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap capitalize ${severity === 'low' ? 'text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
          style={severity === 'low' ? { backgroundColor: '#22c55e', color: '#fff' } : {}}
        >
          Low
        </button>
        <div className="w-px h-8 bg-dark-600 mx-2"></div>
        <button
          onClick={() => { setIsOnion(true); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${isOnion === true ? 'bg-purple-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
        >
          <LockClosedIcon className="w-4 h-4" />
          Tor Network
        </button>
        <button
          onClick={() => { setIsOnion(false); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${isOnion === false ? 'bg-blue-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
        >
          <GlobeAltIcon className="w-4 h-4" />
          Surface Web
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-dark-600 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-5 bg-dark-600 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-dark-600 rounded w-full mb-2"></div>
                  <div className="h-3 bg-dark-600 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLeaks.length === 0 ? (
            <div className="card p-16 text-center">
              <ExclamationTriangleIcon className="w-20 h-20 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg">No leaks found</p>
              <p className="text-gray-600 mt-2">Start a scan to discover dark web leaks</p>
            </div>
          ) : (
            sortedLeaks.map((leak: any) => {
              const isOnionLeak = leak.source_url?.includes('.onion')
              const preview = getPreviewText(leak.description || '')
              
              return (
                <div 
                  key={leak.id} 
                  className="card p-5 hover:bg-dark-700/50 transition-all cursor-pointer group border-l-4"
                  style={{ borderLeftColor: severityColors[leak.severity] || '#6b7280' }}
                  onClick={() => setSelectedLeak(leak)}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="p-3 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: `${severityColors[leak.severity]}20` }}
                    >
                      {isOnionLeak ? (
                        <LockClosedIcon className="w-6 h-6" style={{ color: severityColors[leak.severity] }} />
                      ) : (
                        <GlobeAltIcon className="w-6 h-6" style={{ color: severityColors[leak.severity] }} />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-100 text-lg">{leak.title}</h3>
                        <span 
                          className="px-3 py-1 rounded-lg text-xs font-bold uppercase border"
                          style={getSeverityStyle(leak.severity)}
                        >
                          {leak.severity}
                        </span>
                        {isOnionLeak && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/50 flex items-center gap-1">
                            <LockClosedIcon className="w-3 h-3" />
                            TOR
                          </span>
                        )}
                        <span className="px-2 py-1 rounded text-xs font-medium bg-dark-600 text-gray-400">
                          {leak.status}
                        </span>
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                        {preview}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <EyeIcon className="w-3 h-3" />
                          {leak.victim_name || 'Unknown victim'}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {new Date(leak.created_at).toLocaleDateString()}
                        </span>
                        {leak.source_url && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(leak.source_url); }}
                            className="hover:text-indigo-400 flex items-center gap-1 truncate max-w-[200px]"
                          >
                            <DocumentDuplicateIcon className="w-3 h-3 flex-shrink-0" />
                            {isOnionLeak ? 'Onion URL' : 'Web URL'}
                          </button>
                        )}
                      </div>
                      
                      {leak.tags?.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {leak.tags.slice(0, 4).map((tag: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-dark-600 text-gray-400 text-xs rounded-lg">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedLeak(leak); }}
                        className="p-3 rounded-xl hover:bg-dark-600 transition-colors"
                      >
                        <EyeIcon className="w-5 h-5 text-gray-400" />
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
          <span className="text-gray-400 px-4">
            Page {page + 1} of {totalPages}
          </span>
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

      {selectedLeak && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLeak(null)}>
          <div 
            className="bg-dark-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-dark-600" 
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-800 border-b border-dark-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: `${severityColors[selectedLeak.severity]}20` }}
                >
                  {selectedLeak.source_url?.includes('.onion') ? (
                    <LockClosedIcon className="w-8 h-8" style={{ color: severityColors[selectedLeak.severity] }} />
                  ) : (
                    <GlobeAltIcon className="w-8 h-8" style={{ color: severityColors[selectedLeak.severity] }} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="px-3 py-1 rounded-lg text-sm font-bold uppercase"
                      style={getSeverityStyle(selectedLeak.severity)}
                    >
                      {selectedLeak.severity}
                    </span>
                    {selectedLeak.source_url?.includes('.onion') && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                        TOR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Leak ID: #{selectedLeak.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLeak(null)} 
                className="p-3 rounded-xl hover:bg-dark-700 text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <h2 className="text-2xl font-bold text-gray-100 mb-2">{selectedLeak.title}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <EyeIcon className="w-4 h-4" />
                    {selectedLeak.victim_name || 'Unknown victim'}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {new Date(selectedLeak.created_at).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircleIcon className="w-4 h-4" />
                    {((selectedLeak.confidence || 0) * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>
              
              <div className="bg-dark-700/50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Description</h4>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {stripHtml(selectedLeak.description || 'No description available')}
                </p>
              </div>

              {selectedLeak.source_url && (
                <div className="bg-dark-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">
                    {selectedLeak.source_url.includes('.onion') ? 'Onion URL' : 'Source URL'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <a 
                      href={selectedLeak.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-indigo-400 hover:text-indigo-300 break-all text-sm flex-1"
                    >
                      {selectedLeak.source_url}
                    </a>
                    <button 
                      onClick={() => copyToClipboard(selectedLeak.source_url)}
                      className="btn btn-secondary text-xs p-2"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Status</h4>
                  <p className="text-gray-200 capitalize">{selectedLeak.status || 'Unknown'}</p>
                </div>
                <div className="bg-dark-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Source Type</h4>
                  <p className="text-gray-200 capitalize">{selectedLeak.source_type || 'Unknown'}</p>
                </div>
              </div>

              {selectedLeak.tags?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedLeak.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="px-3 py-1.5 bg-dark-600 text-gray-300 text-sm rounded-lg border border-dark-500">
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
