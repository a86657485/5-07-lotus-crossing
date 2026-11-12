/**
 * 站点进度条：把「这一关要分几步、现在走到第几步」显式画出来。
 * 学生做对一步后立即点亮一格，避免出现「以为做完了、其实还差一步」的情况。
 */
export type ProgressStep = { label: string; done: boolean };

export function StationProgress({ steps }: { steps: ProgressStep[] }) {
  const doneCount = steps.filter((item) => item.done).length;
  const next = steps.find((item) => !item.done);
  return (
    <div
      className="station-progress"
      role="status"
      aria-label={`本关进度 ${doneCount} / ${steps.length}`}
      data-progress={`${doneCount}/${steps.length}`}
    >
      <ol>
        {steps.map((item, index) => (
          <li
            key={item.label}
            className={item.done ? 'is-done' : item === next ? 'is-next' : ''}
            title={item.label}
          >
            <i aria-hidden="true">{item.done ? '✓' : index + 1}</i>
            <span>{item.label}</span>
          </li>
        ))}
      </ol>
      <b aria-hidden="true">{doneCount}/{steps.length}</b>
    </div>
  );
}
