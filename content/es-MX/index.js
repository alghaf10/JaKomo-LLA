import orderingFood from './orderingFood';
import gettingAround from './gettingAround';
import atTheMarket from './atTheMarket';

export default {
  code: 'es-MX',
  name: 'Mexican Spanish',
  flag: '🇲🇽',
  speechLanguage: 'es-MX',
  lessons: [
    { ...orderingFood, emoji: '🌮', subtitle: 'Order like a local, not a tourist', unlocked: true },
    { ...gettingAround, emoji: '🚕', subtitle: 'Taxis, directions, and drop-offs', unlocked: true },
    { ...atTheMarket, emoji: '🛒', subtitle: 'Haggle and shop like a local', unlocked: true },
  ],
};
