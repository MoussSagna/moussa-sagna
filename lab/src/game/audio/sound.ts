/**
 * Son du jeu : effets et musique synthétisés à la volée avec la Web Audio API (aucun fichier). Ce sont des sons
 * provisoires : chacun pourra être remplacé par un vrai fichier sans toucher aux endroits qui le déclenchent.
 *
 * Les navigateurs bloquent le son tant que le joueur n'a pas agi : le contexte audio naît au premier appui sur une
 * touche ou au premier clic. Avant, les appels ne font rien.
 */

type Bus = 'sfx' | 'music' | 'voice'

/** Volumes de départ : général, effets, musique, voix (annonces). */
const VOLUME = { master: 0.8, sfx: 0.9, music: 0.32, voice: 0.9 }

class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buses: Partial<Record<Bus, GainNode>> = {}
  private noise: AudioBuffer | null = null
  private enabled = true
  private musicTimer = 0
  private musicStep = 0
  private musicNext = 0
  private musicOn = false
  private rain: { source: AudioBufferSourceNode; gain: GainNode } | null = null
  /** Journal des sons joués, pour les vérifications automatiques (`window.__sfxLog`). */
  private log(name: string): void {
    const target = window as unknown as { __sfxLog?: string[] }
    target.__sfxLog?.push(name)
  }

  constructor() {
    if (typeof window === 'undefined') return
    const unlock = () => {
      this.ensure()
      void this.ctx?.resume()
    }
    window.addEventListener('keydown', unlock)
    window.addEventListener('pointerdown', unlock)
  }

  /** Coupe ou rétablit tout le son. */
  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? VOLUME.master : 0, this.ctx.currentTime, 0.05)
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return null
    const ctx = new Context()
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -14
    compressor.ratio.value = 4
    compressor.connect(ctx.destination)
    const master = ctx.createGain()
    master.gain.value = this.enabled ? VOLUME.master : 0
    master.connect(compressor)
    for (const bus of ['sfx', 'music', 'voice'] as Bus[]) {
      const gain = ctx.createGain()
      gain.gain.value = VOLUME[bus]
      gain.connect(master)
      this.buses[bus] = gain
    }
    // deux secondes de bruit blanc, réutilisées par tous les sons de souffle et de choc
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.ctx = ctx
    this.master = master
    this.noise = noise
    if (this.musicOn) this.startMusic()
    return ctx
  }

  /** Prêt à jouer : le contexte existe et tourne. */
  private ready(): AudioContext | null {
    const ctx = this.ctx
    return ctx && ctx.state === 'running' ? ctx : null
  }

  // ---------- briques ----------

  /** Enveloppe : monte en `attack` secondes jusqu'à `peak`, puis s'éteint en `decay` secondes. */
  private envelope(ctx: AudioContext, bus: Bus, at: number, peak: number, attack: number, decay: number): GainNode {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
    gain.connect(this.buses[bus]!)
    return gain
  }

  /** Bruit filtré : `type` du filtre, fréquence de départ et d'arrivée. */
  private noiseHit(at: number, duration: number, peak: number, type: BiquadFilterType, from: number, to: number, q = 1, attack = 0.005, bus: Bus = 'sfx'): void {
    const ctx = this.ctx!
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.Q.value = q
    filter.frequency.setValueAtTime(from, at)
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration)
    source.connect(filter)
    filter.connect(this.envelope(ctx, bus, at, peak, attack, duration))
    source.start(at, Math.random())
    source.stop(at + attack + duration + 0.05)
  }

  /** Oscillateur dont la fréquence glisse de `from` à `to`. */
  private tone(at: number, duration: number, peak: number, type: OscillatorType, from: number, to: number, attack = 0.005, bus: Bus = 'sfx'): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, at)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration)
    osc.connect(this.envelope(ctx, bus, at, peak, attack, duration))
    osc.start(at)
    osc.stop(at + attack + duration + 0.05)
  }

  // ---------- effets ----------

  /** Coup dans le vide : un souffle, plus grave et plus long pour un coup fort (`power` de 0 à 1). */
  whoosh(power = 0.5): void {
    const ctx = this.ready()
    this.log('whoosh')
    if (!ctx) return
    const t = ctx.currentTime
    const d = 0.1 + 0.12 * power
    this.noiseHit(t, d, 1.2 + 1 * power, 'bandpass', 500 + 400 * (1 - power), 2600, 1.2, 0.03)
  }

  /** Coup qui touche : un choc sourd et un claquement ; `power` de 0,3 (léger) à 2 (énorme). */
  hit(power = 0.6): void {
    const ctx = this.ready()
    this.log('hit')
    if (!ctx) return
    const t = ctx.currentTime
    const p = Math.min(2, power)
    this.tone(t, 0.12 + 0.1 * p, 0.8 + 0.3 * p, 'sine', 160 + 40 * p, 45)
    this.noiseHit(t, 0.06 + 0.06 * p, 0.9 + 0.3 * p, 'highpass', 2500, 900, 0.7)
    this.noiseHit(t, 0.1 + 0.1 * p, 0.35 * p, 'lowpass', 1800, 200, 0.8)
    // coup fort : une seconde frappe, plus grave, juste derrière
    if (p >= 1) this.tone(t + 0.02, 0.25, 0.5, 'triangle', 90, 35)
  }

  /** Coup paré : un claquement métallique et sec. */
  block(): void {
    const ctx = this.ready()
    this.log('block')
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(t, 0.09, 0.4, 'square', 1450, 1100)
    this.tone(t, 0.14, 0.4, 'triangle', 2300, 1900)
    this.noiseHit(t, 0.06, 1, 'highpass', 4000, 2500, 0.8)
  }

  /** Explosion : grondement et souffle ; `size` de 0,5 (boule de feu) à 3 (coup de marteau). */
  explosion(size = 1): void {
    const ctx = this.ready()
    this.log('explosion')
    if (!ctx) return
    const t = ctx.currentTime
    const d = 0.5 + 0.45 * size
    this.tone(t, d, 0.8, 'sine', 110, 28)
    this.noiseHit(t, d, 0.55 + 0.1 * size, 'lowpass', 3000, 90, 0.6)
    this.noiseHit(t, 0.18, 0.5, 'highpass', 3000, 1200, 0.6)
    if (size >= 2) {
      // énorme : un second grondement qui roule derrière
      this.noiseHit(t + 0.15, d * 1.3, 0.45, 'lowpass', 600, 50, 0.8, 0.1)
      this.tone(t + 0.1, d * 1.2, 0.5, 'sawtooth', 55, 25, 0.05)
    }
  }

  /** Lourde chute au sol. */
  thud(power = 1): void {
    const ctx = this.ready()
    this.log('thud')
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(t, 0.35, 1 * power, 'sine', 95, 35)
    this.noiseHit(t, 0.35, 0.9 * power, 'lowpass', 900, 120, 0.7)
  }

  /** Charge d'énergie : une note qui monte en vibrant, pendant `seconds`. */
  charge(seconds = 0.8, high = false): void {
    const ctx = this.ready()
    this.log('charge')
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(high ? 180 : 90, t)
    osc.frequency.exponentialRampToValueAtTime(high ? 900 : 480, t + seconds)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(400, t)
    filter.frequency.exponentialRampToValueAtTime(3500, t + seconds)
    const wobble = ctx.createOscillator()
    wobble.frequency.value = 14
    const depth = ctx.createGain()
    depth.gain.value = 0.25
    const gain = this.envelope(ctx, 'sfx', t, 0.3, seconds * 0.8, seconds * 0.4)
    const tremolo = ctx.createGain()
    tremolo.gain.value = 0.75
    wobble.connect(depth)
    depth.connect(tremolo.gain)
    osc.connect(filter)
    filter.connect(tremolo)
    tremolo.connect(gain)
    osc.start(t)
    wobble.start(t)
    osc.stop(t + seconds * 1.3)
    wobble.stop(t + seconds * 1.3)
    this.noiseHit(t, seconds, 0.12, 'bandpass', 600, 4000, 2, seconds * 0.6)
  }

  /** Lancer de la boule de feu : un souffle grave qui part. */
  fireball(): void {
    const ctx = this.ready()
    this.log('fireball')
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseHit(t, 0.45, 1.2, 'bandpass', 1800, 300, 1.2, 0.02)
    this.tone(t, 0.4, 0.5, 'sawtooth', 220, 70, 0.01)
  }

  /** Téléportation : un « zip » qui descend. */
  teleport(): void {
    const ctx = this.ready()
    this.log('teleport')
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(t, 0.2, 0.6, 'sine', 2200, 180)
    this.tone(t, 0.2, 0.25, 'square', 1100, 90)
    this.noiseHit(t, 0.15, 0.7, 'highpass', 6000, 1500, 0.7)
  }

  /** Dash ou bond : un court souffle. */
  dash(): void {
    const ctx = this.ready()
    this.log('dash')
    if (!ctx) return
    this.noiseHit(ctx.currentTime, 0.18, 1.4, 'bandpass', 900, 2200, 0.9, 0.02)
  }

  /** Envol à toute vitesse : un bang supersonique et un sifflement qui s'éloigne vers le haut. */
  takeoff(): void {
    const ctx = this.ready()
    this.log('takeoff')
    if (!ctx) return
    const t = ctx.currentTime
    this.explosion(1.2)
    this.tone(t, 0.6, 0.25, 'sawtooth', 300, 2400, 0.01)
    this.noiseHit(t, 0.6, 0.35, 'bandpass', 800, 7000, 2, 0.01)
  }

  /** Plan de coupe : un « shing » métallique et un coup de gong grave. */
  cutIn(): void {
    const ctx = this.ready()
    this.log('cutIn')
    if (!ctx) return
    const t = ctx.currentTime
    for (const [f, peak] of [[1760, 0.12], [2637, 0.08], [3520, 0.06], [2093, 0.07]] as [number, number][]) this.tone(t, 0.9, peak, 'sine', f, f * 0.98, 0.003)
    this.noiseHit(t, 0.25, 0.3, 'highpass', 7000, 3000, 0.6)
    this.tone(t, 1.2, 0.45, 'sine', 73, 60, 0.01)
  }

  /** Coup sourd de mise au point (combat figé). */
  focus(): void {
    const ctx = this.ready()
    this.log('focus')
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(t, 0.5, 0.5, 'sine', 140, 40)
    this.noiseHit(t, 0.35, 0.25, 'bandpass', 3000, 400, 1)
  }

  // ---------- voix des annonces ----------

  /** Annonce (« Round 1 », « Fight! », « K.O. ») : la voix de synthèse du navigateur, grave, et un coup de gong. */
  announce(text: string): void {
    const ctx = this.ready()
    this.log(`announce:${text}`)
    if (!ctx || !this.enabled) return
    const t = ctx.currentTime
    this.tone(t, 0.9, 0.35, 'sine', 98, 92, 0.005, 'voice')
    this.tone(t, 0.6, 0.12, 'triangle', 196, 190, 0.005, 'voice')
    const speech = window.speechSynthesis
    if (!speech || typeof SpeechSynthesisUtterance === 'undefined') return
    const line = new SpeechSynthesisUtterance(text)
    line.lang = 'en-US'
    line.pitch = 0.4
    line.rate = 0.85
    line.volume = VOLUME.voice
    speech.cancel()
    speech.speak(line)
  }

  // ---------- ambiance et musique ----------

  /** Pluie : un bruit doux en continu, tant que `on` est vrai. */
  setRain(on: boolean): void {
    const ctx = this.ready()
    if (!ctx) return
    if (on && !this.rain) {
      const source = ctx.createBufferSource()
      source.buffer = this.noise
      source.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 2200
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.gain.setTargetAtTime(0.06, ctx.currentTime, 1)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.buses.music!)
      source.start()
      this.rain = { source, gain }
    } else if (!on && this.rain) {
      const rain = this.rain
      rain.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
      rain.source.stop(ctx.currentTime + 2)
      this.rain = null
    }
  }

  /** Musique de combat : une boucle en mi mineur à 140 battements par minute (batterie, basse, arpège). */
  startMusic(): void {
    this.musicOn = true
    const ctx = this.ctx
    if (!ctx || this.musicTimer) return
    this.musicStep = 0
    this.musicNext = ctx.currentTime + 0.1
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50)
  }

  stopMusic(): void {
    this.musicOn = false
    window.clearInterval(this.musicTimer)
    this.musicTimer = 0
  }

  private scheduleMusic(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const sixteenth = 60 / 140 / 4
    // basse et arpège : mi, do, la, si (une mesure chacun)
    const roots = [40, 36, 33, 35]
    const arp = [0, 7, 12, 15, 12, 7, 3, 7]
    while (this.musicNext < ctx.currentTime + 0.2) {
      const t = this.musicNext
      const step = this.musicStep % 16
      const bar = Math.floor(this.musicStep / 16) % roots.length
      const root = roots[bar]
      const hz = (note: number) => 440 * 2 ** ((note - 69) / 12)
      // grosse caisse sur les temps, caisse claire sur 2 et 4, charleston sur les croches
      if (step % 4 === 0) this.tone(t, 0.18, 0.7, 'sine', 120, 42, 0.002, 'music')
      if (step === 4 || step === 12) this.noiseHit(t, 0.12, 0.35, 'bandpass', 1800, 1200, 0.8, 0.002, 'music')
      if (step % 2 === 0) this.noiseHit(t, 0.03, 0.08, 'highpass', 8000, 7000, 0.7, 0.001, 'music')
      // basse en croches
      if (step % 2 === 0) this.tone(t, sixteenth * 1.6, 0.28, 'sawtooth', hz(root), hz(root), 0.004, 'music')
      // arpège en doubles croches, une octave et demie au-dessus
      const note = root + 24 + arp[step % arp.length]
      this.tone(t, sixteenth * 0.9, 0.07, 'square', hz(note), hz(note), 0.002, 'music')
      this.musicNext += sixteenth
      this.musicStep += 1
    }
  }
}

export const sound = new Sound()
