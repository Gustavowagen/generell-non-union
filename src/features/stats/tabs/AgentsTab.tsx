import { useMemo } from 'react'
import { agentDaily, agentDownlines, downlineMembers } from '../metrics'
import type { AgentRow } from '../metrics'
import type { ClubData, Member } from '../types'
import { fmt, fmtDay, fmtSigned, fmtWhole, resultClass } from '../format'
import { Card, KpiRow, KpiTile, SortableTable } from '../components/ui'
import { ColumnChart } from '../components/charts'
import { SERIES_COLORS } from '../colors'

interface AgentsTabProps {
  data: ClubData
  agent: string
  onSelectAgent: (agent: string) => void
  onOpenPlayer: (id: string) => void
}

const RAKE_SERIES = [{ key: 'rake', label: 'Rake', color: SERIES_COLORS.nlh }]

export default function AgentsTab({ data, agent, onSelectAgent, onOpenPlayer }: AgentsTabProps) {
  const agents = useMemo(() => agentDownlines(data.members), [data])
  const allDays = useMemo(() => [...new Set(data.sessions.map(s => s.start.slice(0, 10)))].sort(), [data])
  const daily = useMemo(() => agentDaily(data.player_sessions, data.members), [data])

  const current = agents.find(a => a.agent === agent) ?? agents[0]
  const downline = useMemo(() => downlineMembers(data.members, current.agent), [data, current.agent])
  const dayValues = allDays.map(day => [daily.find(r => r.agent === current.agent && r.day === day)?.rake ?? 0])

  return (
    <div className="stats-tab">
      <div className="stats-picker-row">
        <label className="stats-picker">
          <span className="stats-muted">Agent</span>
          <select className="stats-input" value={current.agent} onChange={e => onSelectAgent(e.target.value)}>
            {agents.map(a => <option key={a.agent} value={a.agent}>{a.agent} · {a.role}</option>)}
          </select>
        </label>
      </div>

      <div className="stats-entity-header">
        <h2>{current.agent}</h2>
        <span className="stats-badge">{current.role}</span>
        <span className="stats-muted">
          {current.agent === 'Direct' ? 'Members without an agent' : "Downline includes the agent's own account"}
        </span>
      </div>

      <KpiRow>
        <KpiTile label="Rake & fees generated" value={fmt(current.fee)} note="By the whole downline" />
        <KpiTile label="Players' net" value={fmtSigned(current.pnl)} valueClass={resultClass(current.pnl)} note={current.pnl < 0 ? 'Downline lost to the tables' : 'Downline won from the tables'} />
        <KpiTile label="Members" value={fmtWhole(current.players)} note={`${current.active} played this week`} />
        <KpiTile label="Hands" value={fmtWhole(current.hands)} note="Ring and tournament" />
        <KpiTile label="Chips held" value={fmt(current.chips)} note="Downline balances at export" />
      </KpiRow>

      <div className="stats-grid-2">
        <Card title="Downline rake per day" subtitle="Ring rake paid by this agent's players each day.">
          <ColumnChart labels={allDays.map(fmtDay)} series={RAKE_SERIES} values={dayValues} formatValue={fmt} />
        </Card>
        <Card title="Downline players" subtitle="Click a player to open their profile.">
          <SortableTable<Member>
            rows={downline}
            rowKey={m => m.id}
            initialSort={{ key: 'fee', desc: true }}
            onRowClick={m => onOpenPlayer(m.id)}
            maxHeight="17rem"
            columns={[
              { key: 'player', label: 'Player', value: m => m.player, render: m => (m.player === current.agent ? `${m.player} (agent)` : m.player) },
              { key: 'hands', label: 'Hands', value: m => m.hands, render: m => fmtWhole(m.hands), numeric: true },
              { key: 'fee', label: 'Rake & fees', value: m => m.fee, render: m => fmt(m.fee), numeric: true },
              { key: 'pnl', label: 'Net', value: m => m.pnl, render: m => <span className={resultClass(m.pnl)}>{fmtSigned(m.pnl)}</span>, numeric: true },
              { key: 'chips', label: 'Balance', value: m => m.chips, render: m => fmt(m.chips), numeric: true },
            ]}
          />
        </Card>
      </div>

      <Card title="All agents compared" subtitle={'Every agent and super agent with their downline\'s week. "Direct" is members with no agent. Click a row to view that agent.'}>
        <SortableTable<AgentRow>
          rows={agents}
          rowKey={a => a.agent}
          initialSort={{ key: 'fee', desc: true }}
          onRowClick={a => onSelectAgent(a.agent)}
          isRowSelected={a => a.agent === current.agent}
          columns={[
            { key: 'agent', label: 'Agent', value: a => a.agent },
            { key: 'role', label: 'Role', value: a => a.role },
            { key: 'players', label: 'Members', value: a => a.players, numeric: true },
            { key: 'active', label: 'Active', value: a => a.active, numeric: true },
            { key: 'hands', label: 'Hands', value: a => a.hands, render: a => fmtWhole(a.hands), numeric: true },
            { key: 'fee', label: 'Rake & fees', value: a => a.fee, render: a => fmt(a.fee), numeric: true },
            { key: 'pnl', label: "Players' net", value: a => a.pnl, render: a => <span className={resultClass(a.pnl)}>{fmtSigned(a.pnl)}</span>, numeric: true },
          ]}
        />
      </Card>
    </div>
  )
}
