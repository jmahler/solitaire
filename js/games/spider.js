const SUIT_CONFIGS = {
  1: ['spades', 'spades', 'spades', 'spades', 'spades', 'spades', 'spades', 'spades'],
  2: ['spades', 'hearts', 'spades', 'hearts', 'spades', 'hearts', 'spades', 'hearts'],
  4: ['spades', 'hearts', 'clubs', 'diamonds', 'spades', 'hearts', 'clubs', 'diamonds']
};

const SUIT_META = {
  spades: { symbol: '♠', color: 'black' },
  hearts: { symbol: '♥', color: 'red' },
  clubs: { symbol: '♣', color: 'black' },
  diamonds: { symbol: '♦', color: 'red' }
};

const RANKS = [
  { value: 1, label: 'A' }, { value: 2, label: '2' }, { value: 3, label: '3' },
  { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6' },
  { value: 7, label: '7' }, { value: 8, label: '8' }, { value: 9, label: '9' },
  { value: 10, label: '10' }, { value: 11, label: 'J' }, { value: 12, label: 'Q' },
  { value: 13, label: 'K' }
];

function buildSpiderDeck(suitCount) {
  const suits = SUIT_CONFIGS[suitCount] || SUIT_CONFIGS[1];
  const deck = [];
  suits.forEach((suit, deckIdx) => {
    const meta = SUIT_META[suit];
    for (const rank of RANKS) {
      deck.push({
        id: `${rank.label}-${suit}-${deckIdx}`,
        suit,
        symbol: meta.symbol,
        color: meta.color,
        value: rank.value,
        label: rank.label,
        faceUp: false
      });
    }
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function clearCompletedRuns(state) {
  let clearedAny = false;
  for (let col = 0; col < 10; col++) {
    const pile = state.piles[`t-${col}`];
    if (pile.cards.length < 13) continue;

    const tail = pile.cards.slice(-13);
    const suit = tail[0].suit;
    const isCompleteRun = tail.every(
      (c, idx) => c.faceUp && c.suit === suit && c.value === 13 - idx
    );

    if (isCompleteRun) {
      pile.cards.splice(-13);
      state.completedRuns = (state.completedRuns || 0) + 1;
      // Flip newly exposed card underneath if needed
      if (pile.cards.length > 0) {
        pile.cards[pile.cards.length - 1].faceUp = true;
      }
      // Place the top King onto the next open foundation slot as a visual trophy
      const emptyFoundation = Object.values(state.piles).find(
        p => p.type === 'foundation' && p.cards.length === 0
      );
      if (emptyFoundation) {
        emptyFoundation.cards.push(tail[0]);
      }
      clearedAny = true;
    }
  }
  return clearedAny;
}

export const Spider = {
  id: 'spider',
  name: 'Spider',
  defaultConfig: { suits: 1 },
  options: [
    {
      key: 'suits',
      label: 'Suits',
      choices: [
        { label: '1 Suit', value: 1 },
        { label: '2 Suits', value: 2 },
        { label: '4 Suits', value: 4 }
      ]
    }
  ],

  createCustomDeck(config) {
    return buildSpiderDeck(config.suits);
  },

  setup(deck) {
    const piles = {
      stock: { id: 'stock', type: 'stock', label: 'Stock', cards: [] }
    };

    // 8 completed-run slots at the top right
    for (let i = 0; i < 8; i++) {
      piles[`f-${i}`] = { id: `f-${i}`, type: 'foundation', label: 'K-A', cards: [] };
    }

    // 10 tableau columns: first 4 get 6 cards, remaining 6 get 5 cards (54 total)
    for (let col = 0; col < 10; col++) {
      const count = col < 4 ? 6 : 5;
      const cards = [];
      for (let row = 0; row < count; row++) {
        const card = deck.pop();
        card.faceUp = row === count - 1;
        cards.push(card);
      }
      piles[`t-${col}`] = { id: `t-${col}`, type: 'tableau', label: '', cards };
    }

    piles.stock.cards = deck; // Remaining 50 cards (5 deals of 10)
    return {
      completedRuns: 0,
      layout: {
        top: ['stock', null, 'f-0', 'f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6', 'f-7'],
        tableau: ['t-0', 't-1', 't-2', 't-3', 't-4', 't-5', 't-6', 't-7', 't-8', 't-9']
      },
      piles
    };
  },

  onStockClick(state) {
    const { stock } = state.piles;
    if (stock.cards.length === 0) return null;

    // Spider rule: cannot deal from stock if any tableau column is empty
    const hasEmptyCol = state.layout.tableau.some(
      id => state.piles[id].cards.length === 0
    );
    if (hasEmptyCol) return null;

    const movedIds = [];
    for (const colId of state.layout.tableau) {
      if (stock.cards.length === 0) break;
      const card = stock.cards.pop();
      card.faceUp = true;
      state.piles[colId].cards.push(card);
      movedIds.push(card.id);
    }

    clearCompletedRuns(state);
    return movedIds;
  },

  canPickUp(pile, cardIndex) {
    if (pile.type !== 'tableau') return false;
    const card = pile.cards[cardIndex];
    if (!card || !card.faceUp) return false;

    // Can only move a stack if all cards from cardIndex down are descending AND same suit
    for (let i = cardIndex; i < pile.cards.length - 1; i++) {
      const curr = pile.cards[i];
      const next = pile.cards[i + 1];
      if (curr.suit !== next.suit || curr.value !== next.value + 1) return false;
    }
    return true;
  },

  canDrop(movingCards, targetPile) {
    if (targetPile.type !== 'tableau') return false;
    const lead = movingCards[0];
    const topTarget = targetPile.cards[targetPile.cards.length - 1];

    // Any card or valid same-suit run can drop onto an empty column
    if (!topTarget) return true;
    // Can drop onto any suit as long as rank is 1 lower
    return lead.value === topTarget.value - 1;
  },

  onAfterMove(state) {
    clearCompletedRuns(state);
  },

  isWon(state) {
    return state.completedRuns === 8;
  }
};
