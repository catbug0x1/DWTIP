import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { useToast } from '../components/Toast'
import {
  MagnifyingGlassIcon,
  EyeIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  FlagIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  GlobeAltIcon,
  EyeSlashIcon,
  ArchiveBoxIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'

const THREAT_TYPES = [
  'Ransomware',
  'APT',
  'Cybercrime',
  'Hacktivist',
  'State-Sponsored',
  'Financially Motivated',
  'Espionage',
]

const REGIONS = [
  'North America',
  'Europe',
  'Asia',
  'Russia/CIS',
  'Middle East',
  'Africa',
  'South America',
]

const SECTORS = [
  'Healthcare',
  'Finance',
  'Government',
  'Education',
  'Critical Infrastructure',
  'Technology',
  'Retail',
  'Manufacturing',
  'Energy',
  'Telecommunications',
]

const PREDEFINED_ACTORS = [
  {
    name: 'LockBit',
    aliases: ['LockBit 2.0', 'LockBit 3.0', 'Team LockBit'],
    description: 'One of the most prolific ransomware-as-a-service operations, known for double-extortion tactics and aggressive affiliate program.',
    threat_type: 'Ransomware',
    risk_level: 'critical',
    origin: 'Russia/CIS',
    motivation: 'Financial',
    sophistication: 'High',
    resource_level: 'High',
    target_sectors: ['Healthcare', 'Finance', 'Government', 'Critical Infrastructure'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1562', 'T1070', 'T1021'],
    tools: ['LockBit Ransomware', 'StealBIT', 'Blacksuit'],
    tags: ['ransomware', 'double-extortion', 'RaaS', 'active'],
  },
  {
    name: 'ALPHV/BlackCat',
    aliases: ['Noberus', 'ALPHV', 'BlackCat'],
    description: 'Sophisticated ransomware-as-a-service group using a Rust-based ransomware, known for targeting healthcare and critical infrastructure.',
    threat_type: 'Ransomware',
    risk_level: 'critical',
    origin: 'Russia/CIS',
    motivation: 'Financial',
    sophistication: 'Very High',
    resource_level: 'High',
    target_sectors: ['Healthcare', 'Energy', 'Finance', 'Critical Infrastructure'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1562', 'T1059', 'T1021'],
    tools: ['BlackCat Ransomware', 'Exmatter', 'Cobalt Strike'],
    tags: ['ransomware', 'Rust', 'RaaS', 'active'],
  },
  {
    name: 'Clop',
    aliases: ['CLOP', 'Clop Ransomware'],
    description: 'Russia-based ransomware group known for CLOPta campaign, targeting healthcare, finance, and education sectors with double-extortion.',
    threat_type: 'Ransomware',
    risk_level: 'high',
    origin: 'Russia/CIS',
    motivation: 'Financial',
    sophistication: 'High',
    resource_level: 'High',
    target_sectors: ['Healthcare', 'Education', 'Finance'],
    target_regions: ['North America', 'Europe', 'Asia'],
    ttps: ['T1486', 'T1490', 'T1059', 'T1070'],
    tools: ['Clop Ransomware', 'TrickBot', 'Cobalt Strike'],
    tags: ['ransomware', 'double-extortion', 'active'],
  },
  {
    name: 'Conti',
    aliases: ['Conti Ransomware', 'Wizard Spider', 'Gold Blackburn'],
    description: 'Notorious ransomware group responsible for numerous high-profile attacks, known for rapid encryption and data theft.',
    threat_type: 'Ransomware',
    risk_level: 'critical',
    origin: 'Russia/CIS',
    motivation: 'Financial',
    sophistication: 'Very High',
    resource_level: 'Very High',
    target_sectors: ['Healthcare', 'Government', 'Finance', 'Critical Infrastructure'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1059', 'T1070', 'T1021', 'T1005'],
    tools: ['Conti Ransomware', 'Cobalt Strike', 'TrickBot'],
    tags: ['ransomware', 'double-extortion', 'nation-state-tied'],
  },
  {
    name: 'REvil',
    aliases: ['Sodinokibi', 'Sodin', 'REvil Ransomware'],
    description: 'Aggressive ransomware group known for high-profile attacks including Kaseya and JBS Foods, operates RaaS model.',
    threat_type: 'Ransomware',
    risk_level: 'critical',
    origin: 'Russia/CIS',
    motivation: 'Financial',
    sophistication: 'Very High',
    resource_level: 'High',
    target_sectors: ['Technology', 'Healthcare', 'Finance', 'Retail'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1059', 'T1070', 'T1021'],
    tools: ['Sodinokibi Ransomware', 'Gandcrab'],
    tags: ['ransomware', 'RaaS', 'high-profile'],
  },
  {
    name: 'Lazarus Group',
    aliases: ['Hidden Cobra', 'Zinc', 'APT38', 'Guardians of Peace'],
    description: 'North Korean state-sponsored APT group responsible for financial crimes, cyber espionage, and destructive attacks.',
    threat_type: 'APT',
    risk_level: 'critical',
    origin: 'Asia',
    motivation: 'Espionage',
    sophistication: 'Extremely High',
    resource_level: 'State-Level',
    target_sectors: ['Finance', 'Government', 'Technology', 'Energy'],
    target_regions: ['North America', 'Europe', 'Asia'],
    ttps: ['T1486', 'T1059', 'T1070', 'T1005', 'T1047', 'T1012'],
    tools: ['HPC malware', 'FALLCHILL', 'MANICULTIM', 'Cobalt Strike'],
    tags: ['apt', 'state-sponsored', 'financial-crime', 'north-korea'],
  },
  {
    name: 'APT29',
    aliases: ['Cozy Bear', 'The Dukes', 'Nobelium'],
    description: 'Russian state-sponsored APT associated with SVR, known for SolarWinds compromise and political espionage operations.',
    threat_type: 'APT',
    risk_level: 'critical',
    origin: 'Russia/CIS',
    motivation: 'Espionage',
    sophistication: 'Extremely High',
    resource_level: 'State-Level',
    target_sectors: ['Government', 'Technology', 'Healthcare', 'Defense'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1059', 'T1070', 'T1005', 'T1047', 'T1012', 'T1560'],
    tools: 'WellMess, Spyder, CozyCar, NOBELIUM malware',
    tags: ['apt', 'russian', 'state-sponsored', 'espionage'],
  },
  {
    name: 'APT41',
    aliases: ['Barium', 'Wicked Panda', 'Winnti Group'],
    description: 'Chinese state-sponsored APT conducting both espionage and financial crime operations, known for supply chain attacks.',
    threat_type: 'APT',
    risk_level: 'high',
    origin: 'Asia',
    motivation: 'Espionage',
    sophistication: 'Very High',
    resource_level: 'State-Level',
    target_sectors: ['Technology', 'Healthcare', 'Telecommunications', 'Gaming'],
    target_regions: ['North America', 'Europe', 'Asia'],
    ttps: ['T1059', 'T1070', 'T1005', 'T1021', 'T1486'],
    tools: ['Winnti malware', 'PlugX', 'CROSSWALK', 'ShadowPad'],
    tags: ['apt', 'chinese', 'state-sponsored', 'supply-chain'],
  },
  {
    name: 'DarkSide',
    aliases: ['DarkSide Ransomware'],
    description: 'Ransomware group responsible for Colonial Pipeline attack, known for affiliate model and causing major disruptions.',
    threat_type: 'Ransomware',
    risk_level: 'high',
    origin: 'Russia/CIS',
    motivation: 'Financial',
    sophistication: 'High',
    resource_level: 'High',
    target_sectors: ['Energy', 'Critical Infrastructure', 'Technology'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1059', 'T1021'],
    tools: ['DarkSide Ransomware'],
    tags: ['ransomware', 'critical-infrastructure', 'discontinued'],
  },
  {
    name: 'Hive',
    aliases: ['Hive Ransomware'],
    description: 'Ransomware-as-a-service group known for healthcare sector targeting and rapid encryption capabilities.',
    threat_type: 'Ransomware',
    risk_level: 'high',
    origin: 'Unknown',
    motivation: 'Financial',
    sophistication: 'High',
    resource_level: 'High',
    target_sectors: ['Healthcare', 'Critical Infrastructure', 'Finance'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1059', 'T1021'],
    tools: ['Hive Ransomware'],
    tags: ['ransomware', 'RaaS', 'healthcare'],
  },
  {
    name: 'Royal',
    aliases: ['Royal Ransomware'],
    description: 'Emerging ransomware group known for targeting healthcare and critical infrastructure with double-extortion.',
    threat_type: 'Ransomware',
    risk_level: 'high',
    origin: 'Unknown',
    motivation: 'Financial',
    sophistication: 'High',
    resource_level: 'High',
    target_sectors: ['Healthcare', 'Education', 'Critical Infrastructure'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1059', 'T1021'],
    tools: ['Royal Ransomware', 'Cobalt Strike'],
    tags: ['ransomware', 'double-extortion', 'active'],
  },
  {
    name: 'Black Basta',
    aliases: ['Black Basta Ransomware'],
    description: 'Ransomware group with suspected ties to Conti, known for targeting critical infrastructure and healthcare.',
    threat_type: 'Ransomware',
    risk_level: 'high',
    origin: 'Russia/CIS',
    motivation: 'Financial',
    sophistication: 'High',
    resource_level: 'High',
    target_sectors: ['Healthcare', 'Energy', 'Finance', 'Critical Infrastructure'],
    target_regions: ['North America', 'Europe'],
    ttps: ['T1486', 'T1490', 'T1059', 'T1021'],
    tools: ['Black Basta Ransomware', 'QakBot'],
    tags: ['ransomware', 'double-extortion', 'active'],
  },
]

export default function ThreatActors() {
  const [search, setSearch] = useState('')
  const [riskLevel, setRiskLevel] = useState<string>('')
  const [isActive, setIsActive] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [selectedActor, setSelectedActor] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingActor, setEditingActor] = useState<any>(null)
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['threat-actors', page],
    queryFn: async () => {
      const response = await api.get('/v1/threat-actors', {
        params: { search, skip: page * 20, limit: 100 }
      })
      return response.data
    },
  })

  const filteredActors = data?.actors?.filter((actor: any) => {
    if (search && !actor.name.toLowerCase().includes(search.toLowerCase()) && 
        !actor.aliases?.some((a: string) => a.toLowerCase().includes(search.toLowerCase()))) return false
    if (riskLevel && actor.risk_level !== riskLevel) return false
    if (isActive !== null && actor.is_active !== isActive) return false
    return true
  }) || []

  const stats = {
    total: data?.total || 0,
    active: data?.actors?.filter((a: any) => a.is_active).length || 0,
    critical: data?.actors?.filter((a: any) => a.risk_level === 'critical').length || 0,
    high: data?.actors?.filter((a: any) => a.risk_level === 'high').length || 0,
  }

  const handleRefresh = () => {
    refetch()
    showToast('Refreshing threat actors...', 'info')
  }

  const handleSeedData = async () => {
    showToast('Adding known threat actors...', 'info')
    let added = 0
    for (const actor of PREDEFINED_ACTORS) {
      try {
        await api.post('/v1/threat-actors', actor)
        added++
      } catch (e: any) {
        if (e.response?.status === 409) {
          continue
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['threat-actors'] })
    showToast(`Added ${added} threat actors`, 'success')
  }

  const handleDelete = async (actor: any) => {
    if (!confirm(`Delete ${actor.name}?`)) return
    try {
      await api.delete(`/api/v1/threat-actors/${actor.id}`)
      queryClient.invalidateQueries({ queryKey: ['threat-actors'] })
      showToast(`${actor.name} deleted`, 'success')
      setSelectedActor(null)
    } catch (e) {
      showToast('Failed to delete actor', 'error')
    }
  }

  const handleToggleActive = async (actor: any) => {
    try {
      await api.put(`/api/v1/threat-actors/${actor.id}`, { is_active: !actor.is_active })
      queryClient.invalidateQueries({ queryKey: ['threat-actors'] })
      showToast(`${actor.name} ${actor.is_active ? 'deactivated' : 'activated'}`, 'success')
    } catch (e) {
      showToast('Failed to update actor', 'error')
    }
  }

  const exportActors = () => {
    const actors = filteredActors.map((a: any) => ({
      name: a.name,
      aliases: a.aliases?.join(', ') || '',
      risk_level: a.risk_level,
      is_active: a.is_active,
      threat_type: a.threat_type,
      origin: a.origin,
      target_sectors: a.target_sectors?.join(', ') || '',
      tools: a.tools?.join(', ') || '',
      description: a.description,
    }))
    const headers = Object.keys(actors[0] || {})
    const csv = [headers.join(','), ...actors.map((row: Record<string, unknown>) => headers.map((h: string) => `"${row[h] || ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `threat-actors-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    showToast('Threat actors exported', 'success')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard', 'success')
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const clearFilters = () => {
    setRiskLevel('')
    setIsActive(null)
    setSearch('')
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
          Error loading threat actors. Please try again.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Threat Actors</h1>
          <p className="text-gray-500 mt-1">
            {data?.total || 0} tracked ransomware groups and threat actors
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportActors} className="btn btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-5 h-5" />
            Export
          </button>
          <button onClick={handleSeedData} className="btn btn-secondary flex items-center gap-2">
            <BeakerIcon className="w-5 h-5" />
            Add Known Actors
          </button>
          <button onClick={handleRefresh} disabled={isFetching} className="btn btn-secondary flex items-center gap-2">
            <ArrowPathIcon className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="w-8 h-8 text-accent-primary" />
            <div>
              <p className="text-2xl font-bold text-gray-100">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Actors</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-gray-100">{stats.active}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-gray-100">{stats.critical}</p>
              <p className="text-sm text-gray-500">Critical Risk</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <FlagIcon className="w-8 h-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold text-gray-100">{stats.high}</p>
              <p className="text-sm text-gray-500">High Risk</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search threat actors or aliases..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Risk Level</label>
            <select
              className="input w-full"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select
              className="input w-full"
              value={isActive === null ? '' : isActive ? 'active' : 'inactive'}
              onChange={(e) => {
                const val = e.target.value
                setIsActive(val === '' ? null : val === 'active')
              }}
            >
              <option value="">All</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-primary"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActors.length === 0 ? (
            <div className="card p-12 text-center">
              <UserGroupIcon className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500 text-lg">No threat actors found</p>
              <p className="text-gray-600 text-sm mt-2">
                Click "Add Known Actors" to populate with real threat data
              </p>
            </div>
          ) : (
            filteredActors.map((actor: any) => (
              <div key={actor.id} className="card p-4 hover:bg-dark-700/50 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-medium text-gray-200">
                        {actor.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(actor.risk_level)}`}>
                        {actor.risk_level?.toUpperCase() || 'UNKNOWN'}
                      </span>
                      {actor.is_active ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/50">
                          INACTIVE
                        </span>
                      )}
                      {actor.threat_type && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/50">
                          {actor.threat_type}
                        </span>
                      )}
                    </div>
                    
                    {actor.aliases?.length > 0 && (
                      <p className="text-gray-500 text-sm mb-2">
                        <span className="text-gray-400">Aliases:</span> {actor.aliases.join(', ')}
                      </p>
                    )}
                    
                    <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                      {actor.description || 'No description available'}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      {actor.origin && (
                        <span className="flex items-center gap-1">
                          <GlobeAltIcon className="w-3 h-3" />
                          {actor.origin}
                        </span>
                      )}
                      <span>First seen: <span className="text-gray-400">{actor.first_seen ? new Date(actor.first_seen).toLocaleDateString() : 'Unknown'}</span></span>
                      {actor.target_sectors?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <FlagIcon className="w-3 h-3" />
                          {actor.target_sectors.slice(0, 2).join(', ')}
                          {actor.target_sectors.length > 2 && ` +${actor.target_sectors.length - 2}`}
                        </span>
                      )}
                    </div>

                    {actor.ttps?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {actor.ttps.slice(0, 5).map((ttp: string) => (
                          <span key={ttp} className="px-1.5 py-0.5 bg-dark-600 text-gray-400 text-xs rounded">
                            {ttp}
                          </span>
                        ))}
                        {actor.ttps.length > 5 && (
                          <span className="px-1.5 py-0.5 text-gray-500 text-xs">
                            +{actor.ttps.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleToggleActive(actor)}
                      className="p-2 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-green-400 transition-colors"
                      title={actor.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {actor.is_active ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setSelectedActor(actor)}
                      className="p-2 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-accent-primary transition-colors"
                      title="View details"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(actor)}
                      className="p-2 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            className="btn btn-secondary"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page + 1} of {Math.ceil(data.total / 20)}
          </span>
          <button
            className="btn btn-secondary"
            disabled={(page + 1) * 20 >= data.total}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {selectedActor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-dark-700 border-b border-dark-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-100">{selectedActor.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(selectedActor.risk_level)}`}>
                  {selectedActor.risk_level?.toUpperCase() || 'UNKNOWN'}
                </span>
                {selectedActor.is_active && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(selectedActor)}
                  className="btn btn-secondary text-sm"
                >
                  {selectedActor.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(selectedActor)}
                  className="btn btn-danger text-sm"
                >
                  <TrashIcon className="w-4 h-4 mr-1" />
                  Delete
                </button>
                <button 
                  onClick={() => setSelectedActor(null)}
                  className="p-2 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedActor.aliases?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase mb-2 flex items-center gap-2">
                    <DocumentDuplicateIcon className="w-4 h-4" />
                    Aliases
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedActor.aliases.map((alias: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-dark-500 text-gray-300 text-sm rounded-lg border border-dark-400">
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium text-gray-400 uppercase mb-2">Description</h4>
                <p className="text-gray-300">{selectedActor.description || 'No description available'}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-3 bg-dark-600">
                  <p className="text-xs text-gray-500 uppercase mb-1">Type</p>
                  <p className="text-gray-200 font-medium">{selectedActor.threat_type || 'Unknown'}</p>
                </div>
                <div className="card p-3 bg-dark-600">
                  <p className="text-xs text-gray-500 uppercase mb-1">Origin</p>
                  <p className="text-gray-200 font-medium">{selectedActor.origin || 'Unknown'}</p>
                </div>
                <div className="card p-3 bg-dark-600">
                  <p className="text-xs text-gray-500 uppercase mb-1">Motivation</p>
                  <p className="text-gray-200 font-medium">{selectedActor.motivation || 'Unknown'}</p>
                </div>
                <div className="card p-3 bg-dark-600">
                  <p className="text-xs text-gray-500 uppercase mb-1">Sophistication</p>
                  <p className="text-gray-200 font-medium">{selectedActor.sophistication || 'Unknown'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase mb-2 flex items-center gap-2">
                    <GlobeAltIcon className="w-4 h-4" />
                    Target Regions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedActor.target_regions?.length > 0 ? (
                      selectedActor.target_regions.map((region: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded border border-blue-500/30">
                          {region}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">No data</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase mb-2 flex items-center gap-2">
                    <FlagIcon className="w-4 h-4" />
                    Target Sectors
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedActor.target_sectors?.length > 0 ? (
                      selectedActor.target_sectors.map((sector: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded border border-purple-500/30">
                          {sector}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">No data</span>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedActor.ttps?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase mb-2 flex items-center gap-2">
                    <BeakerIcon className="w-4 h-4" />
                    ATT&CK TTPs
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedActor.ttps.map((ttp: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-red-500/10 text-red-400 text-sm rounded border border-red-500/30 font-mono">
                        {ttp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedActor.tools?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase mb-2 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    Tools & Malware
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedActor.tools.map((tool: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-orange-500/10 text-orange-400 text-sm rounded border border-orange-500/30">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedActor.wallet_addresses?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase mb-2">Wallet Addresses</h4>
                  <div className="space-y-2">
                    {selectedActor.wallet_addresses.map((wallet: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-dark-600 p-2 rounded">
                        <code className="text-gray-300 text-sm flex-1 break-all font-mono">{wallet}</code>
                        <button
                          onClick={() => copyToClipboard(wallet)}
                          className="btn btn-secondary text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedActor.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 uppercase mb-2">Notes</h4>
                  <p className="text-gray-300 bg-dark-600 p-3 rounded">{selectedActor.notes}</p>
                </div>
              )}

              <div className="border-t border-dark-500 pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">First Seen:</span>
                    <span className="text-gray-300 ml-2">
                      {selectedActor.first_seen ? new Date(selectedActor.first_seen).toLocaleString() : 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Activity:</span>
                    <span className="text-gray-300 ml-2">
                      {selectedActor.last_activity ? new Date(selectedActor.last_activity).toLocaleString() : 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Attribution Score:</span>
                    <span className="text-gray-300 ml-2">{selectedActor.attribution_score || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Threat Score:</span>
                    <span className="text-gray-300 ml-2">{selectedActor.threat_score || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
