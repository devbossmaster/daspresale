'use client'

import { useMemo, useState } from 'react'
import { Package, History, Wallet } from 'lucide-react'
import AssetsTab from '@/components/user-dashboard/AssetsTab'
import OverviewTab from '@/components/user-dashboard/OverviewTab'

type TabId = 'overview' | 'assets' | 'transactions'

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: Package },
  { id: 'assets', label: 'Assets', icon: Wallet },
]

export default function UserDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const Active = useMemo(() => {
    if (activeTab === 'overview') return OverviewTab
    return AssetsTab
  }, [activeTab])

  return (
    <div className="space-y-6 md:space-y-8 lg:space-y-10 px-4 sm:px-6 pt-4 sm:pt-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">User Dashboard</h1>
        <p className="text-sm md:text-base text-gray-400 mt-1">Manage your assets and view transaction history</p>
      </div>

      {/* Tabs Navigation */}
      <div>
        <div
          role="tablist"
          aria-label="User dashboard tabs"
          className="flex gap-2 rounded-2xl bg-slate-900 p-1 border border-slate-800"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium',
                  'transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60',
                  isActive
                    ? 'border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white'
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">{tab.label}</span>
                <span className="xs:hidden">{tab.label.slice(0, 1)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        <Active />
      </div>
    </div>
  )
}
