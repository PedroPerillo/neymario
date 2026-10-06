import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';

const key = (type, code, extra = {}) => Object.assign(new Event(type), { code, ...extra });

test('a key tap shorter than one game tick still registers for one poll', () => {
  const target = new EventTarget();
  const input = createInput(target);
  target.dispatchEvent(key('keydown', 'KeyZ'));
  target.dispatchEvent(key('keyup', 'KeyZ'));
  assert.equal(input.state().jump, true);
  assert.equal(input.state().jump, false);
});

test('releasing one of two keys bound to the same action keeps it held', () => {
  const target = new EventTarget();
  const input = createInput(target);
  target.dispatchEvent(key('keydown', 'KeyZ'));
  target.dispatchEvent(key('keydown', 'Space'));
  target.dispatchEvent(key('keyup', 'KeyZ'));
  input.state();
  assert.equal(input.state().jump, true);
  target.dispatchEvent(key('keyup', 'Space'));
  assert.equal(input.state().jump, false);
});

test('M toggles mute instead of mapping to an action', () => {
  const target = new EventTarget();
  const input = createInput(target);
  let mutes = 0;
  input.onMute(() => mutes++);
  target.dispatchEvent(key('keydown', 'KeyM'));
  assert.equal(mutes, 1);
  assert.ok(Object.values(input.state()).every((v) => v === false));
});

test('C is the spin button', () => {
  const target = new EventTarget();
  const input = createInput(target);
  target.dispatchEvent(key('keydown', 'KeyC'));
  assert.equal(input.state().spin, true);
});
