import Link from "next/link";
import { TickerOverview } from "@/components/ticker/TickerOverview";

interface PageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default async function TickerPage({ params }: PageProps) {
  const { symbol } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
              >
                ← Back to Home
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">FINRA Analytics</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TickerOverview symbol={symbol.toUpperCase()} />
      </main>
    </div>
  );
}
