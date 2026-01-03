'use client'

import { useMemo } from 'react'
import { DollarSign, Coins, ShoppingBag } from 'lucide-react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useTokenIcoDashboard } from '@/lib/hooks/useTokenIcoDashboard'
import { useRecentPurchases } from '@/lib/hooks/useRecentPurchases'
import { useMounted } from '@/lib/hooks/useMounted'

function formatDecimalStr(v?: string, maxFrac = 4) {
  if (!v) return '—'
  const [intPartRaw, fracRaw = ''] = v.split('.')
  const intPart = (intPartRaw || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, '')
  return frac.length ? `${intPart}.${frac}` : intPart
}

function formatDateClient(ts: number) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function OverviewTab() {
  const mounted = useMounted()
  const { address } = useAccount()
  const { data: dash, userBalHuman, isLoading: dashLoading, error: dashError } = useTokenIcoDashboard()

  const payDecimals = dash?.payDecimals ?? 18
  const paySymbol = dash?.paySymbol ?? 'USDT'
  const tokenSymbol = dash?.symbol ?? 'TOKEN'
  const tokenDecimals = dash?.decimals ?? 18

  // Reads from on-chain events; tune range for production
  const { rows, isLoading: logsLoading, error: logsError } = useRecentPurchases({
    limit: 200,
    blockRange: 50_000n,
    minBlockDelta: 3n,
  })

  const myRows = useMemo(() => {
    if (!address) return []
    const a = address.toLowerCase()
    return rows.filter((r) => r.buyer.toLowerCase() === a)
  }, [rows, address])

  const totals = useMemo(() => {
    const spent = myRows.reduce((acc, r) => acc + r.amountPaid, 0n)
    const bought = myRows.reduce((acc, r) => acc + r.tokensBought, 0n)
    return { spent, bought, count: myRows.length }
  }, [myRows])

  const spentHuman = useMemo(
    () => formatDecimalStr(formatUnits(totals.spent, payDecimals), 2),
    [totals.spent, payDecimals]
  )

  const boughtHuman = useMemo(
    () => formatDecimalStr(formatUnits(totals.bought, tokenDecimals), 4),
    [totals.bought, tokenDecimals]
  )

  const recent = useMemo(() => myRows.slice(0, 3), [myRows])
  const isLoading = dashLoading || logsLoading
  const readError = dashError || logsError

  const stats = [
    {
      title: 'Token Balance',
      value: !address ? '—' : isLoading ? 'Loading...' : userBalHuman,
      subtitle: tokenSymbol,
      icon: DollarSign,
      color: 'text-cyan-400',
      bgColor: 'bg-gradient-to-br from-cyan-500/10 to-blue-600/10',
    },
    {
      title: `${paySymbol} Spent`,
      value: !address ? '—' : isLoading ? 'Loading...' : spentHuman,
      subtitle: paySymbol,
      icon: Coins,
      color: 'text-emerald-400',
      bgColor: 'bg-gradient-to-br from-emerald-500/10 to-green-600/10',
    },
    {
      title: 'Purchases',
      value: !address ? '—' : isLoading ? 'Loading...' : `${totals.count}`,
      subtitle: !address ? 'Connect wallet' : `Total: ${boughtHuman} ${tokenSymbol}`,
      icon: ShoppingBag,
      color: 'text-purple-400',
      bgColor: 'bg-gradient-to-br from-purple-500/10 to-violet-600/10',
    },
  ] as const

  return (
    <div className="space-y-6 sm:space-y-8">
      {readError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {readError.message}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-black p-5 sm:p-6"
          >
            <div className="flex items-start justify-between mb-4 sm:mb-6">
              <div className={`p-2.5 sm:p-3 rounded-xl ${stat.bgColor} border border-slate-700`}>
                <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold mb-1">{stat.value}</div>
              <div className={`text-sm ${stat.color} mb-2`}>{stat.subtitle}</div>
              <div className="text-base font-medium text-gray-300">{stat.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-black p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold">Recent Activity</h3>
            <p className="text-sm text-gray-400 mt-1">
              {address ? 'Your latest on-chain purchases' : 'Connect wallet to see your activity'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {!address && (
            <div className="p-4 rounded-xl border border-slate-800 text-sm text-gray-400">Wallet not connected.</div>
          )}

          {address && !isLoading && recent.length === 0 && (
            <div className="p-4 rounded-xl border border-slate-800 text-sm text-gray-400">No purchases found yet.</div>
          )}

          {recent.map((p, i) => (
            <div
              key={`${p.txHash}-${i}`}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <div className="font-medium">Token Purchase</div>
                  <div className="text-sm text-gray-400">
                    {mounted ? formatDateClient(p.timestamp) : '—'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-lg text-cyan-300">
                  {formatDecimalStr(formatUnits(p.tokensBought, tokenDecimals), 4)} {tokenSymbol}
                </div>
                <div className="text-sm text-gray-400">
                  Paid: {formatDecimalStr(formatUnits(p.amountPaid, payDecimals), 2)} {paySymbol}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Note: This view is derived from the contract’s <code>TokensPurchased</code> events within the scanned block range.
        </div>
      </div>
    </div>
  )
}
