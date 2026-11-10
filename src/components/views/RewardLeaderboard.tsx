import { TrainFront } from 'lucide-react';
import orders from '../../../train-orders.json';
import type { TeacherPayload } from '../../api/client';
import './rewardLeaderboard.css';

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

  return <section aria-labelledby="reward-leaderboard-title" className="reward-board">
    <div className="reward-board__heading">
      <h2 id="reward-leaderboard-title">
        <span className="reward-board__icon"><TrainFront size={19} aria-hidden="true" /></span>
        奖励小游戏排行榜
      </h2>
      <p className="reward-board__scope">
        {scope}{!pending && ` · ${rows.length} 人上榜`}
      </p>
    </div>
    <p id="reward-leaderboard-rules" className="reward-board__rules">
      通关订单越多，排名越靠前。通关数相同，比较各订单超过最少圈数的合计，少者靠前。两项相同并列。每张订单只记最好成绩。
    </p>
    {!!rows.length && <p className="reward-board__scroll-hint">左右滑动查看五张订单的成绩。</p>}
    {rows.length ? <div
      role="region"
      aria-label="订单成绩表"
      tabIndex={0}
      className="reward-board__table-wrap"
    >
      <table aria-describedby="reward-leaderboard-rules">
        <thead>
          <tr>
            <th scope="col">名次</th>
            <th scope="col">姓名</th>
            <th scope="col">班级</th>
            <th scope="col">通关订单</th>
            <th scope="col">合计多跑</th>
            {orders.map(({ name, water, tools }, index) => <th key={name} scope="col">
              <span>订单 {index + 1} · {name}</span>
              <small>最少 {water + tools} 圈</small>
            </th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, index) => {
            const sameAsPrevious = sameScore(entry, rows[index - 1]);
            if (!sameAsPrevious) rank = index + 1;
            const tied = sameAsPrevious || sameScore(entry, rows[index + 1]);
            return <tr key={entry.studentId} data-rank={rank <= 3 ? rank : undefined}>
              <td>
                <span className="reward-board__rank">{rank}</span>
                {tied && <span className="reward-board__tied">并列</span>}
              </td>
              <th scope="row">{entry.name}</th>
              <td>{entry.classId} 班</td>
              <td><strong className="reward-board__completed">{entry.completedOrders} / {orders.length}</strong></td>
              <td>{entry.totalExtraLaps} 圈</td>
              {orders.map(({ name }, orderIndex) => {
                const result = entry.orders.find(order => order.orderIndex === orderIndex);
                return <td key={name}>
                  {result
                    ? `${result.bestLaps} 圈`
                    : <><span aria-hidden="true" className="reward-board__dash">—</span><span className="sr-only">未通关</span></>}
                </td>;
              })}
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <p className="reward-board__empty">
      {pending ? '正在加载排行榜…' : '当前范围暂无订单通关记录。完成一张订单后就会上榜。'}
    </p>}
  </section>;
}
