/**
 * GET /api/admin/public-settings
 *
 * 認証不要で取得できる管理者設定（表示制御・UI文言・モデルリストなど）。
 * 機密性のない項目のみ公開する。
 */
import { NextResponse } from 'next/server'
import { getAdminSettings } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const s = await getAdminSettings()
    // 公開してよい項目だけを返す
    return NextResponse.json({
      showAiLogsTab:        s.showAiLogsTab        ?? true,
      showAdvancedParams:   s.showAdvancedParams    ?? false,
      siteTitle:            s.siteTitle             ?? 'AI テスト支援システム',
      labelGenerateButton:  s.labelGenerateButton   ?? 'AIテスト項目を生成する',
      labelReviewButton:    s.labelReviewButton     ?? 'AIレビューを実行',
      defaultPlanModelId:   s.defaultPlanModelId    ?? 'deepseek/deepseek-v3.2',
      defaultExecModelId:   s.defaultExecModelId    ?? 'deepseek/deepseek-v3.2',
      defaultReviewModelId: s.defaultReviewModelId  ?? 'google/gemini-2.5-flash',
      // ★ 追加: モデルリストとバッチサイズ初期値
      customModelList:      s.customModelList       ?? [],
      defaultBatchSize:     s.defaultBatchSize      ?? 50,
    })
  } catch {
    return NextResponse.json({
      showAiLogsTab: true,
      showAdvancedParams: false,
      siteTitle: 'AI テスト支援システム',
      labelGenerateButton: 'AIテスト項目を生成する',
      labelReviewButton: 'AIレビューを実行',
      defaultPlanModelId: 'deepseek/deepseek-v3.2',
      defaultExecModelId: 'deepseek/deepseek-v3.2',
      defaultReviewModelId: 'google/gemini-2.5-flash',
      customModelList: [],
      defaultBatchSize: 50,
    })
  }
}
