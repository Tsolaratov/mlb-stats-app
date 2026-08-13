# MLB選手成績アプリ 設計書

- 日付: 2026-08-13
- ステータス: 承認済み

## 概要

MLB公式無料API(statsapi.mlb.com)を利用し、選手・チームの成績を検索・閲覧できるWebサービスを構築する。誰でもアクセスできる公開サービスとして提供する。NPB対応は将来拡張とし、今回のスコープには含めない。

## 用途・利用者

- 他人にも公開する一般向けサービス
- 特定の選手・チームに限定せず、MLB全選手(引退選手を含む)・全30球団を対象とする

## 中心機能(初回バージョンで必須)

1. 選手検索 + 個人成績表示(シーズン別・通算)
2. 成績ランキング/リーダーボード(打率・HR・防御率など主要指標)
3. チーム成績/順位表(リーグ・地区別)
4. 選手比較機能(複数選手の主要指標を並べて表示)

## 技術スタック

- フロントエンド/サーバー: Next.js (App Router), Vercelにデプロイ(Hobby無料プランで開始)
- データベース: Supabase (Postgres)
- データソース: MLB Stats API (statsapi.mlb.com、公式無料・APIキー不要)
- スタイリング: Tailwind CSS
- バッチ実行: Vercel Cron Jobs(Hobbyプランの上限である1日1回)

## データ更新方針

- 今シーズンの成績・チーム順位表: 1日1回、深夜にバッチ更新(Vercel Cron)。試合中のリアルタイム反映はしない
- 過去シーズン・引退選手の成績: 一度取得したら不変のデータとして扱い、初回アクセス時にオンデマンド取得してキャッシュ
- フロントエンドはSupabaseからのみ読み取り、MLB公式APIを直接叩かない(サーバー側のバッチ処理・オンデマンド取得でのみ利用)

## 選手検索の実現方式

比較検討の結果、以下の方式を採用する。

- **採用: 全選手インデックスをSupabaseに事前構築**
  MLB Stats APIから取得できる全選手(現役+引退)のリスト(id・氏名・在籍年など)を初回に一括インポートし、`players`テーブルに保存する。検索はこのテーブルへの高速なローカルクエリ(ILIKE/全文検索)で完結させ、MLB公式APIへのライブ問い合わせは行わない。新人選手は日次バッチで差分追記する。
  - 却下案: 検索のたびにMLB公式APIをライブで叩く方式(実装は簡単だが、レイテンシとレート制限リスクがある)
  - 却下案: 直近数十年のみローカルインデックス化しそれ以外はライブ検索するハイブリッド方式(全選手データ自体が軽量なため、採用案に対するメリットが薄い)

## アーキテクチャ

```
[MLB Stats API]
    │
    ├─ 日次バッチ (Vercel Cron, 1日1回)
    │     → 現役選手の今シーズン成績・チーム成績・順位表を取得
    │     → 新人選手の差分を選手インデックスに反映
    │
    ├─ オンデマンド取得 (選手詳細ページ初回表示時)
    │     → その選手の年度別成績・通算成績を取得してキャッシュ
    │
    ▼
[Supabase (Postgres)]  ← 常にここから読み取り
    │
    ▼
[Next.js (App Router) on Vercel]
   - Server ComponentsでSupabaseからデータ取得・SSR
   - 選手検索/個人成績/リーダーボード/チーム成績/選手比較の各ページ
```

## データモデル(Supabase)

```
players
  id (MLB選手ID, PK)
  full_name
  primary_position
  birth_date
  mlb_debut_date
  is_active (bool)
  last_synced_at

teams
  id (MLB球団ID, PK)
  name
  abbreviation
  league / division

season_stats
  player_id (FK → players)
  season (year)
  stat_type ('hitting' | 'pitching')
  team_id (FK → teams)
  games, avg, hr, rbi, obp, slg, era, so, ...
  PK: (player_id, season, stat_type, team_id)

career_stats
  player_id (FK → players)
  stat_type ('hitting' | 'pitching')
  通算成績カラム(season_statsと同系統)
  PK: (player_id, stat_type)

team_standings
  team_id (FK → teams)
  season (year)
  wins, losses, win_pct, division_rank, games_back
  updated_at
  PK: (team_id, season)
```

キャッシュ方針:
- `players`: 日次バッチで新人差分を追記。全選手(引退含む)を初回に一括インポート
- `season_stats` / `career_stats`: 今シーズン分は日次バッチで洗い替え。過去シーズン分・引退選手の通算成績は初回アクセス時に取得して以後は更新しない
- `team_standings`: 日次バッチで洗い替え
- リーダーボードは専用テーブルを持たず、`season_stats`への`ORDER BY ... LIMIT`クエリで都度算出する

## データ取得フロー

### ① 初回セットアップ(1回だけ手動実行)

- MLB Stats APIから全選手リストを取得し `players` テーブルへ一括投入
- 現役選手については当該選手の今シーズン成績も合わせて投入

### ② 日次バッチ(Vercel Cron, 毎日深夜1回)

1. 現役選手一覧を取得 → `players`の新人差分をUPSERT
2. 現役選手ぶんの今シーズン`season_stats`を取得・洗い替え
3. `team_standings`を取得・洗い替え
4. 失敗時は専用の監視・通知は設けず、Vercelのログと翌日の再実行に任せる

### ③ オンデマンド取得(選手詳細ページ初回アクセス時)

1. リクエストされた`player_id`の`season_stats`(全年度)・`career_stats`がDBに存在するか確認
2. 存在しない年度があればMLB APIから取得してUPSERT
3. 以後はDBキャッシュのみで応答(現役選手の「今シーズン」だけは日次バッチが上書きし続ける)

## エラーハンドリング

- MLB API障害時: バッチは失敗をログに記録して終了、既存DBデータはそのまま保持(古いデータで表示継続)。翌日再実行で回復
- オンデマンド取得失敗時: 該当選手ページで「成績を取得できませんでした」を表示し、ページ全体は落とさない
- 存在しない選手ID/検索結果0件: 通常の「見つかりません」UIで対応(例外扱いしない)

## フロントエンド構成

ページ構成(Next.js App Router):

- `/` — トップ(今日のリーダーボードのハイライト、球団順位表の抜粋)
- `/players?q=名前` — 選手検索結果一覧
- `/players/[id]` — 選手詳細(今シーズン成績、年度別成績テーブル、通算成績)
- `/leaders?stat=avg&season=2026` — リーダーボード(指標・シーズン切り替え)
- `/teams` — 球団順位表(リーグ/地区別)
- `/teams/[id]` — 球団詳細(所属選手一覧、成績)
- `/compare?players=id1,id2,id3` — 選手比較(最大4〜5人程度、主要指標を並べて表示)

技術要素:
- Server Componentsで直接Supabaseクエリ→SSR(クライアント側JSは最小限)
- 検索・比較選手追加などのインタラクションのみクライアントコンポーネント
- スタイリングはTailwind CSS

## テスト方針

- データ取得ロジック(MLB API→Supabase整形処理)はユニットテストで検証(API応答のモックを使用)
- バッチ処理はE2E自動テストまでは設けず、初回は手動実行して結果を目視確認
- フロントは主要ページ(検索・詳細・リーダーボード・比較)の表示崩れがないことを実装後にブラウザで確認

## スコープ外(将来拡張)

- NPB対応(公式APIがないためスクレイピングが必要)
- リアルタイム成績反映
- 選手比較の高度な可視化(グラフ等)
