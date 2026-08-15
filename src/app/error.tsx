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
      <h1 className="font-display font-bold uppercase text-3xl tracking-wide text-seam">
        エラーが発生しました
      </h1>
      <p className="text-card/80">
        データの取得に失敗しました。時間をおいて再度お試しください。
      </p>
      <div className="flex gap-4 items-center font-body">
        <button
          onClick={() => retry()}
          className="border border-amber text-amber rounded-sm px-3 py-1 hover:bg-amber hover:text-field-dark transition-colors"
        >
          再試行
        </button>
        <Link href="/" className="text-seam hover:underline">
          トップページに戻る
        </Link>
      </div>
    </main>
  );
}
