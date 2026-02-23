import PurchaseTokens from "@/components/token-sale/PurchaseTokens";
import RecentTransactions from "@/components/token-sale/RecentTransactions";

export default function TokenSalePage() {
  return (
    <div className="space-y-6 md:space-y-8 lg:space-y-10 px-4 sm:px-6 pt-4 sm:pt-6">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
          Token Sale
        </h1>
        <p className="text-sm md:text-base text-gray-400 mt-1">
          Purchase tokens with USDT during the presale phase.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="xl:flex-[1.4] xl:min-w-0">
          <PurchaseTokens />
        </div>
        <div className="xl:flex-1 xl:min-w-0">
          <RecentTransactions />
        </div>
      </div>
    </div>
  );
}
