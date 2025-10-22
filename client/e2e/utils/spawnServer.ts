import { spawn } from 'node:child_process'

export interface SpawnedServer {
  child: ReturnType<typeof spawn>
  port: number
  kill: () => void
}

export async function spawnServer(): Promise<SpawnedServer> {
  // Spawn Rust server with port 0 (OS assigned). Requires Rust toolchain present.
  const child = spawn(process.platform === 'win32' ? 'cmd' : 'sh', [
    process.platform === 'win32' ? '/C' : '-c',
    'cargo run --quiet -p server -- 0',
  ], {
    cwd: process.cwd(),
    env: process.env,
  })

  let stdoutBuf = ''
  let port: number | null = null

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for server to bind')), 15000)
    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString()
      const m = stdoutBuf.match(/Address:\s+[^:]+:(\d+)/)
      if (m) {
        port = parseInt(m[1], 10)
        clearTimeout(timeout)
        resolve()
      }
    })
    child.on('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Server exited early with code ${code}`))
    })
    child.stderr?.on('data', () => {
      // ignore; server logs warnings here
    })
  })

  if (!port) throw new Error('Failed to parse server port from stdout')

  return {
    child,
    port,
    kill: () => {
      try { child.kill('SIGKILL') } catch {}
    }
  }
}
