/** One learning the check found: a rule, where it was said, and what happened to it. */
export type Learning = {
  id: string
  /** The rule, one imperative line in English. */
  rule: string
  scope: 'global' | 'project'
  /** The session root it was said in. */
  project: string
  /** How many times it was said (the check merges repeats). */
  count: number
  firstAt: number
  lastAt: number
  status: 'pending' | 'saved' | 'skipped'
  confidence: number
}

/** A rule saved in this session, with where it went. */
export type SavedRule = { rule: string; target: 'memory' | 'claude' | 'agents'; project: string }

declare module 'claude-code' {
  interface PluginState {
    'reflect-bridge': { pending: Learning[]; savedThisSession: SavedRule[] }
  }
}
