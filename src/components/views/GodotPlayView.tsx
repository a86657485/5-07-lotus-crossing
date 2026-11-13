import React, { useEffect, useRef, useState } from 'react';
import { LearningEvidence, RelicState, S3State, StationProgress, Student } from '../../types';
import { StationPanel } from '../lesson/StationPanel';
import { makeEventId } from '../../utils/eventId';
import WebLessonPlayView from '../lesson/WebLessonPlayView';

type WebStation = 's1' | 's2b' | 's2c' | 's3';
const WEB_STATIONS: WebStation[] = ['s1', 's2b', 's2c', 's3'];
const TASK_STATIONS: Record<string, WebStation> = { s1_order: 's1', s2_rewrite: 's1', s2_vs_branch: 's2b', s2_kettle: 's2c', s3_timing: 's3' };

export type LessonHostProps = {
  student: Student;
  progress: StationProgress;
  relics: RelicState;
  s3State: S3State;
  evidenceHistory?: LearningEvidence[];
  examOpen?: boolean;
  runId?: string;
  onEvidence: (envelope: any) => void;
  onExamOpen: () => void;
  onRelicUse: () => Promise<boolean>;
  onS3Detail?: (detail: S3State) => void;
  /** 考核达标后在地图上挂一个奖励关入口 */
  rewardUnlocked?: boolean;
  onOpenReward?: () => void;
};

/**
 * 嵌入 Godot HTML5 主玩法。父页 ↔ iframe 经 postMessage；
 * iframe 内 window.G5L7Classroom 由导出页 head_include 注入。
 */
export function GodotPlayView(props: LessonHostProps) {
  return window.isSecureContext ? <GodotEmbeddedView {...props} /> : <WebLessonPlayView {...props} />;
}

function GodotEmbeddedView(props: LessonHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [station, setStation] = useState<WebStation | null>(null);
  const [freshStart, setFreshStart] = useState(false);
  const [panelRevision, setPanelRevision] = useState(0);
  const freshStations = useRef(new Set<WebStation>());
  const resetIds = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!station) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = document.querySelector('.station-panel');
      const button = panel?.querySelector<HTMLElement>('[role="dialog"] button') || panel?.querySelector<HTMLElement>('button');
      button?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [station, panelRevision]);

  const sessionPayload = () => ({
    studentId: props.student.studentId,
    classId: props.student.classId,
    displayName: props.student.name,
    runId: props.runId || props.student.studentId,
    isTest: !!props.student.isTest,
    relicRemaining: props.relics.remaining,
    stations: props.progress,
    student: props.student,
    relics: props.relics,
    s3Detail: props.s3State,
    webPanels: true,
    examOpen: !!props.examOpen,
    introSeen: !!props.evidenceHistory?.some(item => item.taskId === 'intro' && item.correct === true) || Object.values(props.progress).some(Boolean),
  });

  const postToGodot = (event: string, payload: any) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'g5l7-host', event, payload }, window.location.origin);
  };

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== iframeRef.current?.contentWindow) return;
      if (!ev.data || typeof ev.data !== 'object') return;
      if (ev.data.source !== 'g5l7-godot') return;
      const { event, payload } = ev.data as { event: string; payload: any };
      if (event === 'evidence:report' || event === 'station:complete') props.onEvidence(payload);
      if (event === 'exam:open') props.onExamOpen();
      if (event === 'relic:use') {
        void props.onRelicUse().then(
          success => postToGodot('relic:result', { success }),
          () => postToGodot('relic:result', { success: false }),
        );
      }
      if (event === 'progress:s3Detail') props.onS3Detail?.(payload);
      if (event === 'station:reset') {
        const resetStation = TASK_STATIONS[payload?.taskId];
        const resetId = makeEventId('station-reset');
        if (resetStation) {
          freshStations.current.add(resetStation);
          resetIds.current[resetStation] = resetId;
          try { localStorage.removeItem(`g5l7.lessonDraft.v1.${props.student.studentId}.${resetStation}`); } catch { /* Fresh state is also carried in the next panel open. */ }
        }
        props.onEvidence({ taskId: payload?.taskId, eventType: 'station_reset', payload: { reason: 'restart', resetId } });
      }
      if (event === 'godot:ready') postToGodot('app:session', sessionPayload());
      if (event === 'flow:open' && WEB_STATIONS.includes(payload?.panelId)) {
        setFreshStart(freshStations.current.delete(payload.panelId));
        setStation(payload.panelId);
      }
      if (event === 'flow:close') setStation(current => current === payload?.panelId ? null : current);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  });

  useEffect(() => {
    postToGodot('app:session', sessionPayload());
    postToGodot('relic:sync', { remaining: props.relics.remaining });
  }, [props.student, props.progress, props.relics, props.s3State, props.runId, props.examOpen]);

  return (
    <div className="relative w-full h-screen bg-slate-950 flex flex-col">
      <div className="absolute top-2 left-2 z-20 text-xs text-slate-200 bg-slate-800/80 px-2 py-1 rounded">
        {props.student.classId} · {props.student.name} · 莲花山小交警
      </div>
      <iframe
        ref={iframeRef}
        title="g5l7-godot"
        src="/godot/index.html"
        className="w-full flex-1 border-0 bg-black"
        allow="autoplay; gamepad; fullscreen"
        onLoad={() => postToGodot('app:session', sessionPayload())}
      />
      {props.rewardUnlocked && props.onOpenReward && !station && (
        <button
          type="button"
          onClick={props.onOpenReward}
          className="absolute right-5 bottom-32 z-30 flex items-center gap-2 rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-amber-300 to-orange-500 px-5 py-3 text-base font-extrabold text-slate-950 shadow-2xl transition hover:-translate-y-0.5 hover:shadow-amber-300/40"
        >
          <span aria-hidden="true">🎮</span> 进入奖励小游戏
        </button>
      )}
      {station && (
        <StationPanel
          key={`${station}-${panelRevision}`}
          station={station}
          freshStart={freshStart}
          resetId={resetIds.current[station]}
          studentId={props.student.studentId}
          initialS3={props.s3State}
          initialEvidence={props.evidenceHistory}
          relicRemaining={props.relics.remaining}
          onUseRelic={props.onRelicUse}
          onEvidence={props.onEvidence}
          onRestart={() => {
            const taskId = station === 's1' ? 's2_rewrite' : station === 's2b' ? 's2_vs_branch' : station === 's2c' ? 's2_kettle' : 's3_timing';
            const resetId = makeEventId('station-reset');
            resetIds.current[station] = resetId;
            try { localStorage.removeItem(`g5l7.lessonDraft.v1.${props.student.studentId}.${station}`); } catch { /* Fresh state is also provided below. */ }
            props.onEvidence({ taskId, eventType: 'station_reset', payload: { reason: 'restart', resetId } });
            postToGodot('flow:result', { panelId: station, reset: true });
            setFreshStart(true);
            setPanelRevision(value => value + 1);
          }}
          onCancel={() => {
            setStation(null);
            postToGodot('flow:result', { panelId: station, cancelled: true });
          }}
          onComplete={data => {
            setStation(null);
            postToGodot('flow:result', { panelId: station, ...data });
          }}
        />
      )}
    </div>
  );
}
