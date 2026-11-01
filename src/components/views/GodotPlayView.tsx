import React, { useEffect, useRef } from 'react';
import { RelicState, S3State, StationProgress, Student } from '../../types';

type Props = {
  student: Student;
  progress: StationProgress;
  relics: RelicState;
  s3State: S3State;
  runId?: string;
  onEvidence: (envelope: any) => void;
  onExamOpen: () => void;
  onRelicUse: () => void;
  onS3Detail?: (detail: S3State) => void;
};

/**
 * 嵌入 Godot HTML5 主玩法。父页 ↔ iframe 经 postMessage；
 * iframe 内 window.G5L7Classroom 由导出页 head_include 注入。
 */
export function GodotPlayView(props: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  });

  const postToGodot = (event: string, payload: any) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'g5l7-host', event, payload }, '*');
  };

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== 'object') return;
      if (ev.data.source !== 'g5l7-godot') return;
      const { event, payload } = ev.data as { event: string; payload: any };
      if (event === 'evidence:report' || event === 'station:complete') props.onEvidence(payload);
      if (event === 'exam:open') props.onExamOpen();
      if (event === 'relic:use') props.onRelicUse();
      if (event === 'progress:s3Detail') props.onS3Detail?.(payload);
      if (event === 'godot:ready') postToGodot('app:session', sessionPayload());
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  });

  useEffect(() => {
    postToGodot('app:session', sessionPayload());
    postToGodot('relic:sync', { remaining: props.relics.remaining });
  }, [props.student, props.progress, props.relics, props.s3State, props.runId]);

  return (
    <div className="relative w-full h-screen bg-slate-950 flex flex-col">
      <div className="absolute top-2 left-2 z-20 text-xs text-slate-200 bg-slate-800/80 px-2 py-1 rounded">
        {props.student.classId} · {props.student.name} · Godot 主玩法
      </div>
      <iframe
        ref={iframeRef}
        title="g5l7-godot"
        src="/godot/index.html"
        className="w-full flex-1 border-0 bg-black"
        allow="autoplay; gamepad; fullscreen"
        onLoad={() => postToGodot('app:session', sessionPayload())}
      />
    </div>
  );
}
