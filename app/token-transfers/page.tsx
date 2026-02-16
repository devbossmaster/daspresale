import TransferForm from "@/components/token-transfers/TransferForm";

export default function TokenTransferPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#12082a] via-[#070a18] to-black">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Page Header */}
        <header className="mb-6 lg:mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Transfer
          </h1>
          <p className="mt-1 text-sm sm:text-base text-white/60">
            Send an ERC-20 token to another wallet address.
          </p>
        </header>

        {/* Layout */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,560px)_1fr] lg:items-start">
          {/* LEFT: Form */}
          <div className="min-w-0">
            <TransferForm />
          </div>

          {/* RIGHT: Optional panel */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                <h3 className="text-base font-semibold text-white">Checklist</h3>
                <ul className="mt-3 space-y-2 text-sm text-white/65">
                  <li>• Confirm you’re on BSC Mainnet</li>
                  <li>• Double-check the recipient address</li>
                  <li>• Keep some BNB for gas fees</li>
                  <li>• Transfers can’t be reversed</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                <h3 className="text-base font-semibold text-white">Tip</h3>
                <p className="mt-2 text-sm text-white/65">
                  Use the explorer icon in the form to verify addresses before sending.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
