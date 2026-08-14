"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">エラーが発生しました</h1>
      <p className="text-gray-500">
        データの取得に失敗しました。時間をおいて再度お試しください。
      </p>
      <div className="flex gap-4 items-center">
        <button
          onClick={() => retry()}
          className="border px-3 py-1 text-blue-600 hover:underline"
        >
          再試行
        </button>
        <Link href="/" className="text-blue-600 hover:underline">
          トップページに戻る
        </Link>
      </div>
    </main>
  );
}
