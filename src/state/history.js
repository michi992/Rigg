import { LIMITS } from '../config.js';

export class History {
  constructor(limit = LIMITS.undoEntries) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  record(snapshot) {
    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current) {
    if (!this.canUndo) return null;
    this.future.push(current);
    return this.past.pop();
  }
  redo(current) {
    if (!this.canRedo) return null;
    this.past.push(current);
    return this.future.pop();
  }
  clear() {
    this.past = [];
    this.future = [];
  }
}
