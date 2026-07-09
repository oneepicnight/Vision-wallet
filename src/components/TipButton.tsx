import React, { useEffect, useState } from "react";
import { useWalletStore } from "../state/wallet";

type TipStatus = {
  has_tipped: boolean;
  coin?: string;
  amount?: string;
  last_tip_at?: number;
  badge_label?: string;
};

interface TipButtonProps {
  onTipped?: () => void;
}

const STORAGE_PREFIX = 'vision.tip.status.'

const TipButton: React.FC<TipButtonProps> = () => {
  const { profile } = useWalletStore();
  const [status, setStatus] = useState<TipStatus | null>(null);
  const [coin, setCoin] = useState<"BTC" | "BCH" | "DOGE">("BTC");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddresses, setShowAddresses] = useState(false);

  const addresses = {
    BTC: "bc1q3swmre3zk3jepfv36mus2s05tc8vaw2gy4w9k7",
    BCH: "qe75x4s8ral8jaqgqewrg4avqll58kxgc5eal9u5t",
    DOGE: "DRsWAUD1PkU5pTCxwybngAC6tUkYfBF9Mr"
  };

  const getWalletAddress = () => profile?.address || "0xdefault";

  useEffect(() => {
    if (!profile) {
      setStatus({ has_tipped: false });
      return;
    }

    const walletAddress = getWalletAddress();
    const key = `${STORAGE_PREFIX}${walletAddress}`;
    const tipped = localStorage.getItem(key) === '1';
    setStatus({ has_tipped: tipped });
  }, [profile]);

  if (!status || status.has_tipped) {
    return null;
  }

  const handleCopyAddress = async () => {
    const address = addresses[coin];

    try {
      await navigator.clipboard.writeText(address);
      setSuccessMessage(`âœ… ${coin} address copied to clipboard!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError("Failed to copy address");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-900/20 p-4 text-sm text-yellow-100 shadow-[0_0_25px_rgba(253,224,71,0.3)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-yellow-400" />
            <span className="text-xs uppercase tracking-wide text-yellow-300 font-semibold">
              Buy the madman a drink
            </span>
          </div>
          <p className="mt-1 text-xs text-yellow-100/80 leading-relaxed">
            Toss me the equivalent of <strong>$3</strong> in your favorite coin (not LAND) for
            building this insanity. Totally optionalâ€¦ but this button will keep
            flashing at you like a bartender who just got stiffed. ðŸ’€
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <select
            value={coin}
            onChange={(e) =>
              setCoin(e.target.value as "BTC" | "BCH" | "DOGE")
            }
            className="rounded-lg border border-yellow-500/60 bg-black px-2 py-1 text-xs text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="BCH">Bitcoin Cash (BCH)</option>
            <option value="DOGE">Dogecoin (DOGE)</option>
          </select>
          <button
            onClick={() => setShowAddresses(!showAddresses)}
            className="rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all bg-yellow-500 hover:bg-yellow-400 hover:scale-105"
          >
            {showAddresses ? "Hide Address" : "Show Address"}
          </button>
        </div>
      </div>

      {showAddresses && (
        <div className="mt-3 rounded-lg border border-yellow-500/30 bg-black/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-yellow-300/60 mb-1 uppercase tracking-wide">
                {coin} Address
              </div>
              <div className="font-mono text-xs break-all text-yellow-100">
                {addresses[coin]}
              </div>
            </div>
            <button
              onClick={handleCopyAddress}
              className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 transition-all flex-shrink-0"
              title="Copy address"
            >
              <span className="text-xs">ðŸ“‹ Copy</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2">
          <p className="text-xs text-red-300">
            âŒ {error}
          </p>
        </div>
      )}
      {successMessage && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs text-emerald-300">
            âœ… {successMessage}
          </p>
          <p className="text-[10px] text-emerald-400/60 mt-1">
            This button will now disappear forever. You are officially on the "not a jerk" list.
          </p>
        </div>
      )}
    </div>
  );
};

export default TipButton;
