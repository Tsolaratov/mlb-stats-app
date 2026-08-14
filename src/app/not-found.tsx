import Link from "next/link";

export default function NotFound() {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">ページが見つかりません</h1>
      <p className="text-gray-500">
        お探しの選手・チーム・ページは存在しないか、削除された可能性があります。
      </p>
      <Link href="/" className="text-blue-600 hover:underline">
        トップページに戻る
      </Link>
    </main>
  );
}
