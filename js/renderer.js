export function createCardElement(card) {
  const el = document.createElement('div');
  el.className = `card ${card.faceUp ? card.color : 'face-down'}`;
  el.dataset.cardId = card.id;

  if (card.faceUp) {
    el.innerHTML = `
      <div class="card-corner">${card.label}${card.symbol}</div>
      <div class="card-center">${card.symbol}</div>
    `;
  }
  return el;
}

export function renderBoard(boardEl, engine, selection, movedCardIds = []) {
  const { state, variant } = engine;
  const movedSet = new Set(movedCardIds);
  boardEl.innerHTML = '';

  const topRow = document.createElement('div');
  topRow.className = 'top-row';
  topRow.style.gridTemplateColumns = `repeat(${state.layout.top.length}, var(--card-width))`;

  for (const pileId of state.layout.top) {
    if (!pileId) {
      topRow.appendChild(document.createElement('div'));
      continue;
    }
    topRow.appendChild(renderPile(state.piles[pileId], engine, selection, movedSet));
  }

  const tableauRow = document.createElement('div');
  tableauRow.className = 'tableau-row';
  tableauRow.style.gridTemplateColumns = `repeat(${state.layout.tableau.length}, var(--card-width))`;

  for (const pileId of state.layout.tableau) {
    tableauRow.appendChild(renderPile(state.piles[pileId], engine, selection, movedSet));
  }

  boardEl.append(topRow, tableauRow);
}

function renderPile(pile, engine, selection, movedSet) {
  const pileEl = document.createElement('div');
  pileEl.className = 'pile';
  pileEl.dataset.pileId = pile.id;

  if (pile.label) {
    const label = document.createElement('span');
    label.className = 'pile-label';
    label.textContent = pile.type === 'stock' ? `${pile.cards.length}` : pile.label;
    pileEl.appendChild(label);
  }

  // Highlight legal destinations when a card/stack is selected
  if (selection && selection.pileId !== pile.id) {
    const srcPile = engine.state.piles[selection.pileId];
    const movingCards = srcPile.cards.slice(selection.cardIndex);
    if (engine.variant.canDrop(movingCards, pile, engine.state)) {
      pileEl.classList.add('valid-target');
    }
  }

  let faceUpStep = 30;
  const faceDownStep = 10;

  if (pile.type === 'tableau' && pile.cards.length > 0) {
    const cardWidth = Math.min(155, Math.max(78, window.innerWidth * 0.092));
    const cardHeight = cardWidth * 1.4;
    const maxColHeight = window.innerHeight - 210;

    const faceUpCount = pile.cards.filter(c => c.faceUp).length;
    const faceDownCount = pile.cards.length - faceUpCount;
    const neededHeight =
      cardHeight +
      faceDownCount * faceDownStep +
      Math.max(0, faceUpCount - 1) * faceUpStep;

    if (neededHeight > maxColHeight && faceUpCount > 1) {
      faceUpStep = Math.max(
        18,
        Math.floor(
          (maxColHeight - cardHeight - faceDownCount * faceDownStep) /
            (faceUpCount - 1)
        )
      );
    }
  }

  let offsetY = 0;
  pile.cards.forEach((card, index) => {
    const cardEl = createCardElement(card);
    cardEl.dataset.pileId = pile.id;
    cardEl.dataset.cardIndex = index;
    cardEl.style.top = `${offsetY - 2}px`;
    cardEl.style.zIndex = index + 1;

    if (
      selection &&
      selection.pileId === pile.id &&
      index >= selection.cardIndex
    ) {
      cardEl.classList.add('selected');
    }

    if (movedSet.has(card.id)) {
      cardEl.classList.add('just-moved');
    }

    pileEl.appendChild(cardEl);

    if (pile.type === 'tableau') {
      offsetY += card.faceUp ? faceUpStep : faceDownStep;
    } else if (pile.type === 'waste' && engine.config.drawCount === 3) {
      const visibleStart = Math.max(0, pile.cards.length - 3);
      if (index >= visibleStart) {
        cardEl.style.left = `${(index - visibleStart) * 16 - 2}px`;
      }
    }
  });

  if (pile.type === 'tableau' && pile.cards.length > 0) {
    pileEl.style.minHeight = `calc(var(--card-height) + ${offsetY}px)`;
  }

  return pileEl;
}
