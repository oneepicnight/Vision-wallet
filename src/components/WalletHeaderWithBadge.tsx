import React, { useEffect, useState } from "react";
import BelieverBadge from "./BelieverBadge";
import TipButton from "./TipButton";

type TipStatus = {
  has_tipped: boolean;
  coin?: string;
  amount?: string;
  last_tip_at?: number;
  badge_label?: string;
};

interface WalletHeaderWithBadgeProps {
  walletAddress?: string;
  className?: string;
}

const STORAGE_PREFIX = 'vision.tip.status.'

const WalletHeaderWithBadge: React.FC<WalletHeaderWithBadgeProps> = ({
  walletAddress = "0x0000000000000000000000000000000000000000",
  className = "",
}) => {
  const [tipStatus, setTipStatus] = useState<TipStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTipStatus = async () => {
    try {
      setLoading(true);
      const address = walletAddress || localStorage.getItem("walletAddress") || "0xdefault";
      const tipped = localStorage.getItem(`${STORAGE_PREFIX}${address}`) === '1';
      setTipStatus({ has_tipped: tipped });
    } catch (err) {
      console.error("Failed to load tip status", err);
      setTipStatus({ has_tipped: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTipStatus();
  }, [walletAddress]);

  const handleTipped = () => {
    const address = walletAddress || localStorage.getItem("walletAddress") || "0xdefault";
    localStorage.setItem(`${STORAGE_PREFIX}${address}`, '1');
    setTipStatus({ has_tipped: true });
    setTimeout(() => loadTipStatus(), 500);
  };

  const hasTipped = tipStatus?.has_tipped === true;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Your Wallet
          </div>
          <div className="text-sm font-mono text-slate-100 break-all">
            {walletAddress}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <div className="text-xs text-slate-400 animate-pulse">
              Loading status...
            </div>
          )}
          {!loading && hasTipped && <BelieverBadge />}
        </div>
      </div>

      <TipButton onTipped={handleTipped} />
    </div>
  );
};

export default WalletHeaderWithBadge;
