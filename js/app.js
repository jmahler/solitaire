import { GameEngine } from './engine.js';
import { Klondike } from './games/klondike.js';
import { FreeCell } from './games/freecell.js';
import { Spider } from './games/spider.js';
import { renderBoard, createCardElement } from './renderer.js';

const VARIANTS = [Klondike, FreeCell, Spider];
const engine = new GameEngine();

const boardEl = document.getElementById('board');
const gameSelect = document.getElementById('game-select');
const optionsEl = document.getElementById('variant-options');
const newGameBtn = document.getElementById('new-game-btn');
const undoBtn = document.getElementById('undo-btn');
const moveCounter = document.getElementById('move-counter');
const winBanner = document.getElementById('win-banner');
const winStats = document.getElementById('win-stats');
const winNewGameBtn = document.getElementById('win-new-game-btn');

let selection = null;
let dragState = null;

function init() {
  for (const v of VARIANTS) {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name;
    gameSelect.appendChild(opt);
  }

  const savedVariantId = localStorage.getItem('solitaire-variant') || VARIANTS[0].id;
  gameSelect.value = savedVariantId;
  loadVariant(savedVariantId);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function loadVariant(variantId) {
  const variant = VARIANTS.find(v => v.id === variantId) || VARIANTS[0];
  localStorage.setItem('solitaire-variant', variant.id);

  optionsEl.innerHTML = '';
  const savedConfig = JSON.parse(localStorage.getItem(`solitaire-cfg-${variant.id}`) || '{}');

  for (const opt of variant.options) {
    const select = document.createElement('select');
    select.ariaLabel = opt.label;
    for (const choice of opt.choices) {
      const optionEl = document.createElement('option');
      optionEl.value = JSON.stringify(choice.value);
      optionEl.textContent = choice.label;
      select.appendChild(optionEl);
    }
    const currentVal = savedConfig[opt.key] ?? variant.defaultConfig[opt.key];
    select.value = JSON.stringify(currentVal);

    select.addEventListener('change', () => {
      savedConfig[opt.key] = JSON.parse(select.value);
      localStorage.setItem(`solitaire-cfg-${variant.id}`, JSON.stringify(savedConfig));
      startNewGame(variant, savedConfig);
    });
    optionsEl.appendChild(select);
  }

  startNewGame(variant, savedConfig);
}

function startNewGame(variant = engine.variant, config = engine.config) {
  selection = null;
  winBanner.classList.add('hidden');
  engine.start(variant, config);
  refreshUI();
}

function refreshUI(movedCardIds = []) {
  moveCounter.textContent = `Moves: ${engine.moves}`;
  undoBtn.disabled = engine.history.length === 0;
  renderBoard(boardEl, engine, selection, movedCardIds);

  if (engine.isWon()) {
    winStats.textContent = `Completed ${engine.variant.name} in ${engine.moves} moves.`;
    winBanner.classList.remove('hidden');
  }
}

// Unified Pointer Interaction (Drag-and-Drop + Tap-to-Select/Move)
boardEl.addEventListener('pointerdown', (e) => {
  const pileEl = e.target.closest('.pile');
  if (!pileEl) return;

  const pileId = pileEl.dataset.pileId;
  const pile = engine.state.piles[pileId];
  const cardEl = e.target.closest('.card');
  const cardIndex = cardEl ? Number(cardEl.dataset.cardIndex) : -1;

  // Handle Stock pile click immediately
  if (pile.type === 'stock') {
    selection = null;
    const moved = engine.handleStockClick();
    refreshUI(moved || []);
    return;
  }

  // If something is already selected, try moving to this pile
  if (selection) {
    if (selection.pileId === pileId && selection.cardIndex === cardIndex) {
      selection = null;
      refreshUI();
      return;
    }
    const moved = engine.moveCards(selection.pileId, selection.cardIndex, pileId);
    if (moved) {
      selection = null;
      refreshUI(moved);
      return;
    }
  }

  // Otherwise try selecting the clicked card/stack
  if (cardEl && engine.variant.canPickUp(pile, cardIndex, engine.state)) {
    selection = { pileId, cardIndex };
    dragState = {
      pileId,
      cardIndex,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      ghost: null
    };
    refreshUI();
  } else if (selection) {
    // Visual shake feedback on invalid destination
    const selectedEl = boardEl.querySelector('.card.selected');
    if (selectedEl) {
      selectedEl.classList.remove('invalid-shake');
      void selectedEl.offsetWidth;
      selectedEl.classList.add('invalid-shake');
    }
  }
});

window.addEventListener('pointermove', (e) => {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  if (!dragState.dragging && Math.hypot(dx, dy) > 8) {
    dragState.dragging = true;
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const pile = engine.state.piles[dragState.pileId];
    pile.cards.slice(dragState.cardIndex).forEach((card, i) => {
      const cEl = createCardElement(card);
      cEl.style.top = `${i * 26}px`;
      ghost.appendChild(cEl);
    });
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
  }

  if (dragState.dragging && dragState.ghost) {
    dragState.ghost.style.transform = `translate3d(${e.clientX - 35}px, ${e.clientY - 20}px, 0)`;
  }
});

window.addEventListener('pointerup', (e) => {
  if (!dragState) return;
  if (dragState.dragging) {
    dragState.ghost?.remove();
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pile');
    if (dropTarget) {
      const moved = engine.moveCards(
        dragState.pileId,
        dragState.cardIndex,
        dropTarget.dataset.pileId
      );
      if (moved) {
        selection = null;
        dragState = null;
        refreshUI(moved);
        return;
      }
    }
  }
  dragState = null;
});

// Double-click / double-tap auto-send to Foundation
boardEl.addEventListener('dblclick', (e) => {
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;
  const moved = engine.autoMoveToFoundation(
    cardEl.dataset.pileId,
    Number(cardEl.dataset.cardIndex)
  );
  if (moved) {
    selection = null;
    refreshUI(moved);
  }
});

gameSelect.addEventListener('change', () => loadVariant(gameSelect.value));
newGameBtn.addEventListener('click', () => startNewGame());
winNewGameBtn.addEventListener('click', () => startNewGame());
undoBtn.addEventListener('click', () => {
  selection = null;
  engine.undo();
  refreshUI();
});

init();
