import members from './data/members.json'
import mtt from './data/mtt.json'
import mttResults from './data/mtt_results.json'
import playerSessions from './data/player_sessions.json'
import sessions from './data/sessions.json'
import type { ClubData } from './types'

// Demo data: made-up players and numbers in the shape of a ClubGG weekly export
const DEMO_DATA: ClubData = {
  sessions,
  player_sessions: playerSessions,
  members,
  mtt,
  mtt_results: mttResults,
}

/**
 * The club data shown on the statistics page. Returns the demo week for now;
 * later this can read an uploaded export instead.
 */
export const useClubData = (): ClubData => DEMO_DATA
