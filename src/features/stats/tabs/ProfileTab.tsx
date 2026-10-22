import { useMemo } from 'react'
import { playerStats, runningResult } from '../metrics'
import type { ClockZone, ClubData } from '../types'
import { fmt, fmtPercent, fmtShortTime, fmtSigned, fmtTime, fmtWhole, resultClass } from '../format'
import { Card, KpiRow, KpiTile, SortableTable } from '../components/ui'
import { DivergingBarList, LineChart } from '../components/charts'

interface ProfileTabProps {
  data: ClubData
  tz: ClockZone
  playerId: string
  onSelectPlayer: (id: string) => void
  onOpenAgent: (agent: string) => void
}

type SessionRow = ReturnType<typeof runningResult>[number]

export default function ProfileTab({ data, tz, playerId, onSelectPlayer, onOpenAgent }: ProfileTabProps) {
  const stats = useMemo(() => playerStats(data.player_sessions), [data])
  const pickable = useMemo(
    () => data.members.filter(m => m.hands > 0).sort((a, b) => a.player.localeCompare(b.player)),
    [data]
  )
  const member = data.members.find(m => m.id === playerId)
  const history = useMemo(() => runningResult(data.player_sessions, playerId), [data, playerId])

  if (!member) return <p className="stats-empty">Pick a player.</p>

  const stat = stats.get(member.id)
  const tournament = data.mtt_results.find(r => r.id === member.id)

  return (
    <div className="stats-tab">
      <div className="stats-picker-row">
        <label className="stats-picker">
          <span className="stats-muted">Player</span>
          <select className="stats-input" value={member.id} onChange={e => onSelectPlayer(e.target.value)}>
            {pickable.map(m => <option key={m.id} value={m.id}>{m.player} · {m.id}</option>)}
            {!pickable.includes(member) && <option value={member.id}>{member.player} · {member.id}</option>}
          </select>
        </label>
      </div>

      <div className="stats-entity-header">
        <h2>{member.player}</h2>
        <span className="stats-muted">{member.id}</span>
        <span className="stats-badge">{member.role}</span>
        <span className="stats-muted">
          Agent:{' '}
          <button type="button" className="stats-link" onClick={() => onOpenAgent(member.agent)}>{member.agent}</button>
        </span>
      </div>

      <KpiRow>
        <KpiTile label="Net result" value={fmtSigned(member.pnl)} valueClass={resultClass(member.pnl)} note="All games, after rake" />
        <KpiTile label="Rake & fees paid" value={fmt(member.fee)} note="Ring rake + tournament fees" />
        <KpiTile label="Hands" value={fmtWhole(member.hands)} note="Ring and tournament" />
        <KpiTile label="Ring sessions" value={fmtWhole(stat?.sessions ?? 0)} note={stat ? `${fmtPercent(stat.winShare)} ended in profit` : 'No ring games'} />
        <KpiTile label="Chip balance" value={fmt(member.chips)} note="At export" />
      </KpiRow>

      <Card title="Running result through the week" subtitle="Ring-game net added up session by session. Hover for the session.">
        <LineChart points={history.map(s => ({
          label: fmtShortTime(s.start, tz),
          value: s.running,
          detail: (
            <>
              <strong>{fmtTime(s.start, tz)}</strong>
              <span className="stats-tooltip-row">{s.stake}</span>
              <span className="stats-tooltip-row">Session: {fmtSigned(s.pnl)}</span>
              <span className="stats-tooltip-row">Running: {fmtSigned(s.running)}</span>
            </>
          ),
        }))} />
      </Card>

      <div className="stats-grid-2">
        <Card title="Result by game" subtitle="Net per game type this week.">
          <DivergingBarList rows={[
            { key: 'nlh', label: 'NLH', value: member.pnlNLH, valueLabel: fmtSigned(member.pnlNLH, true) },
            { key: 'plo5', label: 'PLO5', value: member.pnlPLO5, valueLabel: fmtSigned(member.pnlPLO5, true) },
            { key: 'mtt', label: 'Tournament', value: member.pnlMTT, valueLabel: fmtSigned(member.pnlMTT, true) },
          ]} />
        </Card>
        <Card title="How they play" subtitle="Ring-game habits worked out from every session.">
          <dl className="stats-facts">
            <div><dt>Favourite stake</dt><dd>{stat?.favStake ?? '–'}</dd></div>
            <div><dt>Average buy-in</dt><dd>{stat ? fmtWhole(stat.avgBuyin) : '–'}</dd></div>
            <div><dt>Total bought in</dt><dd>{stat ? fmt(stat.buyin) : '–'}</dd></div>
            <div><dt>Biggest win</dt><dd className="stats-positive">{stat ? fmtSigned(stat.biggestWin) : '–'}</dd></div>
            <div><dt>Biggest loss</dt><dd className="stats-negative">{stat ? fmtSigned(stat.biggestLoss) : '–'}</dd></div>
            <div><dt>Rake per 100 hands</dt><dd>{stat ? fmt(stat.rakePer100) : '–'}</dd></div>
            <div><dt>Tournament prize</dt><dd>{fmt(tournament?.prize ?? 0)}</dd></div>
            <div><dt>Tournament net</dt><dd className={resultClass(member.pnlMTT)}>{fmtSigned(member.pnlMTT)}</dd></div>
          </dl>
        </Card>
      </div>

      <Card title="Session history" subtitle="Every ring session this player sat in.">
        <SortableTable<SessionRow>
          rows={history}
          rowKey={s => String(s.session)}
          initialSort={{ key: 'session', desc: true }}
          maxHeight="28rem"
          emptyText="No ring sessions this week."
          columns={[
            { key: 'session', label: '#', value: s => s.session, numeric: true },
            { key: 'start', label: 'Opened', value: s => s.start, render: s => fmtTime(s.start, tz) },
            { key: 'stake', label: 'Stake', value: s => s.stake },
            { key: 'buyin', label: 'Buy-in', value: s => s.buyin, render: s => fmt(s.buyin), numeric: true },
            { key: 'cashout', label: 'Cashout', value: s => s.cashout, render: s => fmt(s.cashout), numeric: true },
            { key: 'hands', label: 'Hands', value: s => s.hands, numeric: true },
            { key: 'rake', label: 'Rake', value: s => s.rake, render: s => fmt(s.rake), numeric: true },
            { key: 'pnl', label: 'Net', value: s => s.pnl, render: s => <span className={resultClass(s.pnl)}>{fmtSigned(s.pnl)}</span>, numeric: true },
          ]}
        />
      </Card>
    </div>
  )
}
