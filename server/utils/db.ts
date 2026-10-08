import type { PoolClient } from 'pg'
import pg from 'pg'

/**
 * 数据库连接池（Nitro server 侧复用）
 * 连接串来自运行时环境变量 DATABASE_URL（格式：postgresql://user:pass@host:5432/dbname）
 */
let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString)
    throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL is not configured' })

  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

export async function queryResults(cutoffTimestamp: number, lastTimestamp: number, limit: number): Promise<QueryRow[]> {
  const client: PoolClient = await getPool().connect()
  try {
    const { rows } = await client.query<QueryRow>(
      `SELECT timestamp, status, metric_version, sea_blueness, cloud_coverage, blueness_index,
              visibility_km, visibility_level, haze_score
       FROM analysis_results
       WHERE timestamp < $1 AND timestamp >= $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [lastTimestamp, cutoffTimestamp, limit],
    )
    return rows
  }
  finally {
    client.release()
  }
}

export async function deleteResultByTimestamp(timestamp: number): Promise<boolean> {
  const client: PoolClient = await getPool().connect()
  try {
    const { rowCount } = await client.query(
      'DELETE FROM analysis_results WHERE timestamp = $1',
      [timestamp],
    )
    return (rowCount ?? 0) > 0
  }
  finally {
    client.release()
  }
}

interface QueryRow {
  timestamp: number
  status: string
  metric_version: number
  sea_blueness: number | null
  cloud_coverage: number | null
  blueness_index: number | null
  // 能见度估算（公里）：云量过厚时记 0（云顶遮蔽）；NULL = 早于该功能的记录或无法估算
  visibility_km: number | null
  visibility_level: string | null
  haze_score: number | null
}
