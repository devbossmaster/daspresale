// app/token-transfer/page.tsx
import TransferForm from "@/components/token-transfers/TransferForm";

export default function TokenTransferPage() {
  return (
    <div className="space-y-6 md:space-y-8 lg:space-y-10 px-4 sm:px-6 pt-4 sm:pt-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-1">
          Transfer
        </h1>
        <p className="text-sm md:text-base text-gray-400">
          Send an ERC-20 token to another wallet address.
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">

        <div className="xl:col-span-1">
          <TransferForm />
        </div>
      </div>
    </div>
  );
}
