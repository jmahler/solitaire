export const Klondike = {
  id: 'klondike',
  name: 'Klondike',
  defaultConfig: { drawCount: 1 },
  options: [
    {
      key: 'drawCount',
      label: 'Draw',
      choices: [
        { label: 'Draw 1', value: 1 },
        { label: 'Draw 3', value: 3 }
      ]
    }
  ],

  setup(deck) {
    const piles = {
      stock: { id: 'stock', type: 'stock', label: 'Stock', cards: [] },
      waste: { id: 'waste', type: 'waste', label: 'Waste', cards: [] }
    };

    for (let i = 0; i < 4; i++) {
      piles[`f-${i}`] = { id: `f-${i}`, type: 'foundation', label: 'A', cards: [] };
    }

    for (let col = 0; col < 7; col++) {
      const cards = [];
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        card.faceUp = row === col;
        cards.push(card);
      }
      piles[`t-${col}`] = { id: `t-${col}`, type: 'tableau', label: 'K', cards };
    }

    piles.stock.cards = deck;
    return {
      layout: {
        top: ['stock', 'waste', null, 'f-0', 'f-1', 'f-2', 'f-3'],
        tableau: ['t-0', 't-1', 't-2', 't-3', 't-4', 't-5', 't-6']
      },
      piles
    };
  },

  onStockClick(state, config) {
    const { stock, waste } = state.piles;
    if (stock.cards.length > 0) {
      const count = Math.min(config.drawCount, stock.cards.length);
      const movedIds = [];
      for (let i = 0; i < count; i++) {
        const card = stock.cards.pop();
        card.faceUp = true;
        waste.cards.push(card);
        movedIds.push(card.id);
      }
      return movedIds;
    }
    if (waste.cards.length > 0) {
      while (waste.cards.length > 0) {
        const card = waste.cards.pop();
        card.faceUp = false;
        stock.cards.push(card);
      }
      return [];
    }
    return null;
  },

  canPickUp(pile, cardIndex) {
    const card = pile.cards[cardIndex];
    if (!card || !card.faceUp) return false;
    if (pile.type === 'waste' || pile.type === 'foundation') {
      return cardIndex === pile.cards.length - 1;
    }
    return pile.type === 'tableau';
  },

  canDrop(movingCards, targetPile) {
    const lead = movingCards[0];
    const topTarget = targetPile.cards[targetPile.cards.length - 1];

    if (targetPile.type === 'foundation') {
      if (movingCards.length !== 1) return false;
      if (!topTarget) return lead.value === 1;
      return topTarget.suit === lead.suit && lead.value === topTarget.value + 1;
    }

    if (targetPile.type === 'tableau') {
      if (!topTarget) return lead.value === 13;
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
