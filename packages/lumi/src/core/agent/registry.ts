import type { AgentChatSession } from './session.js'

const sessions = new WeakMap<object, Map<string, AgentChatSession>>()

/**
 * Makes a mounted session reachable from JSON actions. `owner` is the page
 * state the session writes to (its store identity) and `path` the state path
 * it projects to, which actions name as `session`.
 */
export function registerAgentSession(owner: object, path: string, session: AgentChatSession): () => void {
  let paths = sessions.get(owner)
  if (!paths) {
    paths = new Map()
    sessions.set(owner, paths)
  }
  if (paths.has(path))
    throw new Error(`[lumi] AgentChatSession statePath already has a session: ${path}`)
  paths.set(path, session)
  return () => {
    if (paths.get(path) === session)
      paths.delete(path)
  }
}

/** The agent session an `AgentSession` element mounted at a state path; throws when there is none. */
export function findAgentSession(owner: object, path: string): AgentChatSession {
  const session = sessions.get(owner)?.get(path)
  if (!session)
    throw new Error(`[lumi] No AgentChatSession is mounted at ${path}.`)
  return session
}
