import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { useToast } from '../components/Toast'
import { 
  PlusIcon, 
  EyeIcon, 
  XMarkIcon, 
  FunnelIcon, 
  GlobeAltIcon, 
  LockClosedIcon, 
  ServerIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon
} from '@heroicons/react/24/outline'

const SOURCE_TYPES = [
  { id: 'ransomware_gang', label: 'Ransomware Gang' },
  { id: 'hacker_forum', label: 'Hacker Forum' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'search_engine', label: 'Search Engine' },
  { id: 'fraud', label: 'Fraud' },
  { id: 'rss', label: 'RSS Feed' },
  { id: 'twitter', label: 'Twitter/X Feed' },
  { id: 'darkweb', label: 'Dark Web Site' },
  { id: 'leak_site', label: 'Leak Site' },
  { id: 'data_breach', label: 'Data Breach' },
  { id: 'threat_intel', label: 'Threat Intel Feed' },
  { id: 'other', label: 'Other' },
]

export default function Sources() {
  const [page, setPage] = useState(0)
  const [sourceType, setSourceType] = useState<string>('')
  const [showActive, setShowActive] = useState<boolean | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSource, setSelectedSource] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSource, setEditingSource] = useState<any>(null)
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [newSource, setNewSource] = useState({
    name: '',
    url: '',
    onion_url: '',
    type: 'darkweb',
    description: '',
    language: 'en',
    is_active: true,
    uses_tor: true,
    scrape_interval_minutes: 60,
    tags: [] as string[],
  })

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sources', page, sourceType, showActive],
    queryFn: async () => {
      const params: any = { skip: page * 20, limit: 20 }
      if (sourceType) params.source_type = sourceType
      if (showActive !== null) params.is_active = showActive
      const response = await api.get('/v1/sources', { params })
      return response.data
    },
    refetchInterval: 30000,
  })

  const { data: typesData } = useQuery({
    queryKey: ['source-types'],
    queryFn: async () => {
      const response = await api.get('/v1/sources/types')
      return response.data
    },
  })

  const createSource = useMutation({
    mutationFn: async (source: any) => {
      const response = await api.post('/v1/sources', source)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      showToast('Source created successfully', 'success')
      setShowAddModal(false)
      resetForm()
    },
    onError: (error: any) => {
      showToast('Failed to create source: ' + (error.message || 'Unknown error'), 'error')
    },
  })

  const updateSource = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await api.put(`/v1/sources/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      showToast('Source updated successfully', 'success')
      setSelectedSource(null)
      setEditingSource(null)
    },
    onError: (error: any) => {
      showToast('Failed to update source: ' + (error.message || 'Unknown error'), 'error')
    },
  })

  const toggleSource = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const response = await api.put(`/api/v1/sources/${id}`, { is_active })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      showToast('Source toggled successfully', 'success')
    },
    onError: () => {
      showToast('Failed to toggle source', 'error')
    },
  })

  const resetForm = () => {
    setNewSource({
      name: '',
      url: '',
      onion_url: '',
      type: 'darkweb',
      description: '',
      language: 'en',
      is_active: true,
      uses_tor: true,
      scrape_interval_minutes: 60,
      tags: [],
    })
  }

  const handleCreateSource = () => {
    if (!newSource.name || (!newSource.url && !newSource.onion_url)) {
      showToast('Name and at least one URL are required', 'error')
      return
    }
    createSource.mutate(newSource)
  }

  const handleUpdateSource = () => {
    if (!editingSource || !editingSource.name) {
      showToast('Name is required', 'error')
      return
    }
    updateSource.mutate(editingSource)
  }

  const handleScrapeAll = async () => {
    showToast('Starting scrape of all active sources...', 'info')
    try {
      const response = await api.post('/v1/scrape/trigger')
      if (response.data.status === 'started') {
        showToast('Scrape started! Data will appear automatically.', 'success')
      }
    } catch (err: any) {
      showToast('Scrape error: ' + (err.message || 'Unknown error'), 'error')
    }
  }

  const handleImportDeepdark = async () => {
    showToast('Importing sources from deepdarkCTI...', 'info')
    try {
      const response = await api.post('/v1/sources/import-deepdarkcti')
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      showToast(`Imported ${response.data.added} sources!`, 'success')
    } catch (err: any) {
      showToast('Import error: ' + (err.message || 'Unknown error'), 'error')
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ransomware_gang': return 'text-red-400 bg-red-500/10'
      case 'hacker_forum': return 'text-blue-400 bg-blue-500/10'
      case 'marketplace': return 'text-green-400 bg-green-500/10'
      case 'search_engine': return 'text-purple-400 bg-purple-500/10'
      case 'fraud': return 'text-orange-400 bg-orange-500/10'
      case 'rss': return 'text-cyan-400 bg-cyan-500/10'
      case 'twitter': return 'text-gray-400 bg-gray-500/10'
      case 'darkweb': return 'text-pink-400 bg-pink-500/10'
      case 'leak_site': return 'text-yellow-400 bg-yellow-500/10'
      case 'data_breach': return 'text-red-400 bg-red-500/10'
      case 'threat_intel': return 'text-indigo-400 bg-indigo-500/10'
      default: return 'text-gray-400 bg-gray-500/10'
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Data Sources</h1>
          <p className="text-gray-500 mt-1">
            {data?.total || 0} monitored sources ({data?.sources?.filter((s: any) => s.is_active).length || 0} active)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleImportDeepdark} className="btn btn-secondary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            Import from deepdarkCTI
          </button>
          <button onClick={handleScrapeAll} className="btn btn-secondary flex items-center gap-2">
            <PlayIcon className="w-5 h-5" />
            Scrape All
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            Add Source
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
        >
          <FunnelIcon className="w-5 h-5" />
          Filters
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowActive(null); setPage(0); }}
            className={`btn ${showActive === null ? 'btn-primary' : 'btn-secondary'}`}
          >
            All ({data?.total || 0})
          </button>
          <button
            onClick={() => { setShowActive(true); setPage(0); }}
            className={`btn ${showActive === true ? 'btn-primary' : 'btn-secondary'}`}
          >
            Active
          </button>
          <button
            onClick={() => { setShowActive(false); setPage(0); }}
            className={`btn ${showActive === false ? 'btn-primary' : 'btn-secondary'}`}
          >
            Inactive
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Source Type</label>
            <select
              className="input w-full"
              value={sourceType}
              onChange={(e) => { setSourceType(e.target.value); setPage(0); }}
            >
              <option value="">All Types</option>
              {SOURCE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => { setSourceType(''); setShowActive(null); setPage(0); }} 
              className="btn btn-secondary"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.sources?.map((source: any) => (
            <div key={source.id} className="card p-5 hover:bg-dark-700/50 transition-colors group">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${getTypeColor(source.type)}`}>
                  {source.is_onion || source.onion_url ? (
                    <LockClosedIcon className="w-6 h-6" />
                  ) : (
                    <GlobeAltIcon className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-200 truncate">{source.name}</h3>
                    <span className={`badge ${source.is_active ? 'badge-success' : 'badge-warning'}`}>
                      {source.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {source.description || 'No description'}
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <span className={`px-2 py-0.5 rounded ${getTypeColor(source.type)}`}>
                      {SOURCE_TYPES.find(t => t.id === source.type)?.label || source.type}
                    </span>
                    {source.language && <span>Lang: {source.language}</span>}
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-600">
                    <div className="text-xs text-gray-500">
                      {source.scrape_interval_minutes || 60}m interval
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleSource.mutate({ id: source.id, is_active: !source.is_active })}
                        className={`p-1.5 rounded ${source.is_active ? 'text-red-400 hover:bg-red-500/20' : 'text-green-400 hover:bg-green-500/20'}`}
                        title={source.is_active ? 'Disable' : 'Enable'}
                      >
                        {source.is_active ? <XMarkIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => setSelectedSource(source)}
                        className="p-1.5 rounded text-gray-400 hover:bg-dark-600 hover:text-gray-200"
                        title="Edit"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(!data?.sources || data.sources.length === 0) && !isLoading && (
        <div className="card p-12 text-center">
          <ServerIcon className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500 text-lg">No sources found</p>
          <p className="text-gray-600 text-sm mt-2">
            Click "Add Source" to add your first data source
          </p>
        </div>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            Previous
          </button>
          <span className="text-gray-500">
            Page {page + 1} of {Math.ceil(data.total / 20)}
          </span>
          <button className="btn btn-secondary" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-dark-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-dark-800 border-b border-dark-600 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-100">Add New Source</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Source name"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Surface URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://example.com"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Onion URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="http://example.onion"
                  value={newSource.onion_url}
                  onChange={(e) => setNewSource({ ...newSource, onion_url: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  className="input"
                  value={newSource.type}
                  onChange={(e) => setNewSource({ ...newSource, type: e.target.value })}
                >
                  {SOURCE_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Brief description of this source"
                  value={newSource.description}
                  onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Language</label>
                  <select
                    className="input"
                    value={newSource.language}
                    onChange={(e) => setNewSource({ ...newSource, language: e.target.value })}
                  >
                    <option value="en">English</option>
                    <option value="ru">Russian</option>
                    <option value="zh">Chinese</option>
                    <option value="es">Spanish</option>
                    <option value="de">German</option>
                    <option value="fr">French</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Scrape Interval</label>
                  <select
                    className="input"
                    value={newSource.scrape_interval_minutes}
                    onChange={(e) => setNewSource({ ...newSource, scrape_interval_minutes: parseInt(e.target.value) })}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="360">6 hours</option>
                    <option value="1440">24 hours</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSource.is_active}
                    onChange={(e) => setNewSource({ ...newSource, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-sm text-gray-300">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSource.uses_tor}
                    onChange={(e) => setNewSource({ ...newSource, uses_tor: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-sm text-gray-300">Requires Tor</span>
                </label>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-dark-800 border-t border-dark-600 p-4 flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleCreateSource} disabled={createSource.isPending} className="btn btn-primary">
                {createSource.isPending ? 'Creating...' : 'Create Source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSource && !editingSource && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSource(null)}>
          <div className="bg-dark-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-dark-800 border-b border-dark-600 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-100">Edit Source</h2>
              <button onClick={() => setSelectedSource(null)} className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  className="input"
                  value={selectedSource.name}
                  onChange={(e) => setEditingSource({ ...selectedSource, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  className="input"
                  value={selectedSource.type}
                  onChange={(e) => setEditingSource({ ...selectedSource, type: e.target.value })}
                >
                  {SOURCE_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  className="input min-h-[80px]"
                  value={selectedSource.description || ''}
                  onChange={(e) => setEditingSource({ ...selectedSource, description: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Language</label>
                  <select
                    className="input"
                    value={selectedSource.language || 'en'}
                    onChange={(e) => setEditingSource({ ...selectedSource, language: e.target.value })}
                  >
                    <option value="en">English</option>
                    <option value="ru">Russian</option>
                    <option value="zh">Chinese</option>
                    <option value="es">Spanish</option>
                    <option value="de">German</option>
                    <option value="fr">French</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Interval</label>
                  <select
                    className="input"
                    value={selectedSource.scrape_interval_minutes || 60}
                    onChange={(e) => setEditingSource({ ...selectedSource, scrape_interval_minutes: parseInt(e.target.value) })}
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="360">6 hours</option>
                    <option value="1440">24 hours</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSource.is_active}
                    onChange={(e) => setEditingSource({ ...selectedSource, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-accent-primary"
                  />
                  <span className="text-sm text-gray-300">Active</span>
                </label>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-dark-800 border-t border-dark-600 p-4 flex justify-between">
              <button onClick={() => setSelectedSource(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={() => {
                  updateSource.mutate({ id: selectedSource.id, ...editingSource || selectedSource })
                }} 
                disabled={updateSource.isPending}
                className="btn btn-primary"
              >
                {updateSource.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
