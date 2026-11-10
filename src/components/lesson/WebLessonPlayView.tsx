import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Flag, Footprints, MapPin, Play, Repeat2, Settings2, X } from 'lucide-react';
import type { LessonHostProps } from '../views/GodotPlayView';
import StationPanel, { type StationKind } from './StationPanel';
import { makeEventId } from '../../utils/eventId';
import './storyMap.css';

const TASKS = { s1: 's2_rewrite', s2b: 's2_vs_branch', s2c: 's2_kettle', s3: 's3_timing' };
type StoryKey = 'intro' | 's1' | 's1Success' | 's2' | 's3' | 'exam';
type StoryAfter = StationKind | 'map' | 's2Intro' | 'examOpen';
type StoryState = { kind: StoryKey; cursor: number; after: StoryAfter; replay: boolean; recordIntro?: boolean };
const stories: Record<StoryKey, { image: string; title: string; lines: Array<[string, string]> }> = {
  intro: { image: 'cg_intro_crowd.png', title: '开放日的委托', lines: [ ['旁白', '莲花山南门开放日，人特别多。'], ['阿莲', '开放日人多，需要助手。'], ['阿莲', '先穿上这件橙马甲。'], ['领队', '别让孩子们在路口空等太久。'], ['阿莲', '等到什么时候停？说不清。'], ['阿莲', '先去引导台，把队伍排稳。'] ] },
  s1: { image: 'cg_s1_queue.png', title: '行人引导台', lines: [ ['阿莲', '开放日队伍乱了，有人要乱穿。'], ['阿莲', '帮我把“一直等”画成带回箭头的图。'] ] },
  s1Success: { image: 'cg_s1_flow_ok.png', title: '引导台稳住了', lines: [ ['阿莲', '接对了，行人按序走。'], ['阿莲', '这块哨给你，引导台稳住了。'] ] },
  s2: { image: 'cg_s2_panel.png', title: '信号拆解台', lines: [ ['阿莲', '信号屏说不清“再等”停在哪。'], ['阿莲', '帮我分清再等还是选路。'] ] },
  s3: { image: 'cg_s3_booth.png', title: '路口调度台', lines: [ ['阿莲', '路口堵了，时长好像设错了。'], ['阿莲', '先运行看堵，再改时长核对。'] ] },
  exam: { image: 'cg_exam_ready.png', title: '可以去考核了', lines: [ ['阿莲', '这次模拟中，这一侧排队少了，另一侧等得更久。'], ['阿莲', '三站的记录齐了，可以去考核。'] ] },
};

function knownIntro(props: LessonHostProps) {
  return !!props.evidenceHistory?.some(e => e.taskId === 'intro' && e.correct === true) || Object.values(props.progress).some(Boolean);
}

