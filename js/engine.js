const SUITS = [
  { id: 'spades', symbol: '♠', color: 'black' },
  { id: 'hearts', symbol: '♥', color: 'red' },
  { id: 'clubs', symbol: '♣', color: 'black' },
  { id: 'diamonds', symbol: '♦', color: 'red' }
];

const RANKS = [
  { value: 1, label: 'A' }, { value: 2, label: '2' }, { value: 3, label: '3' },
  { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6' },
  { value: 7, label: '7' }, { value: 8, label: '8' }, { value: 9, label: '9' },
  { value: 10, label: '10' }, { value: 11, label: 'J' }, { value: 12, label: 'Q' },
  { value: 13, label: 'K' }
];

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank.label}-${suit.id}`,
        suit: suit.id,
        symbol: suit.symbol,
        color: suit.color,
        value: rank.value,
        label: rank.label,
        faceUp: false
      });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export class GameEngine {
  constructor() {
    this.variant = null;
    this.config = {};
    this.state = null;
    this.history = [];
    this.moves = 0;
  }

  start(variant, config = {}) {
    this.variant = variant;
    this.config = { ...variant.defaultConfig, ...config };
    const deck = variant.createCustomDeck
      ? variant.createCustomDeck(this.config)
      : createDeck();
    this.state = variant.setup(deck, this.config);
    this.history = [];
    this.moves = 0;
  }

  saveSnapshot() {
    this.history.push(structuredClone(this.state));
  }

  undo() {
    if (this.history.length === 0) return [];
    this.state = this.history.pop();
    this.moves++;
    return [];
  }

  moveCards(fromPileId, cardIndex, toPileId) {
    if (fromPileId === toPileId) return null;
    const fromPile = this.state.piles[fromPileId];
    const toPile = this.state.piles[toPileId];
    if (!fromPile || !toPile) return null;

    if (!this.variant.canPickUp(fromPile, cardIndex, this.state)) return null;
    const movingCards = fromPile.cards.slice(cardIndex);
    if (!this.variant.canDrop(movingCards, toPile, this.state)) return null;

    this.saveSnapshot();
    fromPile.cards.splice(cardIndex);
    toPile.cards.push(...movingCards);

    // Auto-flip newly exposed top card in tableau
    if (fromPile.type === 'tableau' && fromPile.cards.length > 0) {
      fromPile.cards[fromPile.cards.length - 1].faceUp = true;
    }

    if (this.variant.onAfterMove) {
      this.variant.onAfterMove(this.state);
    }

    this.moves++;
    return movingCards.map(c => c.id);
  }

  handleStockClick() {
    if (!this.variant.onStockClick) return null;
    this.saveSnapshot();
    const movedIds = this.variant.onStockClick(this.state, this.config);
    if (!movedIds) {
      this.history.pop();
      return null;
    }
    this.moves++;
    return movedIds;
  }

  autoMoveToFoundation(fromPileId, cardIndex) {
    const fromPile = this.state.piles[fromPileId];
    if (!fromPile || cardIndex !== fromPile.cards.length - 1) return null;
    const foundationIds = Object.keys(this.state.piles).filter(
      id => this.state.piles[id].type === 'foundation'
    );
    for (const targetId of foundationIds) {
      const moved = this.moveCards(fromPileId, cardIndex, targetId);
      if (moved) return moved;
    }
    return null;
  }

  isWon() {
    return this.variant.isWon(this.state);
  }
}
