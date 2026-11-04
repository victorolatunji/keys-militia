import Phaser from 'phaser';
import { SOUNDS, LOOPS, SOUND_SETTINGS, DEATH_CRIES, FALL_CRY, shotSoundFor } from '../data/sounds.js';
import { FAMILY_MATERIAL } from '../data/effects.js';

// Plays the sounds in data/sounds.js, made on the spot with Web Audio
// (no files). Louder near you, quieter far away, panned left/right.
// Every sound also feeds a room reverb (a short tail, so nothing just cuts
// off), and big ones (explosions, snipers) a far echo.
// Loops (jetpack, hissing clouds, fire, saw, choking) are "held": whoever
// owns one calls hold() every frame, and it fades out the frame nobody does.
// F4 turns sound on/off (remembered in this browser).
// Lives on the scene as scene.sfx (scene.sound is Phaser's own).
export default class SoundSystem {
  constructor(scene) {
    this.scene = scene;
    this.ctx = scene.sound?.context ?? null; // null: no Web Audio (sound off)
    this.lastPlayed = {};
    this.on = this.loadSetting();
    this.loops = new Map();   // id -> playing loop
    this.held = new Set();    // loop ids held this frame
    this.idSeq = 0;

    if (this.ctx) this.buildBuses();

    const kb = scene.input.keyboard;
    const toggle = (event) => {
      event.preventDefault?.();
      this.toggle();
    };
    kb.on(`keydown-${SOUND_SETTINGS.toggleKey}`, toggle);
    scene.events.once('shutdown', () => {
      kb.off(`keydown-${SOUND_SETTINGS.toggleKey}`, toggle);
      for (const id of [...this.loops.keys()]) this.stopLoop(id);
    });
  }

  // master <- dry sounds, room reverb, far echo
  buildBuses() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.on ? SOUND_SETTINGS.master : 0;
    this.master.connect(ctx.destination);
    this.noise = this.makeNoise();
    this.crackle = this.makeCrackle();

    // Reverb: a made-up "room" (decaying noise as the impulse response).
    const r = SOUND_SETTINGS.reverb;
    this.reverbIn = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeImpulse(r.seconds, r.decay);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = r.level;
    this.reverbIn.connect(convolver).connect(reverbOut).connect(this.master);

