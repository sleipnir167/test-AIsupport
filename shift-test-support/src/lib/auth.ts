/**
 * 認証モジュール（モック版）
 * デモではユーザーIDを固定値で使用します。
 * 本番環境では NextAuth.js や Auth0 と差し替えてください。
 */
export const DEMO_USER_ID = 'demo-user-001'

export function getCurrentUserId(): string {
  return DEMO_USER_ID
}