/** Same classroom tasks and evidence protocol on ordinary LAN classroom addresses. */
export default function WebLessonPlayView(props: LessonHostProps) {
  const [station, setStation] = useState<StationKind | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<StationKind, boolean>>>({});
  const [introSeen, setIntroSeen] = useState(() => knownIntro(props));
  const [story, setStory] = useState<StoryState | null>(() => knownIntro(props) ? null : { kind: 'intro', cursor: 0, after: 'map', replay: false, recordIntro: true });
  const [freshStart, setFreshStart] = useState(false);
  const [panelRevision, setPanelRevision] = useState(0);
  const resetIds = useRef<Partial<Record<StationKind, string>>>({});
  const record = (taskId: string, eventType: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => props.onEvidence({ eventId: makeEventId('classroom'), taskId, eventType, payload, ...extra });
  const done = (id: StationKind): boolean => overrides[id] !== undefined ? overrides[id]! : !!props.progress[TASKS[id] as keyof typeof props.progress];
  const s1Done = done('s1');
  const s2Done = done('s2b') && done('s2c');
  const allDone = s1Done && s2Done && done('s3');
  const nextStation: StationKind = !s1Done ? 's1' : !done('s2b') ? 's2b' : !done('s2c') ? 's2c' : 's3';
  const nextName = !s1Done ? '行人引导台' : !s2Done ? '信号拆解台' : '路口调度台';

  function showStory(kind: StoryKey, after: StoryAfter, replay = false) {
    setStation(null);
    setStory({ kind, cursor: 0, after, replay });
  }

  function finishStory(skipped = false) {
    if (!story) return;
    const current = story;
    setStory(null);
    if (current.recordIntro) {
      record('intro', 'evidence_lock', { kind: 'intro_story', capture: 'story_view', viewedFrames: current.cursor + 1, skipped }, { correct: true, evidenceCode: 'E0' });
      setIntroSeen(true);
    }
    if (current.after === 's2Intro') { showStory('s2', 's2b'); return; }
    if (current.after === 'examOpen') { props.onExamOpen(); return; }
    if (current.after !== 'map') { setFreshStart(false); setPanelRevision(value => value + 1); setStation(current.after); }
  }

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape' && story) { event.preventDefault(); finishStory(true); } };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  });

  function openStation(id: StationKind) {
    if (!introSeen) return;
    if ((id === 's2b' || id === 's2c') && !s1Done) return;
    if (id === 's3' && (!s1Done || !s2Done)) return;
    setFreshStart(false);
    showStory(id === 's1' ? 's1' : id === 's3' ? 's3' : 's2', id);
  }

  function restartStation() {
    if (!station) return;
    const resetId = makeEventId('station-reset');
    const draftKey = `g5l7.lessonDraft.v1.${props.student.studentId}.${station}`;
    try {
      const old = JSON.parse(localStorage.getItem(draftKey) || '{}');
      localStorage.removeItem(draftKey);
      // Learning support is historical evidence, so resetting work must not erase it.
      localStorage.setItem(draftKey, JSON.stringify({ resetId, supportUsed: old?.supportUsed === true, errorCount: Number.isFinite(old?.errorCount) ? old.errorCount : 0 }));
    } catch { /* freshStart also prevents stale arrangements from being restored. */ }
    resetIds.current[station] = resetId;
    record(TASKS[station], 'station_reset', { reason: 'restart', resetId });
    setOverrides(old => ({ ...old, [station]: false }));
    setFreshStart(true);
    setPanelRevision(value => value + 1);
  }

  function completeStation(data: Parameters<React.ComponentProps<typeof StationPanel>['onComplete']>[0]) {
    if (!station) return;
    const completedStation = station;
    // Queue the authoritative completion before the story can request the exam.
    record(TASKS[completedStation], 'evidence_lock', data.payload, { correct: true, evidenceCode: data.evidenceCode, s3Detail: data.s3Detail });
    setOverrides(old => ({ ...old, [completedStation]: true }));
    setStation(null);
    if (completedStation === 's1') showStory('s1Success', 's2Intro');
    else if (completedStation === 's2b') { setFreshStart(false); setPanelRevision(value => value + 1); setStation('s2c'); }
    else if (completedStation === 's2c') showStory('s3', 's3');
    else showStory('exam', 'examOpen');
  }

  return <main className="web-lesson-host" aria-label="莲花山智慧路口">
    <header className="story-map-header"><div className="story-map-brand"><MapPin size={29}/><div><span>莲花山智慧路口</span><h1>今天，我是小交警</h1></div></div><div className="story-map-identity">{props.student.classId}班 · {props.student.name}</div><button className="story-map-replay" onClick={() => showStory('intro', 'map', true)}><Play size={18}/>剧情回放</button></header>
    <div className="story-map-main">
      <div className="story-map-world">
        <img className="story-map-background" src="/lesson/crossing.png" alt="莲花山公园旁的路口"/>
        <div className="story-map-sign">莲花山南门 · 智能交通开放日</div>
        <div className="story-map-road-label">观察 · 操作 · 验证</div>
        <button className={`map-workstation map-workstation-s1 ${nextStation === 's1' && !allDone ? 'is-next' : ''} ${s1Done ? 'is-done' : ''}`} disabled={!introSeen} onClick={() => openStation('s1')}><span className="workstation-icon"><Footprints size={28}/></span><strong>行人引导台</strong><small>{s1Done ? '已完成 · 可以回看' : '把“一直等”说清楚'}</small>{s1Done && <Check className="workstation-check" size={19}/>}</button>
        <button className={`map-workstation map-workstation-s2 ${!s2Done && s1Done ? 'is-next' : ''} ${s2Done ? 'is-done' : ''}`} disabled={!introSeen || !s1Done} onClick={() => openStation(done('s2b') && !done('s2c') ? 's2c' : 's2b')}><span className="workstation-icon"><Repeat2 size={29}/></span><strong>信号拆解台</strong><small>{s2Done ? '已完成 · 可以回看' : s1Done ? '再做一次，还是选一条路？' : '完成引导台后开放'}</small>{s2Done && <Check className="workstation-check" size={19}/>}</button>
        <button className={`map-workstation map-workstation-s3 ${s1Done && s2Done && !done('s3') ? 'is-next' : ''} ${done('s3') ? 'is-done' : ''}`} disabled={!introSeen || !s1Done || !s2Done} onClick={() => openStation('s3')}><span className="workstation-icon"><Settings2 size={29}/></span><strong>路口调度台</strong><small>{done('s3') ? '已完成 · 可以回看' : s2Done ? '调时长，再看路口变化' : '完成拆解台后开放'}</small>{done('s3') && <Check className="workstation-check" size={19}/>}</button>
      </div>
      <aside className="story-map-mission"><span className="mission-tag"><Flag size={17}/>阿莲的委托</span><h2>{allDone ? '路口的三项任务完成了' : `下一步，去${nextName}`}</h2><p>{allDone ? '带着刚才的观察，试试新的情境。' : nextStation === 's1' ? '哪些步骤需要反复做？做到什么时候才停？' : nextStation === 's2b' ? '两张图都有判断框。沿箭头看看它们有什么不同。' : nextStation === 's2c' ? '热水壶也会反复工作。去认一认它的流程。' : '先看排队，再调整信号时长，重新运行比较。'}</p><div className="mission-progress" aria-label="主线进度">{[['引导台', s1Done], ['拆解台', s2Done], ['调度台', done('s3')]].map(([label, checked]) => <span className={checked ? 'done' : ''} key={label as string}>{checked ? <Check size={16}/> : <i/>}{label}</span>)}</div><button className="mission-action" disabled={!introSeen} onClick={() => allDone ? props.onExamOpen() : openStation(nextStation)}>{allDone ? props.progress.exam ? '再次检测' : '进入当课检测' : `前往${nextName}`}<ArrowRight size={22}/></button><small>每次修改后，再运行核对。</small></aside>
    </div>
    <footer className="story-map-footer"><span>原剧情随时可以回看</span>{props.examOpen && !allDone && <button className="story-map-replay" onClick={props.onExamOpen}>继续检测</button>}<span>法宝 {props.relics.remaining}/3 · 进度自动保存</span></footer>
    {station && <StationPanel key={`${station}-${panelRevision}`} station={station} studentId={props.student.studentId} initialS3={props.s3State} initialEvidence={props.evidenceHistory} freshStart={freshStart} resetId={resetIds.current[station]} relicRemaining={props.relics.remaining} onUseRelic={props.onRelicUse} onEvidence={event => { if (event.eventType === 'current_invalidated') setOverrides(old => ({ ...old, [station]: false })); props.onEvidence(event); }} onCancel={() => setStation(null)} onRestart={restartStation} onComplete={completeStation}/>}
    {story && <div className="web-story-backdrop"><section className="web-story" role="dialog" aria-modal="true" aria-labelledby="web-story-title"><header><span id="web-story-title">{stories[story.kind].title}{story.replay ? ' · 回放' : ''}</span><button onClick={() => finishStory(true)} aria-label="关闭剧情"><X size={25}/></button></header><div className="web-story-picture"><img src={`/lesson/story/${stories[story.kind].image}`} alt={stories[story.kind].title}/></div><div className="web-story-dialogue"><span className="web-story-speaker">{stories[story.kind].lines[story.cursor][0]}</span><p>{stories[story.kind].lines[story.cursor][1]}</p><div className="web-story-controls"><span>{story.cursor + 1}/{stories[story.kind].lines.length}</span><button onClick={() => story.cursor < stories[story.kind].lines.length - 1 ? setStory({ ...story, cursor: story.cursor + 1 }) : finishStory()}>{story.cursor < stories[story.kind].lines.length - 1 ? '下句' : '好的'}<ArrowRight size={21}/></button></div></div></section></div>}
  </main>;
}

export { WebLessonPlayView };