    // Echo: a dull repeat off far walls (big bangs only).
    const e = SOUND_SETTINGS.echo;
    this.echoIn = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = e.delaySec;
    const feedback = ctx.createGain();
    feedback.gain.value = e.feedback;
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = e.cutoff;
    this.echoIn.connect(delay);
    delay.connect(dull).connect(feedback).connect(delay);
    dull.connect(this.master);
  }

  // ---- Setting ----

  loadSetting() {
    try {
      return window.localStorage.getItem(SOUND_SETTINGS.storageKey) !== 'off';
    } catch {
      return true;
    }
  }

  toggle() {
    this.on = !this.on;
    try {
      window.localStorage.setItem(SOUND_SETTINGS.storageKey, this.on ? 'on' : 'off');
    } catch {
      // not saved
    }
    if (this.master) this.master.gain.value = this.on ? SOUND_SETTINGS.master : 0;
    this.scene.effects?.notice(`Sound: ${this.on ? 'On' : 'Off'}  (${SOUND_SETTINGS.toggleKey})`);
  }

  get ready() {
    return Boolean(this.ctx) && this.on && this.ctx.state === 'running';
  }

  // Volume and pan for something at `at` (null = on you).
  place(at) {
    const player = this.scene.player;
    if (!at || !player) return { volume: 1, pan: 0 };
    const dist = Phaser.Math.Distance.Between(at.x, at.y, player.x, player.y);
    const { hearingPx, minDistanceVolume } = SOUND_SETTINGS;
    return {
      volume: Phaser.Math.Clamp(1 - dist / hearingPx, minDistanceVolume, 1),
      pan: Phaser.Math.Clamp((at.x - player.x) / 700, -0.8, 0.8),
    };
  }

  // Send a finished sound's output to the speakers, the reverb and (big
  // sounds) the echo. Far sounds get more reverb, like in a real space.
  // opts.wet / opts.echo override the sound's own amounts.
  route(out, sound, volume, opts = {}) {
    out.connect(this.master);
    const wet = this.ctx.createGain();
    wet.gain.value = (opts.wet ?? sound.wet ?? SOUND_SETTINGS.reverb.send) * (1.4 - volume * 0.4);
    out.connect(wet).connect(this.reverbIn);
    let echo = null;
    const echoAmount = opts.echo ?? sound.echo;
    if (echoAmount) {
      echo = this.ctx.createGain();
      echo.gain.value = echoAmount;
      out.connect(echo).connect(this.echoIn);
    }
    return () => {
      out.disconnect();
      wet.disconnect();
      echo?.disconnect();
    };
  }

  // ---- One-shot sounds ----

  // key: a SOUNDS entry. at: where it happens ({ x, y }, default: on you).
  // opts.volume, opts.pitch: extra scaling (enemy shots use these).
  // opts.wet, opts.echo: more room / echo. opts.highpassHz: thin it out.
  play(key, at = null, opts = {}) {
    const sound = SOUNDS[key];
    if (!sound || !this.ready) return;

    const now = this.scene.time.now;
    if (sound.gapMs && now - (this.lastPlayed[key] ?? -1e9) < sound.gapMs) return;
    this.lastPlayed[key] = now;

    const place = this.place(at);
    const volume = place.volume * (opts.volume ?? 1);
    // vary: each play a little higher or lower (no two cries the same).
    const pitch = (opts.pitch ?? 1) * (sound.vary ? 1 + (Math.random() * 2 - 1) * sound.vary : 1);
    const out = this.ctx.createStereoPanner();
    out.pan.value = place.pan;
    let tail = out;
    if (opts.highpassHz) {
      tail = this.ctx.createBiquadFilter();
      tail.type = 'highpass';
      tail.frequency.value = opts.highpassHz;
      out.connect(tail);
    }
    const routed = this.route(tail, sound, place.volume, opts);
    const release = () => {
      routed();
      if (tail !== out) out.disconnect();
    };

    const t0 = this.ctx.currentTime;
    let end = t0;
    for (const layer of sound.layers) {
      end = Math.max(end, this.layer(layer, out, t0, volume, pitch));
    }
    // Let go of the nodes once it (and its reverb send) is over.
    setTimeout(release, (end - t0) * 1000 + 200);
  }

  // One noise or tone layer. Returns when it ends (audio time).
  layer(l, out, t0, volume, pitch) {
    const ctx = this.ctx;
    const start = t0 + (l.delay ?? 0);
    const attack = l.attack ?? 0.004;
    const stop = start + l.dur;

    const { source, head } = this.source(l, start, stop, pitch);

    // Envelope: quick rise, hold (voices), then fall away to silence.
    const env = ctx.createGain();
    const peak = Math.max(0.0002, l.gain * volume);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + attack);
    if (l.hold) env.gain.setValueAtTime(peak, start + attack + l.dur * l.hold);
    env.gain.exponentialRampToValueAtTime(0.0001, stop);
    head.connect(env);
    env.connect(out);

    if (source instanceof AudioBufferSourceNode) source.start(start, Math.random() * 1.5, l.dur + 0.05);
    else {
      source.start(start);
      source.stop(stop + 0.05);
    }
    source.onended = () => env.disconnect();
    return stop;
  }

  // A noise (or crackle) source through a filter, or a tone, ready to shape.
  source(l, start, stop, pitch, loop = false) {
    const ctx = this.ctx;
    let source;
    let head;
    if (l.noise) {
      source = ctx.createBufferSource();
      source.buffer = l.noise === 'crackle' ? this.crackle : this.noise;
      source.loop = loop;
      const filter = ctx.createBiquadFilter();
      filter.type = l.filter ?? 'lowpass';
      filter.frequency.setValueAtTime(l.freq * pitch, start);
      if (l.freqEnd && stop) filter.frequency.exponentialRampToValueAtTime(l.freqEnd * pitch, stop);
      filter.Q.value = l.q ?? 0.7;
      source.connect(filter);
      head = filter;
    } else {
      source = ctx.createOscillator();
      source.type = l.wave ?? 'sine';
      source.frequency.setValueAtTime(l.freq * pitch, start);
      // Pitch contour: rise to freqMid (at midAt of the way), then to freqEnd.
      if (l.freqMid && stop) {
        source.frequency.linearRampToValueAtTime(l.freqMid * pitch, start + l.dur * (l.midAt ?? 0.25));
      }
      if (l.freqEnd && stop) source.frequency.exponentialRampToValueAtTime(l.freqEnd * pitch, stop);
      head = source;
      if (l.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = l.filter;
        filter.frequency.setValueAtTime(l.cutoff ?? 1000, start);
        // Mouth shape changing (vowel glide, e.g. "aah" to "uh").
        if (l.cutoffEnd && stop) filter.frequency.linearRampToValueAtTime(l.cutoffEnd, stop);
        filter.Q.value = l.q ?? 0.7;
        source.connect(filter);
        head = filter;
      }
      // Vibrato: a wobble in pitch (voices, electric buzz, saw motor).
      if (l.vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = l.vibrato.rate;
        depth.gain.value = l.vibrato.depth * pitch;
        lfo.connect(depth).connect(source.frequency);
        lfo.start(start);
        if (stop) lfo.stop(stop + 0.05);
        source.lfo = lfo;
      }
    }
    return { source, head };
  }

  // ---- Loops ----

  // Keep loop `name` (a LOOPS entry) playing this frame, at `at`, at
  // `level` (0..1). id: one loop per thing (each cloud, saw, fire...).
  hold(id, name, at = null, level = 1) {
    if (!this.ready) return;
    this.held.add(id);
    let loop = this.loops.get(id);
    if (loop && loop.name !== name) {
      this.stopLoop(id);
      loop = null;
    }
    if (!loop) loop = this.startLoop(id, name);
    const place = this.place(at);
    const t = this.ctx.currentTime;
    loop.gain.gain.setTargetAtTime(Math.max(0.0001, LOOPS[name].gain * level * place.volume), t, 0.05);
    loop.pan.pan.setTargetAtTime(place.pan, t, 0.05);
  }

  // A stable id for an object (cloud, saw, fire patch).
  idFor(obj, prefix) {
    obj.sfxId ??= `${prefix}${++this.idSeq}`;
    return obj.sfxId;
  }

  startLoop(id, name) {
    const ctx = this.ctx;
    const def = LOOPS[name];
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const pan = ctx.createStereoPanner();
    gain.connect(pan);
    const release = this.route(pan, def, 1);

    // Pulse: the whole loop swells and fades in a rhythm (breathing, gasping).
    let pulse = null;
    let input = gain;
    if (def.pulse) {
      const swell = ctx.createGain();
      swell.gain.value = 1 - def.pulse.depth / 2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = def.pulse.rate;
      const depth = ctx.createGain();
      depth.gain.value = def.pulse.depth / 2;
      lfo.connect(depth).connect(swell.gain);
      lfo.start();
      swell.connect(gain);
      input = swell;
      pulse = lfo;
    }

    const sources = [];
    const t = ctx.currentTime;
    for (const l of def.layers) {
      const { source, head } = this.source(l, t, null, 1, true);
      const g = ctx.createGain();
      g.gain.value = l.gain;
      head.connect(g).connect(input);
      if (source instanceof AudioBufferSourceNode) source.start(t, Math.random() * 1.5);
      else source.start(t);
      sources.push(source);
    }
    const loop = { name, gain, pan, sources, pulse, release };
    this.loops.set(id, loop);
    return loop;
  }

  stopLoop(id) {
    const loop = this.loops.get(id);
    if (!loop) return;
    this.loops.delete(id);
    const t = this.ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(t);
    loop.gain.gain.setTargetAtTime(0.0001, t, 0.08);
    for (const s of loop.sources) {
      s.stop(t + 0.4);
      s.lfo?.stop(t + 0.4);
    }
    loop.pulse?.stop(t + 0.4);
    setTimeout(loop.release, 600);
  }

  // Once per frame, after everyone has held their loops: fade the rest.
  endFrame() {
    for (const id of [...this.loops.keys()]) {
      if (!this.held.has(id)) this.stopLoop(id);
    }
    this.held.clear();
  }

  // ---- Buffers ----

  // 2 seconds of white noise, shared by every noise layer.
  makeNoise() {
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // 2 seconds of crackle: silence full of random little pops (fire, sparks).
  makeCrackle() {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * 2, rate);
    const data = buffer.getChannelData(0);
    for (let pop = 0; pop < 90; pop++) {
      const at = Math.floor(Math.random() * (data.length - rate * 0.03));
      const len = Math.floor(rate * (0.002 + Math.random() * 0.012));
      const amp = 0.3 + Math.random() * 0.7;
      for (let i = 0; i < len; i++) data[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / len);
    }
    return buffer;
  }

  // Reverb "room": stereo noise that dies away.
  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  // ---- Shortcuts used around the game ----

  // A weapon going off. enemy: a bot's shot (quieter, lower).
  shot(weapon, at, enemy = false) {
    const key = shotSoundFor(weapon);
    if (!key) return;
    const opts = enemy ? { volume: SOUND_SETTINGS.enemyVolume, pitch: SOUND_SETTINGS.enemyPitch } : {};
    this.play(key, at, opts);
  }

  // A character got hurt: what you hear depends on what it's made of.
  hurt(target, kind) {
    const now = this.scene.time.now;
    if (now - (target.lastHurtSoundAt ?? -1e9) < SOUND_SETTINGS.hurtGapMs) return;
    target.lastHurtSoundAt = now;
    if (kind === 'gas') {
      this.play('cough', target);
      return;
    }
    if (kind === 'fire') return; // burning has its own cries (burnPain)
    if (target === this.scene.player) {
      this.play('youHurt');
      return;
    }
    this.play(this.bodySound(target, 'hurt'), target, { volume: 0.8 });
  }

  // On fire: a cry of pain every so often (machines don't feel it).
  burnPain(target) {
    if (this.materialOf(target) === 'machine') return;
    const key = target === this.scene.player ? 'burnPainYou' : 'burnPain';
    this.play(key, target === this.scene.player ? null : target);
  }

  // Dying: the last cry of that enemy class (machines crunch, bones clatter).
  death(target) {
    this.play(this.deathSound(target), target);
  }

  // Falling into the void: the same cry, thin and echoing away below.
  fallCry(target) {
    const { volume, wet, echo, highpassHz } = FALL_CRY;
    this.play(this.deathSound(target), target === this.scene.player ? null : target, { volume, wet, echo, highpassHz });
  }

  materialOf(target) {
    if (target === this.scene.player) return 'flesh';
    const c = target.config ?? {};
    if (c.material === 'cyborg') return 'machine';
    return c.material ?? FAMILY_MATERIAL[c.family] ?? (c.family ? 'flesh' : 'straw');
  }

  deathSound(target) {
    if (target === this.scene.player) return 'dieYou';
    const cry = DEATH_CRIES[target.config?.name];
    if (cry) return cry;
    return {
      bone: 'deathBone',
      machine: 'deathMachine',
      straw: 'deathStraw',
    }[this.materialOf(target)] ?? 'dieSoldier';
  }

  bodySound(target, prefix) {
    const name = { machine: 'Machine', bone: 'Bone', straw: 'Straw' }[this.materialOf(target)] ?? 'Flesh';
    return `${prefix}${name}`;
  }

  // Your jetpack: a deep rush; with Jet Boost a thin, high hiss.
  updateJet(thrusting, boosted) {
    if (thrusting) this.hold('jet', boosted ? 'jetBoost' : 'jet');
  }
}