"use client";

import { useMemo } from "react";

export interface FeedEvent {
  id: string;
  event_type: string;
  actor_id: number | null;
  target_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: { login: string; avatar_url: string | null } | null;
  target: { login: string; avatar_url: string | null } | null;
}

function formatEvent(e: FeedEvent): string {
  const actor = e.actor?.login ? `@${e.actor.login}` : "Someone";
  const target = e.target?.login ? `@${e.target.login}` : "";
  const meta = e.metadata ?? {};

  switch (e.event_type) {
    case "achievement_unlocked":
      if (meta.count && (meta.count as number) > 1)
        return `\u{1F3C6} ${actor} unlocked ${meta.count} achievements`;
      return `\u{1F3C6} ${actor} unlocked "${meta.achievement_name ?? "an achievement"}"`;
    case "building_claimed":
      return `\u{1F3D7} ${actor} claimed their building`;
    case "item_purchased":
      return `\u{1F6CD} ${actor} bought ${meta.item_id ?? "an item"}`;
    case "kudos_given":
      return `\u{1F44F} ${meta.giver_login ? `@${meta.giver_login}` : actor} gave kudos to ${meta.receiver_login ? `@${meta.receiver_login}` : target}`;
    case "referral":
      return `\u{1F91D} ${meta.referrer_login ? `@${meta.referrer_login}` : actor} brought ${meta.referred_login ? `@${meta.referred_login}` : target} to the city`;
    case "gift_sent":
      return `\u{1F381} ${meta.giver_login ? `@${meta.giver_login}` : actor} gifted ${meta.item_id ?? "an item"} to ${meta.receiver_login ? `@${meta.receiver_login}` : target}`;
    case "dev_joined":
      return `\u{1F3D7} ${meta.login ? `@${meta.login}` : actor} joined the city`;
    case "visit_milestone":
      return `\u{1F440} ${meta.login ? `@${meta.login}` : target}'s building got ${meta.visit_count ?? "many"} visits today`;
    case "item_equipped":
      return `\u{2694}\u{FE0F} ${meta.login ? `@${meta.login}` : actor} equipped ${meta.item_id ?? "an item"}`;
    case "rank_up":
      return `\u{1F4C8} ${meta.login ? `@${meta.login}` : actor} climbed to #${meta.new_rank ?? "?"}`;
    case "leaderboard_change":
      return `\u{1F451} ${meta.login ? `@${meta.login}` : actor} entered top ${meta.position ?? 3}!`;
    default:
      return `${actor} did something cool`;
  }
}

interface Props {
  events: FeedEvent[];
  onEventClick?: (event: FeedEvent) => void;
  onOpenPanel?: () => void;
}

export default function ActivityTicker({ events, onEventClick, onOpenPanel }: Props) {
  const tickerText = useMemo(() => {
    return events.map((e) => ({ id: e.id, text: formatEvent(e), event: e }));
  }, [events]);

  if (events.length < 3) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex h-7 items-center overflow-hidden border-t border-border/30 bg-bg/90 backdrop-blur-sm cursor-pointer"
      onClick={onOpenPanel}
    >
      <div className="ticker-scroll flex whitespace-nowrap">
        {/* Duplicate for seamless loop */}
        {[...tickerText, ...tickerText].map((item, i) => (
          <span
            key={`${item.id}-${i}`}
            className="mx-6 text-[10px] text-muted hover:text-cream transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(item.event);
            }}
          >
            {item.text}
          </span>
        ))}
        <a
          href="https://github.com/srizzon/git-city"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-6 text-[10px] text-muted hover:text-cream transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          &#11088; Star Git City on GitHub
        </a>
        <a
          href="https://github.com/sponsors/srizzon"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-6 text-[10px] text-muted hover:text-cream transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          &#x1F49C; Sponsor this project
        </a>
      </div>

      <style jsx>{`
        .ticker-scroll {
          animation: ticker 60s linear infinite;
        }
        .ticker-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export { formatEvent };
