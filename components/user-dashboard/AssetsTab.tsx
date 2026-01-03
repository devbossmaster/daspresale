'use client'

import { useMemo } from 'react'
import { Wallet, TrendingUp } from 'lucide-react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { erc20Abi } from '@/lib/contracts/abi/erc20Abi'
import { useTokenIcoDashboard } from '@/lib/hooks/useTokenIcoDashboard'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const
function isZeroAddress(a?: `0x${string}`) {
  return !a || a.toLowerCase() === ZERO_ADDR
}

/** Safer formatting for decimal strings (avoids Number precision issues) */
function formatDecimalStr(v?: string, maxFrac = 4) {
  if (!v) return '—'
  const [intPartRaw, fracRaw = ''] = v.split('.')
  const intPart = (intPartRaw || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, '')
  return frac.length ? `${intPart}.${frac}` : intPart
}

export default function AssetsTab() {
  const { address } = useAccount()
  const { data: dash, isLoading: dashLoading, error: dashError } = useTokenIcoDashboard()

  const tokenAddr = dash?.tokenAddr
  const tokenSymbol = dash?.symbol ?? 'TOKEN'
  const tokenDecimals = dash?.decimals ?? 18

  const payToken = dash?.payToken
  const payDecimals = dash?.payDecimals ?? 18
  const paySymbol = dash?.paySymbol ?? 'USDT'

  const tokenBalRead = useReadContract({
    address: tokenAddr && !isZeroAddress(tokenAddr) ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddr && !isZeroAddress(tokenAddr), refetchInterval: 8_000 },
  })

  const usdtBalRead = useReadContract({
    address: payToken && !isZeroAddress(payToken) ? payToken : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!payToken && !isZeroAddress(payToken), refetchInterval: 8_000 },
  })

  const tokenBal = (tokenBalRead.data as bigint | undefined) ?? 0n
  const usdtBal = (usdtBalRead.data as bigint | undefined) ?? 0n

  const tokenBalHuman = useMemo(
    () => formatDecimalStr(formatUnits(tokenBal, tokenDecimals), 4),
    [tokenBal, tokenDecimals]
  )

  const usdtBalHuman = useMemo(
    () => formatDecimalStr(formatUnits(usdtBal, payDecimals), 4),
    [usdtBal, payDecimals]
  )

  const tokenValueUsdt = useMemo(() => {
    const price = dash?.tokenPrice ?? 0n
    if (!price || price === 0n) return 0n
    const denom = 10n ** BigInt(tokenDecimals)
    return (tokenBal * price) / denom
  }, [dash?.tokenPrice, tokenBal, tokenDecimals])

  const totalValueUsdt = useMemo(() => tokenValueUsdt + usdtBal, [tokenValueUsdt, usdtBal])

  const tokenValueHuman = useMemo(
    () => formatDecimalStr(formatUnits(tokenValueUsdt, payDecimals), 2),
    [tokenValueUsdt, payDecimals]
  )

  const totalValueHuman = useMemo(
    () => formatDecimalStr(formatUnits(totalValueUsdt, payDecimals), 2),
    [totalValueUsdt, payDecimals]
  )

  const isLoading = dashLoading || tokenBalRead.isLoading || usdtBalRead.isLoading
  const readError = dashError || tokenBalRead.error || usdtBalRead.error

  const saleTokenReady = !!tokenAddr && !isZeroAddress(tokenAddr)
  const payTokenReady = !!payToken && !isZeroAddress(payToken)

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Warnings / errors */}
      {readError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {readError.message}
        </div>
      )}

      {!saleTokenReady && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Sale token is not set on the ICO contract yet. Balances and valuation may show as zero.
        </div>
      )}

      {!payTokenReady && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Payment token address could not be read from the ICO contract. USDT balance display may be unavailable.
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="rounded-2xl border border-slate-800 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold">Portfolio Summary</h3>
            <p className="text-sm text-gray-400 mt-1">Total value of your assets</p>
          </div>
          <div className="flex items-center space-x-2 px-3 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-green-500/10">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">Live</span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl sm:text-4xl font-bold mb-2">
            {!address ? `— ${paySymbol}` : isLoading ? 'Loading...' : `${totalValueHuman} ${paySymbol}`}
          </div>
          <p className="text-gray-400">Total portfolio value (estimated in {paySymbol})</p>
        </div>
      </div>

      {/* Assets List */}
      <div className="rounded-2xl border border-slate-800 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold">Your Assets</h3>
            <p className="text-sm text-gray-400 mt-1">
              {address ? 'Connected wallet balances' : 'Connect wallet to view balances'}
            </p>
          </div>
          <Wallet className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {/* Sale token */}
          <div className="p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-slate-700 flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-400">{tokenSymbol.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-bold text-lg">{tokenSymbol}</div>
                  <div className="text-sm text-gray-400">Presale token</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold">
                  {!address ? '—' : isLoading ? '—' : tokenBalHuman}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Value: {!address ? '—' : isLoading ? '—' : `${tokenValueHuman} ${paySymbol}`}
                </div>
              </div>
            </div>
          </div>

          {/* USDT */}
          <div className="p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-600/10 border border-slate-700 flex items-center justify-center">
                  <span className="text-lg font-bold text-emerald-400">{paySymbol.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-bold text-lg">{paySymbol}</div>
                  <div className="text-sm text-gray-400">Payment token</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold">
                  {!address ? '—' : isLoading ? '—' : usdtBalHuman}
                </div>
                <div className="text-sm text-gray-400 mt-1">Wallet balance</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
