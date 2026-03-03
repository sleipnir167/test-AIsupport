/**
 * execution-db.ts
 *
 * テスト実行セッションの永続化（Upstash Redis）
 * 既存 lib/db.ts と同一パターンで実装
 */

import { Redis } from '@upstash/redis'
import type { ExecutionSession, TestExecutionResult } from './test-executor'

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

const SESSION_TTL = 60 * 60 * 24 * 7 // 7日間

// ─── セッション CRUD ───────────────────────────────────────────
export async function saveExecutionSession(session: ExecutionSession): Promise<void> {
  const redis = getRedis()
  await redis.setex(`exec:session:${session.sessionId}`, SESSION_TTL, JSON.stringify(session))
  await redis.sadd(`exec:project:${session.projectId}`, session.sessionId)
  // TTLをプロジェクトインデックスにも設定
  await redis.expire(`exec:project:${session.projectId}`, SESSION_TTL)
}

export async function getExecutionSession(sessionId: string): Promise<ExecutionSession | null> {
  const redis = getRedis()
  const raw = await redis.get<string>(`exec:session:${sessionId}`)
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

export async function updateExecutionSession(session: ExecutionSession): Promise<void> {
  const redis = getRedis()
  await redis.setex(`exec:session:${session.sessionId}`, SESSION_TTL, JSON.stringify(session))
}

export async function getProjectExecutionSessions(projectId: string): Promise<ExecutionSession[]> {
  const redis = getRedis()
  const ids = await redis.smembers(`exec:project:${projectId}`)
  if (!ids.length) return []
  const sessions: ExecutionSession[] = []
  for (const id of ids) {
    const s = await getExecutionSession(id as string)
    if (s) sessions.push(s)
  }
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

// ─── 実行結果の個別保存 ────────────────────────────────────────
export async function saveExecutionResult(
  sessionId: string,
  result: TestExecutionResult
): Promise<void> {
  const redis = getRedis()
  await redis.setex(
    `exec:result:${sessionId}:${result.testId}`,
    SESSION_TTL,
    JSON.stringify(result)
  )
  await redis.rpush(`exec:results:${sessionId}`, result.testId)
  await redis.expire(`exec:results:${sessionId}`, SESSION_TTL)
}

export async function getExecutionResults(sessionId: string): Promise<TestExecutionResult[]> {
  const redis = getRedis()
  const ids = await redis.lrange(`exec:results:${sessionId}`, 0, -1)
  const results: TestExecutionResult[] = []
  for (const id of ids) {
    const raw = await redis.get<string>(`exec:result:${sessionId}:${id}`)
    if (raw) results.push(typeof raw === 'string' ? JSON.parse(raw) : raw)
  }
  return results
}

export async function deleteExecutionSession(sessionId: string, projectId: string): Promise<void> {
  const redis = getRedis()
  const ids = await redis.lrange(`exec:results:${sessionId}`, 0, -1)
  for (const id of ids) {
    await redis.del(`exec:result:${sessionId}:${id}`)
  }
  await redis.del(`exec:results:${sessionId}`)
  await redis.del(`exec:session:${sessionId}`)
  await redis.srem(`exec:project:${projectId}`, sessionId)
}
