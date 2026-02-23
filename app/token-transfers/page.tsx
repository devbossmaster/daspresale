import TransferForm from "@/components/token-transfers/TransferForm";

export default function TokenTransferPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#12082a] via-[#070a18] to-black">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 space-y-6 md:space-y-8">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Transfer
          </h1>
          <p className="mt-1 text-sm sm:text-base text-white/60">
            Send an ERC-20 token to another wallet address.
          </p>
        </header>

        <div className="flex xl:flex-row gap-6 xl:items-start">
          {/* LEFT */}
            <TransferForm />
        </div>
      </div>
    </div>
  );
}
