import { ClassId, Student } from '../types';
import type { RosterClass } from '../api/client';

export function buildRoster(classes: RosterClass[]): Record<ClassId, Student[]> {
  const result: Record<ClassId, Student[]> = { '501': [], '502': [], '503': [], '504': [] };
  for (const group of classes) {
    if (!Object.hasOwn(result, group.id)) continue;
    result[group.id] = group.students.map((row, rosterIndex) => ({
      studentId: row.id,
      classId: group.id,
      name: row.name.trim(),
      rosterIndex,
      rosterSource: 'roster',
      isTest: false,
    }));
  }
  return result;
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
