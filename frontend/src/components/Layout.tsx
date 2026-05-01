import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'
import {
  HomeIcon,
  ShieldExclamationIcon,
  UserGroupIcon,
  CircleStackIcon,
  MegaphoneIcon,
  BellIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  WifiIcon,
  SignalSlashIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Leaks', href: '/leaks', icon: ShieldExclamationIcon },
  { name: 'Threat Actors', href: '/actors', icon: UserGroupIcon },
  { name: 'IOCs', href: '/iocs', icon: CircleStackIcon },
  { name: 'Sources', href: '/sources', icon: MegaphoneIcon },
  { name: 'Alerts', href: '/alerts', icon: BellIcon },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { isConnected } = useWebSocket()
  const location = useLocation()

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'unread'],
    queryFn: async () => {
      const response = await api.get('/v1/alerts', { params: { is_read: false } })
      return response.data
    },
    refetchInterval: 30000,
  })

  const unreadAlerts = alertsData?.unread || 0

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-dark-800 border-r border-dark-600 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-dark-600">
          <h1 className="text-xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
            DWTIP
          </h1>
          <span className="ml-2 text-xs text-gray-500">v1.0</span>
          <div className="ml-auto flex items-center gap-1">
            {isConnected ? (
              <WifiIcon className="w-4 h-4 text-green-400" title="Connected" />
            ) : (
              <SignalSlashIcon className="w-4 h-4 text-red-400" title="Disconnected" />
            )}
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-primary/10 text-accent-primary border-l-2 border-accent-primary'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
                {item.name === 'Alerts' && unreadAlerts > 0 && (
                  <span className="ml-auto bg-accent-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadAlerts}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-dark-600">
          <Link
            to="/settings"
            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-dark-700 transition-all"
          >
            <Cog6ToothIcon className="w-5 h-5 mr-3" />
            Settings
          </Link>
          
          <div className="mt-2 pt-2 border-t border-dark-600">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-gray-200">{user?.username}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-dark-700 transition-all"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto scrollbar">
        <Outlet />
      </main>
    </div>
  )
}
