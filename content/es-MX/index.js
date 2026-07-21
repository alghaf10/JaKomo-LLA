import orderingFood from './orderingFood';
import gettingAround from './gettingAround';
import atTheMarket from './atTheMarket';
import numbers1 from './numbers1';
import letters1 from './letters1';

// v3 draft lessons — scaffolds with [FAHAD: es/en] placeholders. Registered
// here but flagged `draft: true`, which getLessons() filters out, so they do
// NOT appear in the app until the content is written and the flag removed.
import greetings from './greetings';
import numbersMoney from './numbersMoney';
import askingHelp from './askingHelp';
import introductions from './introductions';
import tuVsUsted from './tuVsUsted';
import whenThingsGoWrong from './whenThingsGoWrong';
import fullDay from './fullDay';

export default {
  code: 'es-MX',
  name: 'Mexican Spanish',
  flag: '🇲🇽',
  speechLanguage: 'es-MX',
  lessons: [
    { ...orderingFood, emoji: '🌮', subtitle: 'Order like a local, not a tourist', unlocked: true },
    { ...gettingAround, emoji: '🚕', subtitle: 'Taxis, directions, and drop-offs', unlocked: true },
    { ...atTheMarket, emoji: '🛒', subtitle: 'Haggle and shop like a local', unlocked: true },
    { ...numbers1, emoji: '🔢', subtitle: 'Prices, numbers, and market math', unlocked: true },
    { ...letters1, emoji: '🔤', subtitle: 'Master the tricky sounds', unlocked: true },

    // --- DRAFT / HIDDEN (getLessons filters draft:true) — content TBD ---------
    { ...greetings, emoji: '👋', subtitle: 'Hellos, goodbyes, and being polite', unlocked: true, draft: false },
    { ...numbersMoney, emoji: '💵', subtitle: 'Counting, prices, and paying', unlocked: false, draft: true },
    { ...askingHelp, emoji: '🆘', subtitle: 'Directions and getting assistance', unlocked: false, draft: true },
    { ...introductions, emoji: '🤝', subtitle: 'Names, origins, and small talk', unlocked: false, draft: true },
    { ...tuVsUsted, emoji: '🎩', subtitle: 'Formal and informal “you”', unlocked: false, draft: true },
    { ...whenThingsGoWrong, emoji: '⚠️', subtitle: 'Problems, apologies, and fixes', unlocked: false, draft: true },
    { ...fullDay, emoji: '🌅', subtitle: 'Morning to night in Mexico', unlocked: false, draft: true },
  ],
};
