import { GameEngine } from './engine.js';
import { Klondike } from './games/klondike.js';
import { FreeCell } from './games/freecell.js';
import { Spider } from './games/spider.js';
import { Easthaven } from './games/easthaven.js';
import { EightOff } from './games/eightoff.js';
import { renderBoard, createCardElement } from './renderer.js';

const VARIANTS = [Klondike, FreeCell, Spider, Easthaven, EightOff];
const engine = new GameEngine();

const boardEl = document.getElementById('board');
const gameSelect = document.getElementById('game-select');
const optionsEl = document.getElementById('variant-options');
const newGameBtn = document.getElementById('new-game-btn');
const hintBtn = document.getElementById('hint-btn');
const undoBtn = document.getElementById('undo-btn');
const moveCounter = document.getElementById('move-counter');
const winBanner = document.getElementById('win-banner');
const winStats = document.getElementById('win-stats');
const winNewGameBtn = document.getElementById('win-new-game-btn');
const statusBadge = document.getElementById('status-badge');
const versionEl = document.getElementById('app-version');
const autoFinishBtn = document.getElementById('auto-finish-btn');


let selection = null;
let hintTargetPileId = null;
let dragState = null;
let autoFinishTimer = null;

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

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isLocal) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('./sw.js')
      .then(reg => reg.update())
      .catch(() => {});
  }

  if (versionEl) {
    fetch('./sw.js', { cache: 'no-store' })
      .then(res => res.text())
      .then(text => {
        const match = text.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
        if (match) versionEl.textContent = match[1];
      })
      .catch(() => {});
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
  stopAutoFinish();
  selection = null;
  hintTargetPileId = null;
  winBanner.classList.add('hidden');
  engine.start(variant, config);
  refreshUI();
}

function refreshUI(movedCardIds = []) {
  const hint = engine.findHint();
  moveCounter.textContent = `Moves: ${engine.moves}`;
  undoBtn.disabled = engine.history.length === 0;
  hintBtn.disabled = !hint || engine.isWon();
  renderBoard(boardEl, engine, selection, movedCardIds, hintTargetPileId);

  if (autoFinishBtn) {
    autoFinishBtn.hidden = !engine.canAutoComplete();
  }

  if (engine.isWon()) {
    statusBadge.classList.add('hidden');
    winStats.textContent = `Completed ${engine.variant.name} in ${engine.moves} moves.`;
    winBanner.classList.remove('hidden');
  } else {
    statusBadge.classList.toggle('hidden', hint !== null);
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
    hintTargetPileId = null;
    const moved = engine.handleStockClick();
    refreshUI(moved || []);
    return;
  }

  // If something is already selected, try moving to this pile
  if (selection) {
    if (selection.pileId === pileId && selection.cardIndex === cardIndex) {
      selection = null;
      hintTargetPileId = null;
      refreshUI();
      return;
    }
    const moved = engine.moveCards(selection.pileId, selection.cardIndex, pileId);
    if (moved) {
      selection = null;
      hintTargetPileId = null;
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

hintBtn.addEventListener('click', () => {
  const stockEl = boardEl.querySelector('[data-pile-id="stock"]');
  const isHintActive =
    (selection !== null && hintTargetPileId !== null) ||
    Boolean(stockEl?.classList.contains('valid-target'));

  if (isHintActive) {
    selection = null;
    hintTargetPileId = null;
    refreshUI();
    return;
  }

  const hint = engine.findHint();
  if (!hint) return;

  if (hint.fromPileId === 'stock') {
    selection = null;
    hintTargetPileId = null;
    refreshUI();
    const updatedStockEl = boardEl.querySelector('[data-pile-id="stock"]');
    if (updatedStockEl) updatedStockEl.classList.add('valid-target');
    return;
  }

  selection = { pileId: hint.fromPileId, cardIndex: hint.cardIndex };
  hintTargetPileId = hint.toPileId;
  refreshUI();
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

function stopAutoFinish() {
  if (autoFinishTimer) {
    clearInterval(autoFinishTimer);
    autoFinishTimer = null;
  }
}

// Double-click / double-tap auto-send to Foundation
boardEl.addEventListener('dblclick', (e) => {
  if (autoFinishTimer) return;
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;
  const moved = engine.autoMoveToFoundation(
    cardEl.dataset.pileId,
    Number(cardEl.dataset.cardIndex)
  );
  if (moved) {
    selection = null;
    hintTargetPileId = null;
    refreshUI(moved);
  }
});

if (autoFinishBtn) {
  autoFinishBtn.addEventListener('click', () => {
    if (autoFinishTimer) return;
    autoFinishBtn.hidden = true;

    autoFinishTimer = setInterval(() => {
      const moved = engine.moveNextToFoundation();
      if (!moved) {
        stopAutoFinish();
        refreshUI();
        return;
      }
      selection = null;
      hintTargetPileId = null;
      refreshUI(moved);
    }, 80);
  });
}

gameSelect.addEventListener('change', () => loadVariant(gameSelect.value));
newGameBtn.addEventListener('click', () => startNewGame());
winNewGameBtn.addEventListener('click', () => startNewGame());
undoBtn.addEventListener('click', () => {
  stopAutoFinish();
  selection = null;
  hintTargetPileId = null;
  engine.undo();
  refreshUI();
});

window.addEventListener('resize', () => refreshUI());

init();
