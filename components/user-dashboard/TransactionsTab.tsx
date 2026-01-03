'use client'

import { useMemo, useState } from 'react'
import { CheckCircle, ExternalLink, Filter } from 'lucide-react'
import { useAccount, useChainId, useChains } from 'wagmi'
import { formatUnits } from 'viem'
import { useTokenIcoDashboard } from '@/lib/hooks/useTokenIcoDashboard'
import { useRecentPurchases } from '@/lib/hooks/useRecentPurchases'
import { useMounted } from '@/lib/hooks/useMounted'
import { hardhat } from 'wagmi/chains'

function formatDecimalStr(v?: string, maxFrac = 4) {
  if (!v) return '—'
  const [intPartRaw, fracRaw = ''] = v.split('.')
  const intPart = (intPartRaw || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, '')
  return frac.length ? `${intPart}.${frac}` : intPart
}

function formatDateTimeClient(ts: number) {
  if (!ts) return { date: '—', time: '—' }
  const d = new Date(ts * 1000)
  return {
    date: d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

export default function TransactionsTab() {
  const mounted = useMounted()
  const [filter, setFilter] = useState<'all' | 'completed'>('all')

  const { address } = useAccount()
  const { data: dash, isLoading: dashLoading, error: dashError } = useTokenIcoDashboard()

  const tokenSymbol = dash?.symbol ?? 'TOKEN'
  const tokenDecimals = dash?.decimals ?? 18
  const paySymbol = dash?.paySymbol ?? 'USDT'
  const payDecimals = dash?.payDecimals ?? 18

  const { rows, isLoading: logsLoading, error: logsError } = useRecentPurchases({
    limit: 200,
    blockRange: 50_000n,
    minBlockDelta: 3n,
  })

  const chainId = useChainId()
  const chains = useChains()
  const chain = chains.find((c) => c.id === chainId)

  const explorerBase =
    chainId === hardhat.id ? undefined : chain?.blockExplorers?.default?.url

  const myTxs = useMemo(() => {
    if (!address) return []
    const a = address.toLowerCase()

    return rows
      .filter((r) => r.buyer.toLowerCase() === a)
      .map((r) => {
        const { date, time } = mounted ? formatDateTimeClient(r.timestamp) : { date: '—', time: '—' }
        return {
          txHash: r.txHash,
          txUrl: explorerBase ? `${explorerBase}/tx/${r.txHash}` : undefined,
          date,
          time,
          amountTokens: formatDecimalStr(formatUnits(r.tokensBought, tokenDecimals), 4),
          amountPaid: formatDecimalStr(formatUnits(r.amountPaid, payDecimals), 2),
          status: 'completed' as const,
        }
      })
  }, [rows, address, explorerBase, tokenDecimals, payDecimals, mounted])

  const filtered = useMemo(() => {
    if (filter === 'all') return myTxs
    return myTxs
  }, [myTxs, filter])

  const isLoading = dashLoading || logsLoading
  const readError = dashError || logsError

  return (
    <div className="space-y-6 sm:space-y-8">
      {readError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {readError.message}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-black p-5 sm:p-6">
          <div className="text-sm text-gray-400 mb-2">Transactions</div>
          <div className="text-2xl sm:text-3xl font-bold">{address ? myTxs.length : 0}</div>
          <div className="text-sm text-gray-400 mt-1">Your on-chain purchases</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-black p-5 sm:p-6">
          <div className="text-sm text-gray-400 mb-2">Payment Token</div>
          <div className="text-2xl sm:text-3xl font-bold">{paySymbol}</div>
          <div className="text-sm text-gray-400 mt-1">USDT-only presale</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-black p-5 sm:p-6">
          <div className="text-sm text-gray-400 mb-2">Token</div>
          <div className="text-2xl sm:text-3xl font-bold">{tokenSymbol}</div>
          <div className="text-sm text-gray-400 mt-1">Purchased via presale</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-black p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold">Transactions</h3>
            <p className="text-sm text-gray-400 mt-1">
              {address ? 'Your purchase history (from contract events)' : 'Connect wallet to see your history'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>

            <div className="flex gap-2">
              {(['all', 'completed'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={[
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    filter === id
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      : 'bg-slate-800 text-gray-400 hover:text-white',
                  ].join(' ')}
                >
                  {id === 'all' ? 'All' : 'Completed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!address && (
          <div className="p-4 rounded-xl border border-slate-800 text-sm text-gray-400">Wallet not connected.</div>
        )}

        {address && !isLoading && filtered.length === 0 && (
          <div className="p-4 rounded-xl border border-slate-800 text-sm text-gray-400">
            No transactions found in the scanned block range.
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-4 text-sm font-medium text-gray-300">Paid</th>
                <th className="text-left py-4 text-sm font-medium text-gray-300">Tokens</th>
                <th className="text-left py-4 text-sm font-medium text-gray-300">Date</th>
                <th className="text-left py-4 text-sm font-medium text-gray-300">Time</th>
                <th className="text-left py-4 text-sm font-medium text-gray-300">Status</th>
                <th className="text-left py-4 text-sm font-medium text-gray-300">Tx</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filtered.map((tx) => (
                <tr key={tx.txHash} className="hover:bg-slate-900/30 transition-colors">
                  <td className="py-4">
                    <div className="font-bold text-purple-300">
                      {tx.amountPaid} {paySymbol}
                    </div>
                  </td>

                  <td className="py-4">
                    <div className="font-bold text-cyan-300">
                      {tx.amountTokens} {tokenSymbol}
                    </div>
                  </td>

                  <td className="py-4 text-gray-300">{tx.date}</td>
                  <td className="py-4 text-gray-300">{tx.time}</td>

                  <td className="py-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle className="h-4 w-4" />
                      <span className="capitalize">{tx.status}</span>
                    </div>
                  </td>

                  <td className="py-4">
                    {tx.txUrl ? (
                      <a
                        href={tx.txUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
                      >
                        Explorer <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden space-y-4">
          {filtered.map((tx) => (
            <div key={tx.txHash} className="p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium">Token Purchase</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {tx.date} • {tx.time}
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle className="h-3 w-3" />
                  <span className="capitalize">{tx.status}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <div>
                  <div className="text-xs text-gray-400">Paid</div>
                  <div className="font-bold text-purple-300">
                    {tx.amountPaid} {paySymbol}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Tokens</div>
                  <div className="font-bold text-cyan-300">
                    {tx.amountTokens} {tokenSymbol}
                  </div>
                </div>
              </div>

              {tx.txUrl ? (
                <a
                  href={tx.txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"
                >
                  View on Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="mt-3 text-xs text-gray-500">
                  Explorer not available on this network.
                </div>
              )}
            </div>
          ))}
        </div>

        {address && isLoading && <div className="mt-4 text-sm text-gray-400">Loading transactions...</div>}
      </div>
    </div>
  )
}
