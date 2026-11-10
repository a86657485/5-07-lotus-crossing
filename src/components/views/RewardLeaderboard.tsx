import { TrainFront } from 'lucide-react';
import orders from '../../../train-orders.json';
import type { TeacherPayload } from '../../api/client';

type Entries = NonNullable<TeacherPayload['rewardLeaderboard']>;
type Entry = Entries[number];

function sameScore(entry: Entry, other?: Entry) {
  return other !== undefined && entry.completedOrders === other.completedOrders && entry.totalExtraLaps === other.totalExtraLaps;
}

export function RewardLeaderboard({ entries, selectedClass, pending }: {
  entries: Entries;
  selectedClass: string;
  pending: boolean;
}) {
  const rows = selectedClass === 'all' ? entries : entries.filter(entry => entry.classId === selectedClass);
  const scope = selectedClass === 'all' ? '全部班级' : `${selectedClass} 班`;
  let rank = 0;

  return <section aria-labelledby="reward-leaderboard-title" className="rounded-xl border border-slate-700 border-t-emerald-500 bg-slate-800/80 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="reward-leaderboard-title" className="flex items-center gap-2 font-semibold">
        <TrainFront size={19} aria-hidden="true" className="text-emerald-300" />
        奖励小游戏排行榜
      </h2>
      <p className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">
        {scope}{!pending && ` · ${rows.length} 人上榜`}
      </p>
    </div>
    <p id="reward-leaderboard-rules" className="mt-2 text-xs leading-relaxed text-slate-300">
      通关订单越多，排名越靠前。通关数相同，比较各订单超过最少圈数的合计，少者靠前。两项相同并列。每张订单只记最好成绩。
    </p>
    {!!rows.length && <p className="mt-2 text-xs text-slate-400 lg:hidden">左右滑动查看五张订单的成绩。</p>}
    {rows.length ? <div
      role="region"
      aria-label="订单成绩表"
      tabIndex={0}
      className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-700 focus-visible:outline-2 focus-visible:outline-sky-400"
    >
      <table aria-describedby="reward-leaderboard-rules" className="w-full min-w-[740px] text-left text-sm">
        <thead className="sticky top-0 whitespace-nowrap bg-slate-950 text-slate-200">
          <tr>
            <th scope="col" className="px-3 py-2.5">名次</th>
            <th scope="col" className="px-3">姓名</th>
            <th scope="col" className="px-3">班级</th>
            <th scope="col" className="px-3 text-center">通关订单</th>
            <th scope="col" className="px-3 text-center">合计多跑</th>
            {orders.map(({ name, water, tools }, index) => <th key={name} scope="col" className="px-3 text-center">
              <span className="block whitespace-nowrap">订单 {index + 1} · {name}</span>
              <span className="block whitespace-nowrap text-xs font-normal text-slate-400">最少 {water + tools} 圈</span>
            </th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {rows.map((entry, index) => {
            const sameAsPrevious = sameScore(entry, rows[index - 1]);
            if (!sameAsPrevious) rank = index + 1;
            const tied = sameAsPrevious || sameScore(entry, rows[index + 1]);
            return <tr key={entry.studentId} className="odd:bg-slate-900/40 hover:bg-slate-700/40">
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                <span className={rank === 1 ? 'font-bold text-emerald-300' : 'font-semibold'}>{rank}</span>
                {tied && <span className="ml-1 text-xs text-slate-400">并列</span>}
              </td>
              <th scope="row" className="whitespace-nowrap px-3 font-semibold">{entry.name}</th>
              <td className="whitespace-nowrap px-3">{entry.classId} 班</td>
              <td className="whitespace-nowrap px-3 text-center font-semibold tabular-nums">{entry.completedOrders} / {orders.length}</td>
              <td className="whitespace-nowrap px-3 text-center tabular-nums">{entry.totalExtraLaps} 圈</td>
              {orders.map(({ name }, orderIndex) => {
                const result = entry.orders.find(order => order.orderIndex === orderIndex);
                return <td key={name} className="whitespace-nowrap px-3 text-center tabular-nums">
                  {result
                    ? `${result.bestLaps} 圈`
                    : <><span aria-hidden="true" className="text-slate-500">—</span><span className="sr-only">未通关</span></>}
                </td>;
              })}
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <p className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
      {pending ? '正在加载排行榜…' : '当前范围暂无订单通关记录。完成一张订单后就会上榜。'}
    </p>}
  </section>;
}
