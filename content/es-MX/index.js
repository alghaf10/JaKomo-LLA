import orderingFood from './orderingFood';
import gettingAround from './gettingAround';
import atTheMarket from './atTheMarket';
import numbers1 from './numbers1';
import letters1 from './letters1';

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
  ],
};
