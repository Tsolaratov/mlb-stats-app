export default function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 mr-2 shrink-0 rounded-sm bg-field-dark border border-amber text-amber font-data font-bold text-sm align-middle"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 3px rgba(0,0,0,0.5)",
      }}
    >
      {rank}
    </span>
  );
}
