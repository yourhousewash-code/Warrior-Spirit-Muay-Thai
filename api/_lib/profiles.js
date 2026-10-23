import { redis } from './core.js';

/* What each coach's profile says on the website today. Coaches edit from here; Jay approves Aaron's and Kian's changes. */
export const DEFAULTS = {
  jay: {
    role: 'Owner & head coach',
    intro: 'James “Jay” Shepherd has been teaching kickboxing for over 18 years and holds a 3rd Dan black belt. He coaches people of every age, from seven-year-olds at their first class to adults getting fit and fighters getting ready for the ring.',
    background: 'He leads the fight team and runs fight camps, building each camp backwards from the fight date. His fighters have competed at amateur and semi-pro level, and he has taken kids to around a hundred interclubs, so he knows how to bring a nervous first-timer through their first bout as well as how to sharpen an experienced fighter.\n\nIn the gym he\'s the one holding the pads, watching your feet and telling you the one thing that will make the next round better. On fight night he\'s in the corner.',
    chips: 'Qualified kickboxing coach\nDBS checked\nFirst-aid trained\nHead coach\nFight team\nFight camps\nKids & juniors\nCornering\n1-to-1 PT',
    ask: 'your first interclub, fight camp, or getting your child started.',
    instagram: '',
  },
  aaron: {
    role: 'Trainer',
    intro: 'Aaron trains members on the pads and in the classes, and makes sure every round counts.',
    background: '', chips: 'Trainer\nPads\nClasses', ask: '', instagram: 'aaronbekir_',
  },
  kian: {
    role: 'Trainer',
    intro: 'Kian coaches in the classes and on the pads, helping members tighten up their technique.',
    background: '', chips: 'Trainer\nFought at MAX Muay Thai, Thailand\nTechnique\nClasses', ask: '', instagram: 'kianh_pt',
  },
};
export const BLANK = { role: 'Trainer', intro: '', background: '', chips: 'Trainer', ask: '', instagram: '' };
export async function liveProfile(c) { return (await redis.get(`profile:${c}:live`)) || { ...(DEFAULTS[c] || BLANK), photo: '' }; }
export const profilePhotoUrl = (c, p) => p ? `/api/profile?action=photo&coach=${c}&v=${encodeURIComponent(p.split('/').pop())}` : '';
