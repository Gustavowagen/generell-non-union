import { useEffect, useMemo, useRef, useState } from 'react'
import './StatsPage.css'
import { useClubData } from './useClubData'
import { weekTotals } from './metrics'
import type { ClockZone } from './types'
import { fmtDateRange, fmtPercent, fmtWhole } from './format'
import OverviewTab from './tabs/OverviewTab'
import PlayersTab from './tabs/PlayersTab'
import ProfileTab from './tabs/ProfileTab'
import AgentsTab from './tabs/AgentsTab'
import TournamentTab from './tabs/TournamentTab'

type Tab = 'overview' | 'players' | 'profile' | 'agents' | 'tournament'
type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'stats-theme'

/** The saved choice, or the system setting the first time */
const initialTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be blocked (private window); fall back to the system setting
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'players', label: 'Players' },
  { id: 'profile', label: 'Player profile' },
  { id: 'agents', label: 'Agents' },
  { id: 'tournament', label: 'Tournament' },
]

interface StatsPageProps {
  hidden?: boolean
}

export default function StatsPage({ hidden }: StatsPageProps) {
  const data = useClubData()
  const pageRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [tz, setTz] = useState<ClockZone>('oslo')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [theme, setTheme] = useState<Theme>(initialTheme)

  const totals = useMemo(() => weekTotals(data.members, data.sessions), [data])
  const days = useMemo(() => data.sessions.map(s => s.start.slice(0, 10)).sort(), [data])
  const topPayer = useMemo(() => [...data.members].sort((a, b) => b.fee - a.fee)[0], [data])
  const [playerId, setPlayerId] = useState(topPayer?.id ?? '')
  const [agent, setAgent] = useState('')

  // Track the browser's own full screen too, so Esc and the exit button stay in sync
  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement === pageRef.current)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  // Without the Fullscreen API (e.g. iPhone Safari) the page covers the window instead; Esc closes it
  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFullscreen])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Not saved; the switch still works for this visit
    }
  }

  const toggleFullscreen = async () => {
    const page = pageRef.current
    if (!page) return
    if (isFullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen()
      setIsFullscreen(false)
      return
    }
    try {
      await page.requestFullscreen()
    } catch {
      setIsFullscreen(true)
    }
  }

  const openPlayer = (id: string) => {
    setPlayerId(id)
    setTab('profile')
    // Show the profile from the top; in full screen the page itself scrolls
    if (isFullscreen) pageRef.current?.scrollTo({ top: 0 })
    else pageRef.current?.scrollIntoView({ block: 'start' })
  }

  const openAgent = (name: string) => {
    setAgent(name)
    setTab('agents')
  }

  return (
    <div ref={pageRef} className={`stats-page ${isFullscreen ? 'fullscreen' : ''}`} data-theme={theme} hidden={hidden}>
      <div className="stats-inner">
        <header className="stats-header">
          <div className="stats-header-text">
            <h1 className="stats-title">
              Crown Pokerklubb <span className="stats-title-dates">· {fmtDateRange(days[0], days[days.length - 1])}</span>
              <span className="stats-badge stats-badge-demo">Demo data</span>
            </h1>
            <p className="stats-takeaway">
              <strong>{fmtWhole(totals.fees)}</strong> collected in rake and fees from <strong>{totals.activePlayers}</strong> active players.
              PLO5 tables brought in <strong>{fmtPercent(totals.ploShare)}</strong> of ring rake, and the 10 biggest payers account
              for <strong>{fmtPercent(totals.top10Share)}</strong> of all fees.
            </p>
          </div>
          <div className="stats-header-controls">
            <div className="stats-segmented" role="group" aria-label="Clock">
              <button type="button" className={tz === 'oslo' ? 'active' : ''} onClick={() => setTz('oslo')}>Oslo time</button>
              <button type="button" className={tz === 'club' ? 'active' : ''} onClick={() => setTz('club')}>Export time (UTC−7)</button>
            </div>
            <button type="button" className="stats-theme-button" onClick={toggleTheme} aria-pressed={theme === 'dark'}>
              {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
            </button>
            <button type="button" className="stats-fullscreen-button" onClick={toggleFullscreen}>
              {isFullscreen ? '✕ Exit full screen' : '⛶ Full screen'}
            </button>
          </div>
        </header>

        <nav className="stats-tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'overview' && <OverviewTab data={data} tz={tz} />}
        {tab === 'players' && <PlayersTab data={data} onOpenPlayer={openPlayer} />}
        {tab === 'profile' && <ProfileTab data={data} tz={tz} playerId={playerId} onSelectPlayer={setPlayerId} onOpenAgent={openAgent} />}
        {tab === 'agents' && <AgentsTab data={data} agent={agent} onSelectAgent={setAgent} onOpenPlayer={openPlayer} />}
        {tab === 'tournament' && <TournamentTab data={data} tz={tz} onOpenPlayer={openPlayer} />}
      </div>
    </div>
  )
}
