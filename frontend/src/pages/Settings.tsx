import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function Settings() {
  const queryClient = useQueryClient()
  const [newKeyword, setNewKeyword] = useState('')

  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await api.get('/v1/auth/me')
      return response.data
    },
  })

  const updateProfile = useMutation({
    mutationFn: async (data: any) => {
      await api.put('/v1/auth/me', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
    },
  })

  const addKeyword = async () => {
    if (newKeyword.trim()) {
      const keywords = userData?.alert_keywords || []
      await updateProfile.mutateAsync({ alert_keywords: [...keywords, newKeyword] })
      setNewKeyword('')
    }
  }

  const removeKeyword = async (keyword: string) => {
    const keywords = userData?.alert_keywords || []
    await updateProfile.mutateAsync({ alert_keywords: keywords.filter((k: string) => k !== keyword) })
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Username
              </label>
              <input
                type="text"
                className="input"
                value={userData?.username || ''}
                disabled
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Email
              </label>
              <input
                type="email"
                className="input"
                value={userData?.email || ''}
                disabled
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Full Name
              </label>
              <input
                type="text"
                className="input"
                defaultValue={userData?.full_name || ''}
                onBlur={(e) => updateProfile.mutate({ full_name: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Alert Keywords</h2>
          <p className="text-sm text-gray-500 mb-4">
            Get notified when these keywords appear in new leaks
          </p>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="input"
              placeholder="Add keyword..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
            />
            <button onClick={addKeyword} className="btn btn-primary">
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {userData?.alert_keywords?.map((keyword: string) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-3 py-1 bg-accent-primary/10 border border-accent-primary/30 rounded-full text-sm text-accent-primary"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="hover:text-red-400 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </span>
            ))}
            {(!userData?.alert_keywords || userData.alert_keywords.length === 0) && (
              <p className="text-sm text-gray-500">No keywords configured</p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Notifications</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-gray-400">Email notifications</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-gray-400">Browser notifications</span>
              <input type="checkbox" className="toggle" />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-gray-400">Daily digest</span>
              <input type="checkbox" className="toggle" defaultChecked />
            </label>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">System Info</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="text-gray-300">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <span className="text-gray-300">{userData?.role || 'viewer'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last login</span>
              <span className="text-gray-300">
                {userData?.last_login ? new Date(userData.last_login).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
