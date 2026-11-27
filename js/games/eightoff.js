export const EightOff = {
  id: 'eightoff',
  name: 'Eight Off',
  defaultConfig: {},
  options: [],

  setup(deck) {
    const piles = {};

    for (let i = 0; i < 8; i++) {
      piles[`c-${i}`] = { id: `c-${i}`, type: 'cell', label: 'Cell', cards: [] };
      piles[`t-${i}`] = { id: `t-${i}`, type: 'tableau', label: '', cards: [] };
    }

    for (let i = 0; i < 4; i++) {
      piles[`f-${i}`] = { id: `f-${i}`, type: 'foundation', label: 'A', cards: [] };
    }

    // Deal 6 cards face-up to each of the 8 tableau columns (48 cards)
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 6; row++) {
        const card = deck.pop();
        card.faceUp = true;
        piles[`t-${col}`].cards.push(card);
      }
    }

    // Deal remaining 4 cards face-up into the first 4 reserve cells
    for (let i = 0; i < 4; i++) {
      const card = deck.pop();
      card.faceUp = true;
      piles[`c-${i}`].cards.push(card);
    }

    return {
      layout: {
        // 8 cells + 4 foundations across the top, or place foundations on a separate/shared grid
        top: ['c-0', 'c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6', 'c-7', 'f-0', 'f-1', 'f-2', 'f-3'],
        tableau: ['t-0', 't-1', 't-2', 't-3', 't-4', 't-5', 't-6', 't-7']
      },
      piles
    };
  },

  canPickUp(pile, cardIndex) {
    if (pile.type === 'cell') {
      return pile.cards.length > 0 && cardIndex === 0;
    }
    if (pile.type !== 'tableau') return false;

    const card = pile.cards[cardIndex];
    if (!card || !card.faceUp) return false;

    // Must be a descending SAME-SUIT run from cardIndex to top of pile
    for (let i = cardIndex; i < pile.cards.length - 1; i++) {
      const curr = pile.cards[i];
      const next = pile.cards[i + 1];
      if (curr.suit !== next.suit || curr.value !== next.value + 1) {
        return false;
      }
    }
    return true;
  },

  canDrop(movingCards, targetPile, state) {
    const lead = movingCards[0];
    const topTarget = targetPile.cards[targetPile.cards.length - 1];

    if (targetPile.type === 'cell') {
      return movingCards.length === 1 && targetPile.cards.length === 0;
    }

    if (targetPile.type === 'foundation') {
      if (movingCards.length !== 1) return false;
      if (!topTarget) return lead.value === 1;
      return topTarget.suit === lead.suit && lead.value === topTarget.value + 1;
    }

    if (targetPile.type === 'tableau') {
      const emptyCells = Object.values(state.piles).filter(
        p => p.type === 'cell' && p.cards.length === 0
      ).length;
      const emptyCols = Object.values(state.piles).filter(
        p => p.type === 'tableau' && p.cards.length === 0
      ).length;

      if (!topTarget) {
        // Only Kings (or a stack led by a King) may move into an empty column
        if (lead.value !== 13) return false;
        const maxMovable = (1 + emptyCells) * Math.pow(2, Math.max(0, emptyCols - 1));
        return movingCards.length <= maxMovable;
      }

      const maxMovable = (1 + emptyCells) * Math.pow(2, emptyCols);
      return (
        movingCards.length <= maxMovable &&
        topTarget.suit === lead.suit &&
        lead.value === topTarget.value - 1
      );
    }

    return false;
  },

  isWon(state) {
    return ['f-0', 'f-1', 'f-2', 'f-3'].every(
      id => state.piles[id].cards.length === 13
    );
  }
};
