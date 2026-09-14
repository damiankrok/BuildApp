/**
 * A BuildingSession holds the current model and a command history with
 * undo/redo.
 *
 * Undo is snapshot-based: `applyCommand` never mutates its input, so keeping
 * the previous model is enough and needs no inverse-command machinery. Every
 * executed command is also kept in `log`, which is the replayable record a
 * future animation or reconstruction stage can read back.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import { applyCommand, type CommandResult, type CommandSuccess } from './apply.js'
import type { BuildingCommand, ResolvedCommand } from './commands.js'

export type SessionLogEntry = {
  seq: number
  command: ResolvedCommand
  createdIds: string[]
  changedIds: string[]
  removedIds: string[]
}

export type SessionListener = (event: SessionEvent) => void
export type SessionEvent =
  | { type: 'executed'; result: CommandSuccess; entry: SessionLogEntry }
  | { type: 'rejected'; result: Exclude<CommandResult, CommandSuccess>; command: BuildingCommand }
  | { type: 'undo'; entry: SessionLogEntry }
  | { type: 'redo'; entry: SessionLogEntry }
  | { type: 'replaced' }

export class BuildingSession {
  private current: CanonicalBuildingModel
  private past: Array<{ model: CanonicalBuildingModel; entry: SessionLogEntry }> = []
  private future: Array<{ model: CanonicalBuildingModel; entry: SessionLogEntry }> = []
  private seq = 0
  private listeners = new Set<SessionListener>()
  /** Every command executed and not undone, in order. */
  readonly log: SessionLogEntry[] = []

  constructor(model: CanonicalBuildingModel) {
    this.current = model
  }

  get model(): CanonicalBuildingModel {
    return this.current
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  subscribe(fn: SessionListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(e: SessionEvent): void {
    for (const l of this.listeners) l(e)
  }

  execute(command: BuildingCommand): CommandResult {
    const result = applyCommand(this.current, command)
    if (!result.ok) {
      this.emit({ type: 'rejected', result, command })
      return result
    }
    const entry: SessionLogEntry = {
      seq: ++this.seq,
      command: result.command,
      createdIds: result.createdIds,
      changedIds: result.changedIds,
      removedIds: result.removedIds,
    }
    this.past.push({ model: this.current, entry })
    this.future = []
    this.current = result.model
    this.log.push(entry)
    this.emit({ type: 'executed', result, entry })
    return result
  }

  /** Execute several commands; stops at the first rejection. */
  executeAll(commands: readonly BuildingCommand[]): CommandResult[] {
    const out: CommandResult[] = []
    for (const c of commands) {
      const r = this.execute(c)
      out.push(r)
      if (!r.ok) break
    }
    return out
  }

  undo(): boolean {
    const prev = this.past.pop()
    if (!prev) return false
    this.future.push({ model: this.current, entry: prev.entry })
    this.current = prev.model
    this.log.pop()
    this.emit({ type: 'undo', entry: prev.entry })
    return true
  }

  redo(): boolean {
    const next = this.future.pop()
    if (!next) return false
    this.past.push({ model: this.current, entry: next.entry })
    this.current = next.model
    this.log.push(next.entry)
    this.emit({ type: 'redo', entry: next.entry })
    return true
  }

  /** Replace the model wholesale (e.g. after loading a file). Clears history. */
  replace(model: CanonicalBuildingModel): void {
    this.current = model
    this.past = []
    this.future = []
    this.log.length = 0
    this.emit({ type: 'replaced' })
  }
}
