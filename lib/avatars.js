export const AVATARS = [
  require('../assets/avatars/avatar1.png'),
  require('../assets/avatars/avatar2.png'),
  require('../assets/avatars/avatar3.png'),
  require('../assets/avatars/avatar4.png'),
  require('../assets/avatars/avatar5.png'),
  require('../assets/avatars/avatar6.png'),
  require('../assets/avatars/avatar7.png'),
  require('../assets/avatars/avatar8.png'),
];

export const getAvatarSource = (avatarId) => {
  const index = Number(avatarId) - 1;
  if (Number.isInteger(index) && index >= 0 && index < AVATARS.length) {
    return AVATARS[index];
  }
  return AVATARS[0];
};
