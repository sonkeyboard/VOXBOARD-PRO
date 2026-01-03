
export interface SoundSlot {
  id: string;
  name: string;
  url: string | null;
  volume: number;
  loop: boolean;
  color: string;
  shortcut?: string;
  // Advanced playback properties
  trimStart: number;
  trimEnd: number | null;
  fadeIn: number;
  fadeOut: number;
}

export interface SoundSet {
  id: string;
  name: string;
  slots: SoundSlot[];
}

export interface ActiveSound {
  id: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number; // The ctx.currentTime when the sound started (or resumed)
  offset: number;    // The offset into the audio buffer where playback started/resumed
  duration: number;  // The total duration of the segment to be played
  isPaused: boolean;
  pauseOffset: number; // The offset where the sound was paused
}
