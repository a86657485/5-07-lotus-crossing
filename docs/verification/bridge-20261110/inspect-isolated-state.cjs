'use strict';
// Read-only test DB inspection. Hard-coded isolated directory; never use classroom DATA_DIR.
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const file = '/tmp/g5l7-pr8-bridge-20261110/classroom.sqlite';
if (!fs.existsSync(file)) throw new Error('Isolated test DB not started');
const db = new DatabaseSync(file, { readOnly: true });
try {
  const rows = db.prepare(`SELECT students.name, states.studentId, states.json
    FROM states JOIN students ON states.studentId = students.id
    WHERE students.name IN (?, ?)`).all('桥接Godot隔离1110', '桥接Web隔离1110');
  for (const row of rows) {
    const state = JSON.parse(row.json);
    const events = db.prepare('SELECT json FROM evidence WHERE studentId=? ORDER BY rowid').all(row.studentId).map(x => JSON.parse(x.json));
    console.log(JSON.stringify({ name: row.name, studentId: row.studentId, stations: state.stations,
      examOpen: state.examOpen, relics: state.relics, stateVersion: state.stateVersion,
      events: events.map(e => ({ eventId: e.eventId, taskId: e.taskId, eventType: e.eventType, correct: e.correct, testedConditions: e.payload?.testedConditions })) }, null, 2));
  }
  if (!rows.length) console.log('No browser test students yet (actual Godot/Web UI tests pending).');
} finally { db.close(); }
