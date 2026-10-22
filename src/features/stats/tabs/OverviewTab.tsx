import { useMemo } from 'react'
import { dailyRake, openTablesByHour, resultsByStake, weekTotals } from '../metrics'
import type { ClockZone, ClubData } from '../types'
import { fmt, fmtDay, fmtWhole } from '../format'
import { Card, KpiRow, KpiTile, SortableTable } from '../components/ui'
import { ColumnChart, Heatmap, Legend } from '../components/charts'
import { SERIES_COLORS } from '../colors'
import type { Series } from '../components/charts'

const GAME_SERIES: Series[] = [
  { key: 'NLH', label: 'NLH', color: SERIES_COLORS.nlh },
  { key: 'PLO5', label: 'PLO5', color: SERIES_COLORS.plo5 },
]
const NIGHTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// A night runs 06:00 to 06:00, so slot 0 is 06:00
const SLOT_HOURS = Array.from({ length: 24 }, (_, slot) => String((slot + 6) % 24).padStart(2, '0'))

type StakeRow = ReturnType<typeof resultsByStake>[number]

export default function OverviewTab({ data, tz }: { data: ClubData; tz: ClockZone }) {
  const totals = useMemo(() => weekTotals(data.members, data.sessions), [data])
  const stakes = useMemo(() => resultsByStake(data.sessions), [data])
  const maxStakeRake = Math.max(...stakes.map(s => s.rake), 1)

  const daily = useMemo(() => {
    const rows = dailyRake(data.sessions)
    const days = [...new Set(rows.map(r => r.day))]
    return {
      labels: days.map(fmtDay),
      values: days.map(day => GAME_SERIES.map(s => rows.find(r => r.day === day && r.game === s.key)?.rake ?? 0)),
    }
  }, [data])

  const heat = useMemo(() => {
    const values = NIGHTS.map(() => SLOT_HOURS.map(() => 0))
    for (const cell of openTablesByHour(data.sessions, tz)) values[cell.weekday][cell.slot] = cell.tableHours
    return values
  }, [data, tz])

  return (
    <div className="stats-tab">
      <KpiRow>
        <KpiTile label="Rake & fees" value={fmtWhole(totals.fees)} note="Ring rake + tournament fees" />
        <KpiTile label="Ring sessions" value={fmtWhole(totals.sessions)} note="Tables opened this week" />
        <KpiTile label="Table hours" value={fmtWhole(totals.tableHours)} note="Sum of session lengths" />
        <KpiTile label="Rake per table hour" value={fmtWhole(totals.rakePerHour)} note="Ring rake ÷ table hours" />
        <KpiTile label="Hands played" value={fmtWhole(totals.hands)} note="Ring, counted per seat" />
        <KpiTile label="Active players" value={fmtWhole(totals.activePlayers)} note={`of ${totals.members} members`} />
      </KpiRow>

      <div className="stats-grid-2">
        <Card title="Ring rake per day" subtitle="Each session counts on the day it opened. Hover a bar for the split.">
          <Legend series={GAME_SERIES} />
          <ColumnChart labels={daily.labels} series={GAME_SERIES} values={daily.values} formatValue={fmt} />
        </Card>
        <Card title="When the tables run" subtitle="Average open tables per hour, by night. Hours after midnight count as the night before.">
          <Heatmap
            rowLabels={NIGHTS}
            columnLabels={SLOT_HOURS}
            values={heat}
            formatTooltip={(row, column, value) => `${NIGHTS[row]} night, ${SLOT_HOURS[column]}:00: ${value.toFixed(1)} tables open`}
          />
          <p className="stats-footnote">Hours shown in {tz === 'oslo' ? 'Oslo time' : 'export time (UTC−7)'}.</p>
        </Card>
      </div>

      <Card title="Results by stake" subtitle="Ring games grouped by game and blinds. Rake per hour shows which tables earn the most while they run.">
        <SortableTable<StakeRow>
          rows={stakes}
          rowKey={r => r.stake}
          initialSort={{ key: 'rake', desc: true }}
          columns={[
            { key: 'stake', label: 'Stake', value: r => r.stake },
            { key: 'sessions', label: 'Sessions', value: r => r.sessions, numeric: true },
            { key: 'hours', label: 'Hours', value: r => r.hours, numeric: true },
            { key: 'avgPlayers', label: 'Avg players', value: r => r.avgPlayers, numeric: true },
            { key: 'hands', label: 'Hands', value: r => r.hands, render: r => fmtWhole(r.hands), numeric: true },
            { key: 'rakePerHour', label: 'Rake / hour', value: r => r.rakePerHour, render: r => fmtWhole(r.rakePerHour), numeric: true },
            {
              key: 'rake', label: 'Rake', value: r => r.rake, numeric: true,
              render: r => (
                <span className="stats-inline-bar">
                  <span className="stats-inline-bar-fill" style={{ width: `${(r.rake / maxStakeRake) * 100}%` }} />
                  {fmt(r.rake)}
                </span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
