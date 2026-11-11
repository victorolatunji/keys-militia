import { SCORING, AWARDS, LEADERBOARD } from '../data/scoring.js';

// Keeps everyone's numbers for one match: you, your Duo partner, and the
// enemies (one row per enemy type). Other systems report what happens:
//   onDamage     - from Player.takeDamage (bots and your partner too)
//   onBotDeath   - an enemy died (who gets the kill, who gets an assist)
//   onPlayerDeath, onPlayerRespawn, onPartnerDeath
//   onWordStart, onWordDone - from TypingSystem (accuracy, WPM)
// At the end, summary() gives the scoreboard and the awards, and save()
// puts your result on the local leaderboard.
export default class StatsSystem {
  constructor(scene) {
    this.scene = scene;
    this.startAt = scene.time.now;
    this.rows = new Map(); // key -> row
    this.you = this.row('you', 'You', 'you');
    this.you.typing = { started: 0, finished: 0, chars: 0, ms: 0 };
    this.you.aliveSince = this.startAt;
    this.wordAt = 0;
  }

  row(key, name, team) {
    if (!this.rows.has(key)) {
      this.rows.set(key, {
        key, name, team,
        kills: 0, deaths: 0, assists: 0,
        damageDealt: 0, damageTaken: 0,
        streak: 0, bestStreak: 0,
        longestLifeMs: 0, aliveSince: null,
        count: 0, // enemies: how many of this type took the field
        typing: null,
      });
    }
    return this.rows.get(key);
  }

  // Which row a character belongs to.
  rowOf(who) {
    if (!who) return null;
    if (who === this.scene.player) return this.you;
    if (!who.config || who.slot === 'coach') return null; // practice dummies, Training's coaches
    if (who.isPartner || who.slot === 'partner') return this.row('ally', `Ally · ${who.config.name}`, 'ally');
    return this.row(`enemy:${who.config.name}`, who.config.name, 'enemy');
  }

  get ally() {
    return this.rows.get('ally') ?? null;
  }

  // ---- Reports ----

  onDamage(victim, amount, cause) {
    if (this.scene.matchOver || amount <= 0) return;
    const now = this.scene.time.now;
    const hurt = this.rowOf(victim);
    if (hurt) hurt.damageTaken += amount;

    let by = null;
    if (cause === 'player') by = this.you;
    else if (cause === 'partner') by = this.ally;
    else if (cause === 'bot' && victim === this.scene.player) by = this.rowOf(victim.lastAttacker);
    if (by && by !== hurt) by.damageDealt += amount;

    // Who hurt this enemy lately (for assists).
    if (cause === 'player' || cause === 'partner') {
      victim.hurtBy = victim.hurtBy ?? {};
      victim.hurtBy[cause] = now;
    }
  }

  // A character came into the field (new or respawned).
  onSpawn(who) {
    who.bornAt = this.scene.time.now;
    who.streak = 0;
    const row = this.rowOf(who);
    if (row && row.team === 'enemy') row.count += 1;
  }

  // killer: 'player', 'partner' or null (the map, the void, its own blast).
  onBotDeath(bot, killer) {
    if (this.scene.matchOver) return;
    const now = this.scene.time.now;
    const row = this.rowOf(bot);
    row.deaths += 1;
    this.endLife(row, bot.bornAt, now);

    const recent = (who) => now - (bot.hurtBy?.[who] ?? -Infinity) <= SCORING.assistWindowMs;
    if (killer === 'player') this.credit(this.you);
    if (killer === 'partner' && this.ally) this.credit(this.ally);
    if (killer !== 'player' && recent('player')) this.you.assists += 1;
    if (killer !== 'partner' && recent('partner') && this.ally) this.ally.assists += 1;
    bot.hurtBy = null;
  }

  onPlayerDeath(attacker) {
    if (this.scene.matchOver) return;
    const now = this.scene.time.now;
    this.you.deaths += 1;
    this.you.streak = 0;
    this.endLife(this.you, this.you.aliveSince, now);
    this.you.aliveSince = null;
    if (attacker) {
      const row = this.rowOf(attacker);
      this.credit(row);
      attacker.streak = (attacker.streak ?? 0) + 1;
      row.bestStreak = Math.max(row.bestStreak, attacker.streak);
    }
  }

