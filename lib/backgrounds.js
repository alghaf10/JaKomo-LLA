const BACKGROUNDS = {
  login: { uri: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1200&q=80' }, // Chichén Itzá
  languageSelect: { uri: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=1200&q=80' }, // neutral travel theme

  'es-MX': {
    home: { uri: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1200&q=80' }, // Guanajuato colors
    practice: { uri: 'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200&q=80' }, // San Miguel de Allende
    lessons: {
      1: { uri: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&q=80' }, // street food
      2: { uri: 'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200&q=80' }, // CDMX city
      3: { uri: 'https://images.unsplash.com/photo-1584697964358-3e14ca57658b?w=1200&q=80' }, // market colors
    },
  },
};

export const getBackgrounds = (code) => BACKGROUNDS[code] || BACKGROUNDS['es-MX'];

export default BACKGROUNDS;
