import { useState, useMemo } from 'react'
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
  ClockIcon,
  TagIcon,
  UserIcon,
  Square3Stack3DIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

interface LeaksResponse {
  leaks: any[]
  total: number
}

const severityOrder = ['critical', 'high', 'medium', 'low']
const severityConfig: Record<string, { color: string, bg: string, border: string, glow: string }> = {
  critical: { color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  high: { color: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  medium: { color: '#eab308', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' },
  low: { color: '#22c55e', bg: 'bg-green-500/10', border: 'border-green-500/30', glow: 'shadow-green-500/20' }
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

export default function Leaks() {
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState<string>('')
  const [isOnion, setIsOnion] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [selectedLeak, setSelectedLeak] = useState<any>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState<string>('')
  const [sortBy, setSortBy] = useState<'date' | 'severity'>('date')
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const LIMIT = 15

  const { data, isLoading, refetch } = useQuery<LeaksResponse>({
    queryKey: ['leaks', search, severity, isOnion, page, sortBy],
    queryFn: async () => {
      const params: any = { search, skip: page * LIMIT, limit: LIMIT }
      if (severity) params.severity = severity
      if (isOnion !== null) params.is_onion = isOnion
      // In a real app, sorting would be done by the API
      const response = await api.get('/v1/leaks', { params })
      return response.data
    },
    refetchInterval: 30000,
  })

  const handleScrape = async () => {
    setIsScraping(true)
    setScrapeStatus('Initiating specialized Tor scan...')
    showToast('Starting deep dark web scan...', 'info')
    
    try {
      const response = await api.post('/v1/scrape/trigger')
      if (response.data.status === 'started') {
        setScrapeStatus('Active scan in progress via Tor nodes...')
        // This is a simplified version, in real app would use WebSocket for progress
        setTimeout(() => {
          refetch()
          setIsScraping(false)
          setScrapeStatus('')
          showToast('Scan completed successfully', 'success')
        }, 15000)
      }
    } catch (err: any) {
      showToast('Scan failed: ' + err.message, 'error')
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
    a.download = `dwtip-leaks-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    showToast('Intelligence report exported', 'success')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('URL copied to intelligence clipboard', 'success')
  }

  const sortedLeaks = useMemo(() => {
    if (!data?.leaks) return []
    return [...data.leaks].sort((a, b) => {
      if (sortBy === 'severity') {
        const aIdx = severityOrder.indexOf(a.severity)
        const bIdx = severityOrder.indexOf(b.severity)
        return aIdx - bIdx
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [data?.leaks, sortBy])

  const totalPages = Math.ceil((data?.total || 0) / LIMIT)

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      {/* Dynamic Header Section */}
      <div className="bg-dark-800/50 border-b border-dark-700 backdrop-blur-xl sticky top-0 z-30 p-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <ShieldCheckIcon className="w-8 h-8 text-indigo-400" />
              </div>
              Data Breach Intelligence
            </h1>
            <p className="text-gray-400 font-medium flex items-center gap-2">
              <GlobeAltIcon className="w-4 h-4 text-gray-500" />
              Monitoring {data?.total || 0} active leaks across surface and dark web
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={exportLeaks}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-dark-700 text-gray-300 border border-dark-600 hover:border-dark-500 hover:bg-dark-600 transition-all font-semibold"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Export Intel
            </button>
            <button 
              onClick={handleScrape}
              disabled={isScraping}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all font-bold disabled:opacity-50"
            >
              <SparklesIcon className={`w-5 h-5 ${isScraping ? 'animate-pulse' : ''}`} />
              {isScraping ? 'Analyzing...' : 'Deep Scan'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 space-y-8">
        {/* Intelligence Filters Bar */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center bg-dark-800/40 p-2 rounded-[2rem] border border-dark-700 shadow-2xl">
          <div className="xl:col-span-4 relative group">
            <MagnifyingGlassIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search victims, content, or actor signatures..."
              className="w-full bg-dark-900/50 border-none rounded-3xl py-4 pl-14 pr-6 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 transition-all outline-none"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          <div className="xl:col-span-8 flex items-center gap-2 px-4 overflow-x-auto no-scrollbar">
            <div className="flex bg-dark-900/80 p-1 rounded-2xl border border-dark-700">
              <button
                onClick={() => { setSeverity(''); setPage(0); }}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${!severity ? 'bg-dark-700 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                All Severities
              </button>
              {severityOrder.map((sev) => (
                <button
                  key={sev}
                  onClick={() => { setSeverity(sev); setPage(0); }}
                  className={`px-5 py-2 rounded-xl text-sm font-bold capitalize transition-all ${severity === sev ? severityConfig[sev].bg + ' ' + severityConfig[sev].color : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div className="h-8 w-px bg-dark-700 mx-2" />

            <div className="flex bg-dark-900/80 p-1 rounded-2xl border border-dark-700">
              <button
                onClick={() => { setIsOnion(null); setPage(0); }}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${isOnion === null ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                All Sources
              </button>
              <button
                onClick={() => { setIsOnion(true); setPage(0); }}
                className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${isOnion === true ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <LockClosedIcon className="w-4 h-4" /> Dark Web
              </button>
              <button
                onClick={() => { setIsOnion(false); setPage(0); }}
                className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${isOnion === false ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <GlobeAltIcon className="w-4 h-4" /> Surface
              </button>
            </div>

            <button
              onClick={() => setSortBy(sortBy === 'date' ? 'severity' : 'date')}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dark-700/50 text-gray-400 border border-dark-600 hover:text-white transition-all text-sm font-bold"
            >
              <ArrowsUpDownIcon className="w-4 h-4" />
              By {sortBy === 'date' ? 'Latest' : 'Severity'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-[2rem] bg-dark-800/50 animate-pulse border border-dark-700" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
              {sortedLeaks.map((leak) => {
                const config = severityConfig[leak.severity] || severityConfig.medium
                const isDark = leak.source_url?.includes('.onion')
                
                return (
                  <div 
                    key={leak.id}
                    onClick={() => setSelectedLeak(leak)}
                    className="group relative rounded-[2rem] bg-dark-800/40 border border-dark-700 hover:border-dark-500 p-7 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/5 cursor-pointer overflow-hidden"
                  >
                    {/* Visual indicators */}
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-${config.color}/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className={`absolute top-7 right-7 w-2 h-2 rounded-full ${config.glow} animate-pulse`} style={{ backgroundColor: config.color }} />
                    
                    <div className="relative space-y-6">
                      <div className="flex items-start justify-between">
                        <div className={`p-4 rounded-2xl ${config.bg} ${config.border}`}>
                          {isDark ? (
                            <LockClosedIcon className="w-7 h-7" style={{ color: config.color }} />
                          ) : (
                            <GlobeAltIcon className="w-7 h-7" style={{ color: config.color }} />
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`} style={{ color: config.color }}>
                            {leak.severity}
                          </span>
                          <p className="text-[10px] text-gray-500 font-bold mt-2 flex items-center justify-end gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {new Date(leak.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {leak.title}
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 min-h-[2.5rem]">
                          {stripHtml(leak.description || 'No detailed intelligence analysis provided for this breach.')}
                        </p>
                      </div>

                      <div className="pt-6 border-t border-dark-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-dark-700 border border-dark-600">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase">Victim Profile</p>
                            <p className="text-sm text-gray-200 font-bold truncate max-w-[120px]">{leak.victim_name || 'Classified'}</p>
                          </div>
                        </div>
                        
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full bg-dark-700 border-2 border-dark-800 flex items-center justify-center">
                            <DocumentDuplicateIcon className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border-2 border-dark-800 flex items-center justify-center">
                            <EyeIcon className="w-3.5 h-3.5 text-indigo-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {sortedLeaks.length === 0 && (
              <div className="py-32 text-center space-y-6 bg-dark-800/20 rounded-[3rem] border border-dashed border-dark-700">
                <div className="w-24 h-24 mx-auto rounded-full bg-dark-800 flex items-center justify-center border border-dark-600">
                  <ExclamationTriangleIcon className="w-12 h-12 text-gray-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">No Intelligence Found</h3>
                  <p className="text-gray-500 max-w-sm mx-auto font-medium">Try adjusting your filters or initiate a deep scan to discover new breach signatures.</p>
                </div>
              </div>
            )}

            {/* Premium Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-6 pt-12">
                <button 
                  className="p-4 rounded-2xl bg-dark-800 text-gray-400 border border-dark-700 hover:text-white hover:border-dark-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                  disabled={page === 0} 
                  onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
                >
                  <ChevronLeftIcon className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                </button>
                
                <div className="flex items-center gap-2">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setPage(i); window.scrollTo(0, 0); }}
                      className={`w-12 h-12 rounded-2xl font-bold text-sm transition-all ${page === i ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 scale-110' : 'bg-dark-800 text-gray-500 border border-dark-700 hover:border-dark-500'}`}
                    >
                      {i + 1}
                    </button>
                  )).slice(Math.max(0, page - 2), Math.min(totalPages, page + 3))}
                </div>

                <button 
                  className="p-4 rounded-2xl bg-dark-800 text-gray-400 border border-dark-700 hover:text-white hover:border-dark-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                  disabled={page >= totalPages - 1} 
                  onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}
                >
                  <ChevronRightIcon className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Intelligence Detail Modal */}
      {selectedLeak && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          onClick={() => setSelectedLeak(null)}
        >
          <div 
            className="bg-dark-800 rounded-[2.5rem] max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-dark-600 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 border-b border-dark-700 flex items-center justify-between bg-dark-800/80 backdrop-blur-md">
              <div className="flex items-center gap-6">
                <div className={`p-5 rounded-3xl ${severityConfig[selectedLeak.severity].bg} ${severityConfig[selectedLeak.severity].border}`}>
                  {selectedLeak.source_url?.includes('.onion') ? (
                    <LockClosedIcon className="w-10 h-10" style={{ color: severityConfig[selectedLeak.severity].color }} />
                  ) : (
                    <GlobeAltIcon className="w-10 h-10" style={{ color: severityConfig[selectedLeak.severity].color }} />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${severityConfig[selectedLeak.severity].bg}`} style={{ color: severityConfig[selectedLeak.severity].color, borderColor: severityConfig[selectedLeak.severity].color + '40' }}>
                      {selectedLeak.severity} Threat
                    </span>
                    <span className="px-4 py-1.5 rounded-xl text-xs font-black bg-dark-700 text-gray-400 uppercase tracking-widest">
                      ID: {selectedLeak.id}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tight">{selectedLeak.title}</h2>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLeak(null)}
                className="p-4 rounded-2xl bg-dark-700/50 text-gray-400 hover:text-white hover:bg-dark-700 transition-all border border-dark-600"
              >
                <XMarkIcon className="w-7 h-7" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-dark-900/50 p-6 rounded-3xl border border-dark-700 flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <UserIcon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Victim Entity</p>
                    <p className="text-lg font-bold text-white">{selectedLeak.victim_name || 'Classified'}</p>
                  </div>
                </div>
                <div className="bg-dark-900/50 p-6 rounded-3xl border border-dark-700 flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-2xl">
                    <ChartBarIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Confidence Score</p>
                    <p className="text-lg font-bold text-white">{((selectedLeak.confidence || 0.85) * 100).toFixed(0)}% High</p>
                  </div>
                </div>
                <div className="bg-dark-900/50 p-6 rounded-3xl border border-dark-700 flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl">
                    <ClockIcon className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Detected On</p>
                    <p className="text-lg font-bold text-white">{new Date(selectedLeak.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="flex items-center gap-3 text-sm font-black text-white uppercase tracking-[0.2em] opacity-50">
                  <Square3Stack3DIcon className="w-5 h-5" />
                  Technical Analysis
                </h4>
                <div className="bg-dark-900/80 p-8 rounded-[2rem] border border-dark-700 shadow-inner">
                  <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap font-medium">
                    {stripHtml(selectedLeak.description || 'No technical intelligence available.')}
                  </p>
                </div>
              </div>

              {selectedLeak.source_url && (
                <div className="space-y-4">
                  <h4 className="flex items-center gap-3 text-sm font-black text-white uppercase tracking-[0.2em] opacity-50">
                    <GlobeAltIcon className="w-5 h-5" />
                    Source Connection
                  </h4>
                  <div className="flex items-center gap-4 bg-dark-900/80 p-6 rounded-[2rem] border border-dark-700">
                    <div className="flex-1 min-w-0">
                      <p className="text-indigo-400 font-mono text-sm break-all select-all">{selectedLeak.source_url}</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(selectedLeak.source_url)}
                      className="p-4 rounded-2xl bg-dark-700 text-gray-300 hover:text-white hover:bg-indigo-600 transition-all flex-shrink-0 border border-dark-600"
                    >
                      <DocumentDuplicateIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {selectedLeak.tags?.length > 0 && (
                <div className="space-y-4">
                  <h4 className="flex items-center gap-3 text-sm font-black text-white uppercase tracking-[0.2em] opacity-50">
                    <TagIcon className="w-5 h-5" />
                    Classification Tags
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedLeak.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="px-5 py-2.5 bg-dark-900 border border-dark-700 text-indigo-400 text-xs font-black rounded-2xl uppercase tracking-widest hover:border-indigo-500/50 transition-all cursor-default">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-dark-700 bg-dark-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Intelligence Feed</span>
              </div>
              <button 
                onClick={() => setSelectedLeak(null)}
                className="px-10 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all shadow-xl shadow-white/10"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
