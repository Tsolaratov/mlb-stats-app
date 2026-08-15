export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card text-ink rounded-sm border border-card-line shadow-md p-5 ${className}`}>
      {children}
    </div>
  );
}
