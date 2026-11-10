#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按证据为「已通过引导台但服务端未解锁」的学生补记 s1_order / s2_rewrite。

判定口径（保守、可回溯）：
  1) 该生 states.stations.s2_rewrite 仍为 false；
  2) evidence 中存在 taskId=s2_rewrite、eventType=case_run、correct=true，
     且 green_at_start 与 red_then_green 两种情形都跑通过（等价于引导台过关）。

用法：
  python tools/repair-s2-unlock.py            # 只列出，不写库
  python tools/repair-s2-unlock.py --apply    # 事务内写入
"""
import sqlite3, json, sys, os, collections, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(BASE, 'runtime', 'classroom.sqlite')
APPLY = '--apply' in sys.argv
ONLY_ROSTER = '--include-manual' not in sys.argv


def stations_ok(st):
    s1 = bool(st.get('s1_order'))
    s2 = bool(st.get('s2_rewrite') and st.get('s2_vs_branch') and st.get('s2_kettle'))
    s3 = bool(st.get('s3_timing'))
    return s1, s2, s3


def main():
    con = sqlite3.connect(DB, timeout=20)
    con.execute('PRAGMA foreign_keys=ON')
    cur = con.cursor()
    students = {r[0]: {'name': r[1], 'classId': r[2], 'manual': r[3]}
                for r in cur.execute('SELECT id,classId,name,manual FROM students')}

    ev = collections.defaultdict(list)
    for sid, js in cur.execute('SELECT studentId, json FROM evidence'):
        try:
            ev[sid].append(json.loads(js))
        except Exception:
            pass

    states = {}
    for sid, js in cur.execute('SELECT studentId, json FROM states'):
        try:
            states[sid] = json.loads(js)
        except Exception:
            pass

    targets = []
    for sid, st in states.items():
        s1, s2, s3 = stations_ok(st.get('stations') or {})
        if st.get('stations', {}).get('s2_rewrite'):
            continue
        cases = set()
        for e in ev.get(sid, []):
            if e.get('taskId') != 's2_rewrite' or e.get('eventType') != 'case_run':
                continue
            if e.get('correct') is not True:
                continue
            cid = ((e.get('payload') or {}).get('case') or {}).get('caseId')
            if cid:
                cases.add(cid)
        if {'green_at_start', 'red_then_green'} <= cases:
            info = students.get(sid, {'name': '?', 'classId': '?', 'manual': 1})
            if ONLY_ROSTER and info['manual']:
                continue
            targets.append((sid, info))

    print('待补记人数：', len(targets))
    by_class = collections.defaultdict(list)
    for sid, info in targets:
        by_class[info['classId']].append(info['name'])
    for cid in sorted(by_class):
        print(f'  {cid}班（{len(by_class[cid])}人）：' + '、'.join(sorted(by_class[cid])))

    if not APPLY:
        print('\n[演练] 未写库。加 --apply 才会写入。')
        return

    if not targets:
        print('没有需要补记的学生。')
        return

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    cur.execute('BEGIN IMMEDIATE')
    try:
        for sid, info in targets:
            st = states[sid]
            st.setdefault('stations', {})
            st['stations']['s1_order'] = True
            st['stations']['s2_rewrite'] = True
            s1, s2, s3 = stations_ok(st['stations'])
            relics = st.get('relics') or {}
            used = max(0, min(3, int(relics.get('used') or 0)))
            st['relics'] = {
                'quota': 3, 'used': used, 'remaining': 3 - used,
                'unlockedRelics': {'whistle': s1, 'arrow': s2, 'knob': s3},
            }
            st['stateVersion'] = int(st.get('stateVersion') or 0) + 1
            st['repairNote'] = {'kind': 's1_completion_backfill', 'at': now_iso,
                                'reason': 'bridge_dropped_evidence_lock'}
            cur.execute('UPDATE states SET json=? WHERE studentId=?',
                        (json.dumps(st, ensure_ascii=False), sid))
        con.commit()
    except Exception:
        con.rollback()
        raise
    print(f'\n已写入 {len(targets)} 名学生的进度（事务提交）。')
    con.close()


if __name__ == '__main__':
    main()
