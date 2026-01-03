
import { SoundSet, SoundSlot } from './types';

export const COLORS = [
  'bg-blue-600', 'bg-red-600', 'bg-green-600', 'bg-yellow-600', 
  'bg-purple-600', 'bg-pink-600', 'bg-indigo-600', 'bg-orange-600',
  'bg-teal-600', 'bg-slate-600'
];

const createEmptySlot = (index: number): SoundSlot => ({
  id: `slot-${index}-${Math.random().toString(36).substr(2, 9)}`,
  name: `Pad trống ${index + 1}`,
  url: null,
  volume: 0.8,
  loop: false,
  color: COLORS[index % COLORS.length],
  trimStart: 0,
  trimEnd: null,
  fadeIn: 0,
  fadeOut: 0
});

export const INITIAL_SETS: SoundSet[] = [
  {
    id: 'set-default',
    name: 'Main Show',
    slots: Array.from({ length: 28 }, (_, i) => createEmptySlot(i))
  },
  {
    id: 'set-sfx',
    name: 'Sound Effects',
    slots: Array.from({ length: 28 }, (_, i) => createEmptySlot(i))
  }
];

export const DEMO_SOUNDS = [
  { name: 'Air Horn', url: 'https://www.myinstants.com/media/sounds/mlg-airhorn.mp3' },
  { name: 'Drum Roll', url: 'https://www.myinstants.com/media/sounds/drum-roll.mp3' },
  { name: 'Applause', url: 'https://www.myinstants.com/media/sounds/audience_applause.mp3' },
  { name: 'Sad Trombone', url: 'https://www.myinstants.com/media/sounds/sadtrombone.mp3' },
  { name: 'Censor Bleep', url: 'https://www.myinstants.com/media/sounds/censor-beep-1.mp3' },
  { name: 'Laugh Track', url: 'https://www.myinstants.com/media/sounds/sitcom-laughing-1.mp3' },
];
