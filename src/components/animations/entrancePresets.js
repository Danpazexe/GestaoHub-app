export const fadeInUpSoft = {
  0: {
    opacity: 0,
    transform: [{ translateY: 12 }],
  },
  1: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
};

export const cardEntrance = {
  0: {
    opacity: 0,
    transform: [{ translateY: 16 }, { scale: 0.97 }],
  },
  1: {
    opacity: 1,
    transform: [{ translateY: 0 }, { scale: 1 }],
  },
};

export const badgePopIn = {
  0: {
    opacity: 0,
    transform: [{ translateY: -4 }, { scale: 0.92 }],
  },
  1: {
    opacity: 1,
    transform: [{ translateY: 0 }, { scale: 1 }],
  },
};

export const getStaggerDelay = (index, options = {}) => {
  const {
    baseDelay = 0,
    step = 70,
    maxIndex = 6,
  } = options;

  return baseDelay + Math.min(index, maxIndex) * step;
};
