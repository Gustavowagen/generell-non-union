import type { ClockZone, ClubData, TournamentResult } from '../types'
import { fmt, fmtSigned, fmtTime, fmtWhole, resultClass } from '../format'
import { Card, KpiRow, KpiTile, SortableTable } from '../components/ui'

interface TournamentTabProps {
  data: ClubData
  tz: ClockZone
  onOpenPlayer: (id: string) => void
}

export default function TournamentTab({ data, tz, onOpenPlayer }: TournamentTabProps) {
  if (data.mtt.length === 0) return <p className="stats-empty">No tournaments this week.</p>

  return (
    <div className="stats-tab">
      {data.mtt.map(t => (
        <div key={t.title + t.start} className="stats-tab">
          <div className="stats-entity-header">
            <h2>{t.title}</h2>
            <span className="stats-badge">{t.game}</span>
            <span className="stats-muted">{fmtTime(t.start, tz)} – {fmtTime(t.end, tz)}</span>
          </div>
          <KpiRow>
            <KpiTile label="Entries" value={fmtWhole(t.entries)} note="Including re-entries" />
            <KpiTile label="Guarantee paid" value={fmtWhole(t.prizePaid)} note={`${fmtWhole(t.gtd)} guaranteed`} />
            <KpiTile label="Overlay" value={fmtWhole(t.overlay)} note="Paid by the club on top of buy-ins" valueClass={t.overlay > 0 ? 'stats-negative' : ''} />
            <KpiTile label="Re-entry fees" value={fmtWhole(t.reentryFee)} note={`From ${fmtWhole(t.reentryBuyin)} in re-entry buy-ins`} />
          </KpiRow>
        </div>
      ))}

      <Card title="Prize list" subtitle="Every player who entered, with re-entries paid and prize won. Click a row to open the profile.">
        <SortableTable<TournamentResult>
          rows={data.mtt_results}
          rowKey={r => r.id}
          initialSort={{ key: 'prize', desc: true }}
          onRowClick={r => onOpenPlayer(r.id)}
          maxHeight="32rem"
          columns={[
            { key: 'player', label: 'Player', value: r => r.player },
            { key: 'hands', label: 'Hands', value: r => r.hands, numeric: true },
            { key: 'reentries', label: 'Re-entries paid', value: r => r.reentries, render: r => fmt(r.reentries), numeric: true },
            { key: 'prize', label: 'Prize', value: r => r.prize, render: r => fmt(r.prize), numeric: true },
            { key: 'net', label: 'Net', value: r => r.net, render: r => <span className={resultClass(r.net)}>{fmtSigned(r.net)}</span>, numeric: true },
          ]}
        />
      </Card>
    </div>
  )
}
