import { ClassId, Student } from '../types';
import rosterJson from '../../roster/roster.json';

/** Built from roster/roster.json (xlsx 权威 212 人). */
type RosterRow = { id: string; classId: ClassId; name: string };

function buildFromJson(rows: RosterRow[]): Record<ClassId, Student[]> {
  const result: Record<ClassId, Student[]> = { '501': [], '502': [], '503': [], '504': [] };
  const indexByClass: Record<ClassId, number> = { '501': 0, '502': 0, '503': 0, '504': 0 };
  for (const row of rows) {
    const classId = row.classId as ClassId;
    if (!(classId in result)) continue;
    const rosterIndex = indexByClass[classId];
    indexByClass[classId] += 1;
    result[classId].push({
      studentId: row.id,
      classId,
      name: row.name.trim(),
      rosterIndex,
      rosterSource: 'roster',
      isTest: false,
    });
  }
  return result;
}

export const CLASS_ROSTERS: Record<ClassId, Student[]> = buildFromJson(rosterJson as RosterRow[]);

export const ALL_ROSTER_STUDENTS: Student[] = [
  ...CLASS_ROSTERS['501'],
  ...CLASS_ROSTERS['502'],
  ...CLASS_ROSTERS['503'],
  ...CLASS_ROSTERS['504'],
];

export const TOTAL_STUDENTS_COUNT = ALL_ROSTER_STUDENTS.length; // expect 212

export function findStudentByName(classId: ClassId, name: string): Student | undefined {
  const normalized = name.trim();
  return CLASS_ROSTERS[classId].find(s => s.name === normalized);
}

export function searchStudentsInClass(classId: ClassId, query: string): Student[] {
  const q = query.trim().toLowerCase();
  if (!q) return CLASS_ROSTERS[classId];
  return CLASS_ROSTERS[classId].filter(s => s.name.toLowerCase().includes(q));
}

export function createManualStudent(classId: ClassId, name: string): Student {
  const normalized = name.trim();
  return {
    studentId: `${classId}|${normalized}|manual_${Date.now()}`,
    classId,
    name: normalized,
    rosterIndex: -1,
    rosterSource: 'manual',
    isTest: false,
  };
}