  onPlayerRespawn() {
    this.you.aliveSince = this.scene.time.now;
  }

  onPartnerDeath(bot) {
    if (this.scene.matchOver || !this.ally) return;
    this.ally.deaths += 1;
    this.ally.streak = 0;
    this.endLife(this.ally, bot.bornAt, this.scene.time.now);
  }

  // Typing: a word counts as started when you lock onto it, and finished
  // when you fire it. WPM = (letters ÷ 5) per minute spent on finished words.
  onWordStart() {
    this.you.typing.started += 1;
    this.wordAt = this.scene.time.now;
  }

  onWordDone(word) {
    const t = this.you.typing;
    t.finished += 1;
    t.chars += word.length;
    t.ms += Math.max(1, this.scene.time.now - this.wordAt);
  }

  credit(row) {
    row.kills += 1;
    if (row.team === 'enemy') return; // enemy streaks are kept per enemy (onPlayerDeath)
    row.streak += 1;
    row.bestStreak = Math.max(row.bestStreak, row.streak);
  }

  endLife(row, since, now) {
    if (since == null) return;
    row.longestLifeMs = Math.max(row.longestLifeMs, now - since);
  }

  // ---- Results ----

  // Everyone's final numbers, sorted by score, plus the awards.
  summary() {
    const now = this.scene.time.now;
    // Lives still going count too.
    this.endLife(this.you, this.you.aliveSince, now);
    for (const bot of this.scene.bots ?? []) if (bot.alive) this.endLife(this.rowOf(bot), bot.bornAt, now);
    const partner = this.scene.partner?.bot;
    if (partner?.alive && this.ally) this.endLife(this.ally, partner.bornAt, now);

    const rows = [...this.rows.values()].map((r) => {
      const t = r.typing;
      return {
        ...r,
        score: r.kills * SCORING.kill + r.assists * SCORING.assist + r.deaths * SCORING.death,
        kd: r.kills / Math.max(1, r.deaths),
        accuracy: t && t.started ? t.finished / t.started : 0,
        wpm: t && t.ms ? t.chars / 5 / (t.ms / 60000) : 0,
        typos: r.key === 'you' ? this.scene.typing?.typos ?? 0 : 0,
      };
    });
    const order = { you: 0, ally: 1, enemy: 2 };
    rows.sort((a, b) => b.score - a.score || b.kd - a.kd || order[a.team] - order[b.team]);

    const awards = [];
    for (const award of AWARDS) {
      let best = null;
      for (const r of rows) {
        if (!award.ok(r)) continue;
        if (!best || r[award.stat] > best[award.stat] || (r[award.stat] === best[award.stat] && order[r.team] < order[best.team])) best = r;
      }
      if (best) awards.push({ ...award, winner: best, text: award.show(best) });
    }
    const you = rows.find((r) => r.key === 'you');
    return { rows, awards, you, timeMs: now - this.startAt };
  }

  // ---- Local leaderboard (this browser) ----

  static load() {
    try {
      return JSON.parse(localStorage.getItem(LEADERBOARD.storageKey)) ?? {};
    } catch {
      return {};
    }
  }

  // Adds your result to the best list for this mode and map.
  // Returns { list, rank } (rank 0-based, -1 = didn't make the list).
  save(modeKey, mapKey, entry) {
    const all = StatsSystem.load();
    const key = `${modeKey}:${mapKey}`;
    const list = [...(all[key] ?? []), entry]
      .sort((a, b) => (b.waves ?? 0) - (a.waves ?? 0) || b.score - a.score || b.kd - a.kd) // wave modes: waves survived first
      .slice(0, LEADERBOARD.keep);
    all[key] = list;
    try {
      localStorage.setItem(LEADERBOARD.storageKey, JSON.stringify(all));
    } catch {
      // storage blocked (private window): the list just isn't kept
    }
    return { list, rank: list.indexOf(entry) };
  }
}
