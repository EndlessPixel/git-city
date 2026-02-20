"use client";

import { useState } from "react";

interface Props {
  login: string;
  contributions: number;
  rank: number | null;
  accent: string;
  shadow: string;
}

export default function ShareButtons({
  login,
  contributions,
  rank,
  accent,
  shadow,
}: Props) {
  const [copied, setCopied] = useState(false);

  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dev/${login}`
      : `/dev/${login}`;

  const tweetText = `My building in Git City by @samuelrizzondev: ${contributions.toLocaleString()} contributions, Rank #${rank ?? "?"}. Find yours →`;

  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
      <a
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(profileUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-press px-5 py-2.5 text-[10px] text-bg"
        style={{
          backgroundColor: accent,
          boxShadow: `3px 3px 0 0 ${shadow}`,
        }}
      >
        Share on X
      </a>
      <button
        onClick={handleCopy}
        className="btn-press border-[3px] border-border px-5 py-2.5 text-[10px] text-cream transition-colors hover:border-border-light"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
