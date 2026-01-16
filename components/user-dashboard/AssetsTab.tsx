'use client'

import { useMemo, useState, useEffect } from 'react'
import { Wallet, TrendingUp, RefreshCw, DollarSign, Coins, ExternalLink, AlertCircle } from 'lucide-react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { erc20Abi } from '@/lib/contracts/abi/erc20Abi'
import { useTokenIcoDashboard } from '@/lib/hooks/useTokenIcoDashboard'
import { useMounted } from '@/lib/hooks/useMounted'

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
  const mounted = useMounted()
  const { address, isConnected } = useAccount()
  
  // State for caching and refresh
  const [cachedDashboard, setCachedDashboard] = useState<any>(null)
  const [cachedTokenBalance, setCachedTokenBalance] = useState<string>('—')
  const [cachedUsdtBalance, setCachedUsdtBalance] = useState<string>('—')
  const [hasInitialData, setHasInitialData] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: dash, isLoading: dashLoading, error: dashError, refetch: refetchDashboard } = useTokenIcoDashboard()

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

  // Update cache when new data arrives
  useEffect(() => {
    if (dash && !dashLoading) {
      setCachedDashboard(dash)
      setHasInitialData(true)
    }
  }, [dash, dashLoading])

  useEffect(() => {
    if (tokenBalRead.data !== undefined && !tokenBalRead.isLoading) {
      const tokenBal = (tokenBalRead.data as bigint | undefined) ?? 0n
      const tokenBalHuman = formatDecimalStr(formatUnits(tokenBal, tokenDecimals), 4)
      setCachedTokenBalance(tokenBalHuman)
    }
  }, [tokenBalRead.data, tokenBalRead.isLoading, tokenDecimals])

  useEffect(() => {
    if (usdtBalRead.data !== undefined && !usdtBalRead.isLoading) {
      const usdtBal = (usdtBalRead.data as bigint | undefined) ?? 0n
      const usdtBalHuman = formatDecimalStr(formatUnits(usdtBal, payDecimals), 4)
      setCachedUsdtBalance(usdtBalHuman)
    }
  }, [usdtBalRead.data, usdtBalRead.isLoading, payDecimals])

  // Use cached data when loading (except first load)
  const stableDash = hasInitialData ? (dash || cachedDashboard) : dash
  const stableTokenBal = hasInitialData ? (tokenBalRead.data || 0n) : (tokenBalRead.data || 0n)
  const stableUsdtBal = hasInitialData ? (usdtBalRead.data || 0n) : (usdtBalRead.data || 0n)
  const stableTokenBalHuman = hasInitialData ? (formatDecimalStr(formatUnits(stableTokenBal, tokenDecimals), 1) || cachedTokenBalance) : '—'
  const stableUsdtBalHuman = hasInitialData ? (formatDecimalStr(formatUnits(stableUsdtBal, payDecimals), 2) || cachedUsdtBalance) : '—'

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.allSettled([
        refetchDashboard?.(),
        tokenBalRead.refetch(),
        usdtBalRead.refetch(),
      ])
    } catch (error) {
      console.error("Refresh failed:", error)
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  const tokenValueUsdt = useMemo(() => {
    const price = stableDash?.tokenPrice ?? 0n
    if (!price || price === 0n) return 0n
    const denom = 10n ** BigInt(tokenDecimals)
    return (stableTokenBal * price) / denom
  }, [stableDash?.tokenPrice, stableTokenBal, tokenDecimals])

  const totalValueUsdt = useMemo(() => tokenValueUsdt + stableUsdtBal, [tokenValueUsdt, stableUsdtBal])

  const tokenValueHuman = useMemo(
    () => formatDecimalStr(formatUnits(tokenValueUsdt, payDecimals), 2),
    [tokenValueUsdt, payDecimals]
  )

  const totalValueHuman = useMemo(
    () => formatDecimalStr(formatUnits(totalValueUsdt, payDecimals), 2),
    [totalValueUsdt, payDecimals]
  )

  // Only show loading on initial load, not on refetches
  const isInitialLoading = (dashLoading && !cachedDashboard) || 
                         (tokenBalRead.isLoading && !cachedTokenBalance) || 
                         (usdtBalRead.isLoading && !cachedUsdtBalance)
  
  const readError = dashError || tokenBalRead.error || usdtBalRead.error

  const saleTokenReady = !!tokenAddr && !isZeroAddress(tokenAddr)
  const payTokenReady = !!payToken && !isZeroAddress(payToken)

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Assets</h2>
          <p className="text-sm text-gray-400 mt-1">
            {address ? 'Your token balances and portfolio value' : 'Connect wallet to view assets'}
          </p>
        </div>
        
        {!isInitialLoading && hasInitialData && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 disabled:opacity-50"
            aria-label="Refresh assets"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Warnings / errors */}
      {readError && (
        <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-red-200">Unable to load asset data</div>
              <div className="mt-1 text-sm text-red-300/80">
                {(readError as any)?.shortMessage || (readError as any)?.message || 'Please try again'}
              </div>
            </div>
          </div>
        </div>
      )}

      {!saleTokenReady && isConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-200">Sale Token Not Set</div>
              <div className="mt-1 text-sm text-amber-300/80">
                The presale contract has not been configured with a token address yet.
              </div>
            </div>
          </div>
        </div>
      )}

      {!payTokenReady && isConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-200">Payment Token Not Available</div>
              <div className="mt-1 text-sm text-amber-300/80">
                Cannot read payment token address from the ICO contract.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-white">Portfolio Summary</h3>
              <p className="text-sm text-gray-400 mt-1">Total value of your assets in {paySymbol}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-600/20 border border-emerald-500/30">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Live</span>
            </div>
          </div>

          <div className="text-center py-4">
            {!address ? (
              <div className="py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black mb-4">
                  <Wallet className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg text-gray-400">Connect wallet to view portfolio</p>
              </div>
            ) : isInitialLoading ? (
              <div className="space-y-4">
                <div className="h-12 w-48 bg-gray-800/50 rounded-lg animate-pulse mx-auto" />
                <div className="h-4 w-32 bg-gray-800/50 rounded animate-pulse mx-auto" />
              </div>
            ) : (
              <>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  {totalValueHuman} {paySymbol}
                </div>
                <p className="text-gray-400">Total portfolio value</p>
              </>
            )}
          </div>

          {/* Portfolio breakdown */}
          {address && !isInitialLoading && (
            <div className="mt-6 p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-300">{tokenValueHuman}</div>
                  <div className="text-xs text-gray-400">in {tokenSymbol}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-300">{stableUsdtBalHuman}</div>
                  <div className="text-xs text-gray-400">in {paySymbol}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assets List */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
        
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-white">Your Assets</h3>
              <p className="text-sm text-gray-400 mt-1">
                {address ? 'Connected wallet balances' : 'Connect wallet to view balances'}
              </p>
            </div>
            <Wallet className="h-5 w-5 text-gray-400" />
          </div>

          <div className="space-y-4">
            {/* Sale token */}
            <div className="group p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20 hover:border-cyan-500/30 hover:bg-gradient-to-br hover:from-gray-900/40 hover:to-black/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-cyan-400">{tokenSymbol.charAt(0)}</span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-gray-900" />
                  </div>
                  <div>
                    <div className="font-bold text-lg text-white">{tokenSymbol}</div>
                    <div className="text-sm text-gray-400">Presale Token</div>
                  </div>
                </div>

                <div className="text-right">
                  {isInitialLoading && address ? (
                    <div className="space-y-2">
                      <div className="h-6 w-32 bg-gray-800/50 rounded animate-pulse ml-auto" />
                      <div className="h-4 w-24 bg-gray-800/50 rounded animate-pulse ml-auto" />
                    </div>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-white">
                        {!address ? '—' : stableTokenBalHuman}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Value: {!address ? '—' : `${tokenValueHuman} ${paySymbol}`}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Token contract link */}
              {tokenAddr && !isZeroAddress(tokenAddr) && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <a
                    href={`https://bscscan.com/address/${tokenAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    View Token Contract <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* USDT */}
            <div className="group p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20 hover:border-emerald-500/30 hover:bg-gradient-to-br hover:from-gray-900/40 hover:to-black/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-emerald-400">{paySymbol.charAt(0)}</span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-gray-900" />
                  </div>
                  <div>
                    <div className="font-bold text-lg text-white">{paySymbol}</div>
                    <div className="text-sm text-gray-400">Payment Token</div>
                  </div>
                </div>

                <div className="text-right">
                  {isInitialLoading && address ? (
                    <div className="space-y-2">
                      <div className="h-6 w-32 bg-gray-800/50 rounded animate-pulse ml-auto" />
                      <div className="h-4 w-24 bg-gray-800/50 rounded animate-pulse ml-auto" />
                    </div>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-white">
                        {!address ? '—' : stableUsdtBalHuman}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">Wallet balance</div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Payment token contract link */}
              {payToken && !isZeroAddress(payToken) && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <a
                    href={`https://bscscan.com/address/${payToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                  >
                    View {paySymbol} Contract <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Empty state for no wallet connection */}
          {!address && (
            <div className="mt-8 p-8 text-center rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black mb-4">
                <Wallet className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-300">Wallet Not Connected</h4>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
                Connect your wallet to view your token balances and portfolio value.
                Your assets will appear here once connected.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}