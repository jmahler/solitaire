export const FreeCell = {
  id: 'freecell',
  name: 'FreeCell',
  defaultConfig: {},
  options: [],

  setup(deck) {
    const piles = {};
    for (let i = 0; i < 4; i++) {
      piles[`c-${i}`] = { id: `c-${i}`, type: 'cell', label: 'Cell', cards: [] };
      piles[`f-${i}`] = { id: `f-${i}`, type: 'foundation', label: 'A', cards: [] };
    }
    for (let col = 0; col < 8; col++) {
      piles[`t-${col}`] = { id: `t-${col}`, type: 'tableau', label: '', cards: [] };
    }

    let i = 0;
    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = true;
      piles[`t-${i % 8}`].cards.push(card);
      i++;
    }

    return {
      layout: {
        top: ['c-0', 'c-1', 'c-2', 'c-3', 'f-0', 'f-1', 'f-2', 'f-3'],
        tableau: ['t-0', 't-1', 't-2', 't-3', 't-4', 't-5', 't-6', 't-7']
      },
      piles
    };
  },

  canPickUp(pile, cardIndex, state) {
    if (pile.type === 'cell' || pile.type === 'foundation') {
      return cardIndex === pile.cards.length - 1;
    }
    // Verify descending alternating-color sequence
    for (let i = cardIndex; i < pile.cards.length - 1; i++) {
      const curr = pile.cards[i];
      const next = pile.cards[i + 1];
      if (curr.color === next.color || curr.value !== next.value + 1) return false;
    }
    // Enforce FreeCell supermove capacity
    const movingCount = pile.cards.length - cardIndex;
    const emptyCells = Object.values(state.piles).filter(
      p => p.type === 'cell' && p.cards.length === 0
    ).length;
    const emptyCols = Object.values(state.piles).filter(
      p => p.type === 'tableau' && p.cards.length === 0
    ).length;
    const maxMovable = (1 + emptyCells) * Math.pow(2, emptyCols);
    return movingCount <= maxMovable;
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
      if (!topTarget) {
        // Adjust supermove capacity when dropping into an empty column
        const emptyCells = Object.values(state.piles).filter(
          p => p.type === 'cell' && p.cards.length === 0
        ).length;
        const emptyCols = Object.values(state.piles).filter(
          p => p.type === 'tableau' && p.cards.length === 0
        ).length - 1;
        return movingCards.length <= (1 + emptyCells) * Math.pow(2, Math.max(0, emptyCols));
      }
      return topTarget.color !== lead.color && lead.value === topTarget.value - 1;
    }
    return false;
  },

  isWon(state) {
    return ['f-0', 'f-1', 'f-2', 'f-3'].every(
      id => state.piles[id].cards.length === 13
    );
  }
};
