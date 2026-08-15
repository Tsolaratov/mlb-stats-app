import Link from "next/link";

export default function NotFound() {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="font-display font-bold uppercase text-3xl tracking-wide">
        ページが見つかりません
      </h1>
      <p className="text-card/80">
        お探しの選手・チーム・ページは存在しないか、削除された可能性があります。
      </p>
      <Link href="/" className="text-seam hover:underline font-body">
        トップページに戻る
      </Link>
    </main>
  );
}
