export const Easthaven = {
  id: 'easthaven',
  name: 'Easthaven',
  defaultConfig: {},
  options: [],

  setup(deck) {
    const piles = {
      stock: { id: 'stock', type: 'stock', label: 'Stock', cards: [] }
    };

    for (let i = 0; i < 4; i++) {
      piles[`f-${i}`] = { id: `f-${i}`, type: 'foundation', label: 'A', cards: [] };
    }

    for (let col = 0; col < 7; col++) {
      const cards = [];
      for (let row = 0; row < 3; row++) {
        const card = deck.pop();
        card.faceUp = row === 2; // Bottom 2 face-down, top 1 face-up
        cards.push(card);
      }
      piles[`t-${col}`] = { id: `t-${col}`, type: 'tableau', label: '', cards };
    }

    // Remaining 31 cards go face-down into the stock
    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      piles.stock.cards.push(card);
    }

    return {
      layout: {
        top: ['stock', null, null, 'f-0', 'f-1', 'f-2', 'f-3'],
        tableau: ['t-0', 't-1', 't-2', 't-3', 't-4', 't-5', 't-6']
      },
      piles
    };
  },

  canPickUp(pile, cardIndex) {
    if (pile.type !== 'tableau') return false;
    const card = pile.cards[cardIndex];
    if (!card || !card.faceUp) return false;

    for (let i = cardIndex; i < pile.cards.length - 1; i++) {
      const curr = pile.cards[i];
      const next = pile.cards[i + 1];
      if (curr.color === next.color || curr.value !== next.value + 1) {
        return false;
      }
    }
    return true;
  },

  canDrop(movingCards, targetPile) {
    const leadCard = movingCards[0];

    if (targetPile.type === 'foundation') {
      if (movingCards.length !== 1) return false;
      if (targetPile.cards.length === 0) return leadCard.value === 1;
      const top = targetPile.cards[targetPile.cards.length - 1];
      return top.suit === leadCard.suit && leadCard.value === top.value + 1;
    }

    if (targetPile.type === 'tableau') {
      if (targetPile.cards.length === 0) return true;
      const top = targetPile.cards[targetPile.cards.length - 1];
      return top.faceUp && top.color !== leadCard.color && leadCard.value === top.value - 1;
    }

    return false;
  },

  onStockClick(state) {
    const { stock } = state.piles;
    if (stock.cards.length === 0) return null;

    const movedIds = [];
    for (const colId of state.layout.tableau) {
      if (stock.cards.length === 0) break;
      const card = stock.cards.pop();
      card.faceUp = true;
      state.piles[colId].cards.push(card);
      movedIds.push(card.id);
    }

    return movedIds;
  },

  isWon(state) {
    return ['f-0', 'f-1', 'f-2', 'f-3'].every(
      id => state.piles[id].cards.length === 13
    );
  }
};
