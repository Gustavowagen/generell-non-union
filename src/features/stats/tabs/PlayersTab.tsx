import { useMemo, useState } from 'react'
import type { ClubData, Member } from '../types'
import { fmt, fmtSigned, fmtWhole, resultClass } from '../format'
import { Card, SortableTable } from '../components/ui'
import { BarList, DivergingBarList } from '../components/charts'

interface PlayersTabProps {
  data: ClubData
  onOpenPlayer: (id: string) => void
}

export default function PlayersTab({ data, onOpenPlayer }: PlayersTabProps) {
  const [search, setSearch] = useState('')
  const [onlyPlayed, setOnlyPlayed] = useState(true)

  const topRake = useMemo(() => [...data.members].sort((a, b) => b.fee - a.fee).slice(0, 15), [data])

  const winnersAndLosers = useMemo(() => {
    const byNet = data.members.filter(m => m.pnl !== 0).sort((a, b) => b.pnl - a.pnl)
    const winners = byNet.filter(m => m.pnl > 0).slice(0, 8)
    const losers = byNet.filter(m => m.pnl < 0).slice(-8)
    return [...winners, ...losers]
  }, [data])

  const query = search.trim().toLowerCase()
  const shownMembers = data.members.filter(m =>
    (!onlyPlayed || m.hands > 0) &&
    (query === '' || m.player.toLowerCase().includes(query) || m.id.includes(query))
  )

  return (
    <div className="stats-tab">
      <div className="stats-grid-2">
        <Card title="Top rake contributors" subtitle="The 15 members who paid the most rake and fees. Click a bar to open the profile.">
          <BarList rows={topRake.map(m => ({
            key: m.id, label: m.player, value: m.fee, valueLabel: fmtWhole(m.fee), onClick: () => onOpenPlayer(m.id),
          }))} />
        </Card>
        <Card title="Biggest winners and losers" subtitle="Net result for the week across all games, after rake.">
          <DivergingBarList rows={winnersAndLosers.map(m => ({
            key: m.id, label: m.player, value: m.pnl, valueLabel: fmtSigned(m.pnl, true), onClick: () => onOpenPlayer(m.id),
          }))} />
        </Card>
      </div>

      <Card title="All members" subtitle="Week totals per member, with chip balance at export. Click a row to open the profile.">
        <div className="stats-toolbar">
          <input
            type="search"
            className="stats-input"
            placeholder="Search name or ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label className="stats-checkbox">
            <input type="checkbox" checked={onlyPlayed} onChange={e => setOnlyPlayed(e.target.checked)} />
            Only members who played
          </label>
          <span className="stats-muted">{shownMembers.length} members</span>
        </div>
        <SortableTable<Member>
          rows={shownMembers}
          rowKey={m => m.id}
          initialSort={{ key: 'fee', desc: true }}
          onRowClick={m => onOpenPlayer(m.id)}
          maxHeight="32rem"
          emptyText="No members match the search."
          columns={[
            { key: 'player', label: 'Player', value: m => m.player },
            { key: 'role', label: 'Role', value: m => m.role },
            { key: 'agent', label: 'Agent', value: m => m.agent },
            { key: 'games', label: 'Games', value: m => m.games, numeric: true },
            { key: 'hands', label: 'Hands', value: m => m.hands, render: m => fmtWhole(m.hands), numeric: true },
            { key: 'fee', label: 'Rake & fees', value: m => m.fee, render: m => fmt(m.fee), numeric: true },
            { key: 'pnl', label: 'Net', value: m => m.pnl, render: m => <span className={resultClass(m.pnl)}>{fmtSigned(m.pnl)}</span>, numeric: true },
            { key: 'chips', label: 'Balance', value: m => m.chips, render: m => fmt(m.chips), numeric: true },
          ]}
        />
      </Card>
    </div>
  )
}
