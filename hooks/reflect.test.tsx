import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { isCorrection, memoryFile, slugFor } from './register'

const VOID = { value: undefined } as never
const ok = (value: unknown) => ({ value }) as never
const ROOT = 'G:\\My Drive\\Hasan\\06_Projects\\System_Optimizations'
const MEM = String.raw`C:\Users\Hasan\.claude\projects\G--My-Drive-Hasan-06-Projects-System-Optimizations\memory`

function world(on: On, files: Record<string, string> = {}) {
  const clock = mock.clock(on, { now: Date.parse('2026-10-08T12:00:00Z') })
  mock.store(on, {})
  mock.env(on, { USERPROFILE: 'C:\\Users\\Hasan' })
  const asked: string[] = []
  on('model.complete', async ($, e) => {
    asked.push(/<user_message>([\s\S]*)<\/user_message>/.exec(e.prompt)?.[1] ?? '')
    return ok({ isAnswered: true, text: JSON.stringify({ is_rule: true, rule: 'Use uv, not pip, for Python environments', scope: 'global', confidence: 0.9 }), usage: {} })
  })
  on('session.messages', async () => ok([{ role: 'assistant', text: 'I ran pip install.', toolUses: [] }]))
  on('session.root', async () => ok(ROOT))
  on('fs.exists', async ($, e) => ok(e.path in files))
  on('fs.read', async ($, e) => ok(files[e.path] ?? ''))
  on('fs.list', async () => ok([]))
  on('fs.write', async ($, e) => {
    files[e.path] = e.text
    return VOID
  })
  on('command.register', async ($, e) => ok({ command: e.name }))
  on('ui.toast', async () => VOID)
  on('ui.render', async () => ({ type: 'Box', props: {}, children: [] }) as never)
  on('session.start', async () => ({ cwd: ROOT }) as never)
  on('prompt.submit', async ($, e) => ({ text: e.text }))
  return { clock, asked, files }
}

async function say($: Engine, w: { clock: { settle: () => Promise<void> } }, text: string) {
  await $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false } as never)
  await w.clock.settle()
}

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } as never } as const

test('helpers: correction cues, slugs, memory file format', () => {
  for (const t of ["no, use uv instead", "don't use pip", 'always answer in English', 'from now on keep it short']) expect(isCorrection(t)).toBe(true)
  for (const t of ['what does this function do', 'build the export page', 'thanks']) expect(isCorrection(t)).toBe(false)
  expect(slugFor('Use uv, not pip, for Python environments')).toBe('use-uv-not-pip-for-python')
  expect(memoryFile('x', 'Rule here', '2026-10-08')).toContain('metadata:\n  type: feedback\n---\n\nRule here')
})

test('a plain request makes no model call; a correction does, and Save to memory writes the file and the index', async ($, on) => {
  const w = world(on, { [`${MEM}\\MEMORY.md`]: '- [Old](old.md) — old\n' })
  await $.session.start({ source: 'startup', cwd: ROOT, surface: 'desktop', isInteractive: true } as never)
  await say($, w, 'build the export page for the dashboard')
  expect(w.asked).toEqual([])
  await say($, w, 'no, use uv instead of pip')
  expect(w.asked).toEqual(['no, use uv instead of pip'])

  const ui = await $.ui.mount({ plugin: 'reflect-bridge', surface: 'desktop', ...BAND })
  const save = (await ui.findAll({ type: 'Button' })).find(b => b.key?.startsWith('mem:'))?.key ?? ''
  await ui.press({ key: save })
  await ui.unmount()

  const memFile = `${MEM}\\use-uv-not-pip-for-python.md`
  expect(w.files[memFile]).toContain('description: Use uv, not pip, for Python environments')
  expect(w.files[`${MEM}\\MEMORY.md`]).toContain('- [Old](old.md) — old\n- [Use uv, not pip, for Python environments](use-uv-not-pip-for-python.md)')
})

test('terminal: the band shows the same Save to memory / Claude-wide / All agents choices', async ($, on) => {
  const w = world(on)
  await $.session.start({ source: 'startup', cwd: ROOT, surface: 'terminal', isInteractive: true } as never)
  await say($, w, 'no, use uv instead of pip')
  const ui = await $.ui.mount({ plugin: 'reflect-bridge', surface: 'terminal', ...BAND })
  expect((await ui.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual(['Save to memory', 'Claude-wide', 'All agents', 'Edit', 'Skip'])
  await ui.unmount()
})
