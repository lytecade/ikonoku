// ============================================================
// Ikonoku — Cyberpunk Color Sudoku
// Pure HTML5 Canvas + JavaScript, no external libraries
// ============================================================

(function () {
  "use strict";

  // ---- Polyfill: roundRect ----
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (typeof r === "number") r = [r, r, r, r];
      var rtl = r[0] || 0, rtr = r[1] || 0, rbr = r[2] || 0, rbl = r[3] || 0;
      this.moveTo(x + rtl, y);
      this.lineTo(x + w - rtr, y);
      this.quadraticCurveTo(x + w, y, x + w, y + rtr);
      this.lineTo(x + w, y + h - rbr);
      this.quadraticCurveTo(x + w, y + h, x + w - rbr, y + h);
      this.lineTo(x + rbl, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - rbl);
      this.lineTo(x, y + rtl);
      this.quadraticCurveTo(x, y, x + rtl, y);
      this.closePath();
      return this;
    };
  }

  // ---- Arne16 Palette ----
  var COLORS = {
    black:       "#000000",
    gray:        "#9D9D9D",
    white:       "#FFFFFF",
    crimson:     "#BE2633",
    rose:        "#E06F8B",
    brown:       "#493C2B",
    amber:       "#A46422",
    orange:      "#EB8931",
    yellow:      "#F7E26B",
    slate:       "#2F484E",
    green:       "#44891A",
    lime:        "#A3CE27",
    navy:        "#1B2632",
    steelBlue:   "#005784",
    skyBlue:     "#31A2F2",
    iceBlue:     "#B2DCF0",
  };

  // 9 playable color blocks
  var GAME_COLORS = [
    COLORS.crimson,   // 1
    COLORS.rose,      // 2
    COLORS.amber,     // 3
    COLORS.orange,    // 4
    COLORS.yellow,    // 5
    COLORS.green,     // 6
    COLORS.lime,      // 7
    COLORS.steelBlue, // 8
    COLORS.skyBlue,   // 9
  ];

  // ---- Game States ----
  var STATE_TITLE = 0;
  var STATE_DIFFICULTY = 1;
  var STATE_PLAYING = 2;
  var STATE_WIN = 3;

  // ---- Timing Constants (ms) ----
  var HOLD_CLEAR_DURATION = 2000;
  var HOLD_VISUAL_DELAY = 120;
  var FLASH_DURATION = 520;
  var CLEAR_EFFECT_DURATION = 380;

  // ---- Difficulty Config ----
  var DIFF_CONFIG = {
    Easy:   { removed: 30, label: "EASY" },
    Medium: { removed: 45, label: "MEDIUM" },
    Hard:   { removed: 55, label: "HARD" },
  };
  var DIFF_KEYS = ["Easy", "Medium", "Hard"];
  var DIFF_LABELS = ["EASY", "MEDIUM", "HARD"];
  var DIFF_DESCS  = ["~51 clues shown", "~36 clues shown", "~26 clues shown"];
  var DIFF_COLORS = [COLORS.lime, COLORS.orange, COLORS.crimson];

  // ---- Canvas & Context ----
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  // ---- Game State Variables ----
  var gameState = STATE_TITLE;
  var difficulty = "Medium";
  var solvedBoard = [];
  var puzzleBoard = [];
  var initialBoard = [];
  var cellGrid = [];

  var selectedColor = 1;
  var cursorRow = 0;
  var cursorCol = 0;
  var paletteCursor = 0;

  // Input focus: "grid" or "palette"
  var inputFocus = "grid";

  var totalCells = 81;
  var filledCells = 0;
  var difficultyCursor = 1; // start at Medium

  // Feedback & hold-to-clear state
  var flashCell = null;
  var conflictCells = [];
  var flashRemainingMs = 0;
  var clearEffect = null;
  var statusHint = null;
  var pointerState = null;
  var holdState = null;

  var layout = null;
  var lastFrameTime = 0;

  // ---- Utilities ----

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function showStatusHint(text, color, durationMs) {
    statusHint = {
      text: text,
      color: color || COLORS.iceBlue,
      remainingMs: durationMs || 1400,
    };
  }

  // ---- Sudoku Generation & Validation ----

  function isValid(board, row, col, num) {
    for (var c = 0; c < 9; c++) { if (board[row][c] === num) return false; }
    for (var r = 0; r < 9; r++) { if (board[r][col] === num) return false; }
    var br = Math.floor(row / 3) * 3;
    var bc = Math.floor(col / 3) * 3;
    for (var i = br; i < br + 3; i++) {
      for (var j = bc; j < bc + 3; j++) {
        if (board[i][j] === num) return false;
      }
    }
    return true;
  }

  function getConflicts(board, row, col, num) {
    var seen = {};
    var conflicts = [];
    function addConflict(r, c) {
      if (r === row && c === col) return;
      var key = r + "," + c;
      if (!seen[key] && board[r][c] === num) {
        seen[key] = true;
        conflicts.push({ row: r, col: c });
      }
    }
    for (var c = 0; c < 9; c++) addConflict(row, c);
    for (var r = 0; r < 9; r++) addConflict(r, col);
    var br = Math.floor(row / 3) * 3;
    var bc = Math.floor(col / 3) * 3;
    for (var i = br; i < br + 3; i++) {
      for (var j = bc; j < bc + 3; j++) {
        addConflict(i, j);
      }
    }
    return conflicts;
  }

  function solveSudoku(board) {
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          var nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
          shuffle(nums);
          for (var n = 0; n < nums.length; n++) {
            if (isValid(board, r, c, nums[n])) {
              board[r][c] = nums[n];
              if (solveSudoku(board)) return true;
              board[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function generateSolvedBoard() {
    var board = [];
    for (var i = 0; i < 9; i++) {
      board[i] = [];
      for (var j = 0; j < 9; j++) { board[i][j] = 0; }
    }
    solveSudoku(board);
    return board;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  function createPuzzle(solved, removedCount) {
    var puzzle = [];
    for (var r = 0; r < 9; r++) {
      puzzle[r] = [];
      for (var c = 0; c < 9; c++) { puzzle[r][c] = solved[r][c]; }
    }
    var positions = [];
    for (var i = 0; i < 81; i++) {
      positions.push([Math.floor(i / 9), i % 9]);
    }
    shuffle(positions);
    var removed = 0;
    for (var k = 0; k < positions.length && removed < removedCount; k++) {
      puzzle[positions[k][0]][positions[k][1]] = 0;
      removed++;
    }
    return puzzle;
  }

  function initGame() {
    solvedBoard = generateSolvedBoard();
    puzzleBoard = createPuzzle(solvedBoard, DIFF_CONFIG[difficulty].removed);
    initialBoard = [];
    cellGrid = [];
    filledCells = 0;
    for (var r = 0; r < 9; r++) {
      initialBoard[r] = [];
      cellGrid[r] = [];
      for (var c = 0; c < 9; c++) {
        initialBoard[r][c] = puzzleBoard[r][c];
        cellGrid[r][c] = puzzleBoard[r][c];
        if (puzzleBoard[r][c] !== 0) filledCells++;
      }
    }
    cursorRow = 0;
    cursorCol = 0;
    var foundInitial = false;
    for (var rr = 0; rr < 9 && !foundInitial; rr++) {
      for (var cc = 0; cc < 9 && !foundInitial; cc++) {
        if (puzzleBoard[rr][cc] === 0) {
          cursorRow = rr;
          cursorCol = cc;
          foundInitial = true;
        }
      }
    }
    selectedColor = 1;
    paletteCursor = 0;
    inputFocus = "grid";
    flashCell = null;
    conflictCells = [];
    flashRemainingMs = 0;
    clearEffect = null;
    statusHint = null;
    pointerState = null;
    holdState = null;
  }

  // ---- Dynamic Full-Viewport Layout Engine ----

  function expandHitRect(rect, padX, padY, bounds) {
    var x0 = Math.max(bounds.x, rect.x - padX);
    var y0 = Math.max(bounds.y, rect.y - padY);
    var x1 = Math.min(bounds.x + bounds.w, rect.x + rect.w + padX);
    var y1 = Math.min(bounds.y + bounds.h, rect.y + rect.h + padY);
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  function recalcLayout(force) {
    var vw = Math.max(1, Math.floor(window.innerWidth));
    var vh = Math.max(1, Math.floor(window.innerHeight));
    var dpr = Math.min(window.devicePixelRatio || 1, 3);

    if (!force && layout && layout.w === vw && layout.h === vh && layout.dpr === dpr) {
      return;
    }

    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var minDim = Math.min(vw, vh);
    var maxDim = Math.max(vw, vh);
    var isLandscape = vw > vh * 1.15;
    var topBarH = Math.round(clamp(vh * 0.068, 34, 56));

    var layoutMode = isLandscape ? "landscape" : "portrait";
    var paletteLayout = "row9";
    var boardX, boardY, boardSize, cellSize, gap, panelRect;
    var panelHeaderH, panelFooterH;
    var paletteRects = [];
    var paletteHitRects = [];

    if (isLandscape) {
      paletteLayout = "grid3x3";
      var padX = Math.round(clamp(vw * 0.025, 10, 32));
      var padY = Math.round(clamp((vh - topBarH) * 0.04, 8, 24));
      gap = Math.round(clamp(vw * 0.025, 12, 32));

      var availW = vw - padX * 2;
      var availH = vh - topBarH - padY * 2;
      var panelMinW = Math.round(clamp(availH * 0.56, 150, 300));
      var maxBoardW = Math.max(108, availW - panelMinW - gap);
      var rawBoardSize = Math.min(availH, maxBoardW);

      cellSize = Math.max(12, Math.floor(rawBoardSize / 9));
      boardSize = cellSize * 9;

      var panelW = Math.round(clamp(Math.min(boardSize * 0.72, availW - boardSize - gap), 150, 400));
      var panelH = boardSize;
      var groupW = boardSize + gap + panelW;

      boardX = Math.round((vw - groupW) / 2);
      boardY = Math.round(topBarH + (vh - topBarH - boardSize) / 2);
      panelRect = {
        x: boardX + boardSize + gap,
        y: boardY,
        w: panelW,
        h: panelH,
      };

      var panelPad = Math.round(clamp(panelW * 0.06, 8, 18));
      panelHeaderH = Math.round(clamp(panelH * 0.11, 24, 42));
      panelFooterH = Math.round(clamp(panelH * 0.16, 34, 58));

      var gridAvailW = panelW - panelPad * 2;
      var gridAvailH = Math.max(60, panelH - panelHeaderH - panelFooterH - panelPad);
      var gridSide = Math.min(gridAvailW, gridAvailH);
      var pitch = gridSide / 3;
      var swatchGap = Math.round(clamp(pitch * 0.14, 4, 12));
      var swatchSize = Math.max(18, Math.floor(pitch - swatchGap));
      var actualGrid = swatchSize * 3 + swatchGap * 2;

      var gridStartX = Math.round(panelRect.x + (panelW - actualGrid) / 2);
      var gridMidTop = panelRect.y + panelHeaderH;
      var gridMidH = panelH - panelHeaderH - panelFooterH;
      var gridStartY = Math.round(gridMidTop + Math.max(0, (gridMidH - actualGrid) / 2));

      var hitPad = Math.floor(swatchGap / 2);
      for (var gi = 0; gi < 9; gi++) {
        var gr = Math.floor(gi / 3);
        var gc = gi % 3;
        var sRect = {
          x: gridStartX + gc * (swatchSize + swatchGap),
          y: gridStartY + gr * (swatchSize + swatchGap),
          w: swatchSize,
          h: swatchSize,
        };
        paletteRects.push(sRect);
        paletteHitRects.push(expandHitRect(sRect, hitPad, hitPad, panelRect));
      }
    } else {
      var pPadX = Math.round(clamp(vw * 0.03, 8, 28));
      var pPadY = Math.round(clamp((vh - topBarH) * 0.02, 8, 20));
      gap = Math.round(clamp((vh - topBarH) * 0.02, 8, 20));

      var pAvailW = vw - pPadX * 2;
      var pAvailH = vh - topBarH - pPadY * 2;

      if (pAvailW < 480 && (pAvailH - pAvailW) >= 165) {
        paletteLayout = "rows54";
      } else {
        paletteLayout = "row9";
      }

      var minPaletteH = (paletteLayout === "rows54")
        ? 150
        : Math.round(clamp(pAvailH * 0.17, 96, 145));
      var maxPaletteH = (paletteLayout === "rows54") ? 232 : 160;

      var pRawBoardSize = Math.min(pAvailW, Math.max(108, pAvailH - gap - minPaletteH));
      cellSize = Math.max(12, Math.floor(pRawBoardSize / 9));
      boardSize = cellSize * 9;

      var remH = Math.max(minPaletteH, pAvailH - boardSize - gap);
      var palettePanelH = Math.round(clamp(remH, minPaletteH, maxPaletteH));
      if (boardSize + gap + palettePanelH > pAvailH) {
        palettePanelH = Math.max(88, pAvailH - boardSize - gap);
      }

      var totalH = boardSize + gap + palettePanelH;
      boardX = Math.round((vw - boardSize) / 2);
      boardY = Math.round(topBarH + pPadY + Math.max(0, (pAvailH - totalH) / 2));

      var pPanelW = (paletteLayout === "rows54")
        ? pAvailW
        : Math.min(pAvailW, Math.max(boardSize, Math.min(pAvailW, 640)));

      panelRect = {
        x: Math.round((vw - pPanelW) / 2),
        y: boardY + boardSize + gap,
        w: pPanelW,
        h: palettePanelH,
      };

      var pInnerPadX = Math.round(clamp(pPanelW * 0.03, 8, 16));
      panelHeaderH = Math.round(clamp(palettePanelH * 0.16, 20, 30));
      panelFooterH = Math.round(clamp(palettePanelH * 0.15, 20, 28));
      var innerW = pPanelW - pInnerPadX * 2;
      var innerH = Math.max(36, palettePanelH - panelHeaderH - panelFooterH - 8);
      var midTop = panelRect.y + panelHeaderH;
      var midH = palettePanelH - panelHeaderH - panelFooterH;

      if (paletteLayout === "rows54") {
        var colGap54 = Math.round(clamp(innerW * 0.025, 6, 12));
        var rowGap54 = Math.round(clamp(innerH * 0.08, 6, 12));
        var swW54 = Math.floor((innerW - colGap54 * 4) / 5);
        var swH54 = Math.floor((innerH - rowGap54) / 2);
        var sw54 = Math.max(24, Math.min(swW54, swH54, 68));

        var rowsTotalH = 2 * sw54 + rowGap54;
        var row0Y = Math.round(midTop + Math.max(0, (midH - rowsTotalH) / 2));
        var row1Y = row0Y + sw54 + rowGap54;

        var row0W = 5 * sw54 + 4 * colGap54;
        var row0StartX = Math.round(panelRect.x + (pPanelW - row0W) / 2);
        var row1W = 4 * sw54 + 3 * colGap54;
        var row1StartX = Math.round(panelRect.x + (pPanelW - row1W) / 2);

        var padX54 = Math.floor(colGap54 / 2);
        var padY54 = Math.floor(rowGap54 / 2);

        for (var i0 = 0; i0 < 5; i0++) {
          var r0 = {
            x: row0StartX + i0 * (sw54 + colGap54),
            y: row0Y,
            w: sw54,
            h: sw54,
          };
          paletteRects.push(r0);
          paletteHitRects.push(expandHitRect(r0, padX54, padY54, panelRect));
        }
        for (var i1 = 0; i1 < 4; i1++) {
          var r1 = {
            x: row1StartX + i1 * (sw54 + colGap54),
            y: row1Y,
            w: sw54,
            h: sw54,
          };
          paletteRects.push(r1);
          paletteHitRects.push(expandHitRect(r1, padX54, padY54, panelRect));
        }
      } else {
        var colGap9 = Math.round(clamp(innerW * 0.015, 4, 10));
        var swW9 = Math.floor((innerW - colGap9 * 8) / 9);
        var sw9 = Math.max(22, Math.min(swW9, innerH - 4, 72));
        var rowW9 = 9 * sw9 + 8 * colGap9;
        var rowStartX9 = Math.round(panelRect.x + (pPanelW - rowW9) / 2);
        var rowStartY9 = Math.round(midTop + Math.max(0, (midH - sw9) / 2));
        var padX9 = Math.floor(colGap9 / 2);
        var padY9 = Math.max(4, Math.floor((midH - sw9) / 2));

        for (var j = 0; j < 9; j++) {
          var r9 = {
            x: rowStartX9 + j * (sw9 + colGap9),
            y: rowStartY9,
            w: sw9,
            h: sw9,
          };
          paletteRects.push(r9);
          paletteHitRects.push(expandHitRect(r9, padX9, padY9, panelRect));
        }
      }
    }

    // Difficulty screen cards
    var difficultyLayout = (vw > vh * 1.35) ? "horizontal" : "vertical";
    var difficultyRects = [];
    if (difficultyLayout === "horizontal") {
      var dAreaW = Math.round(clamp(vw * 0.86, 320, 860));
      var dGapH = Math.round(clamp(vw * 0.025, 12, 28));
      var dCardW = Math.min(260, Math.floor((dAreaW - dGapH * 2) / 3));
      var dCardH = Math.round(clamp(vh * 0.34, 86, 170));
      var dTotalW = dCardW * 3 + dGapH * 2;
      var dStartX = Math.round((vw - dTotalW) / 2);
      var dMinY = Math.round(vh * 0.24);
      var dMaxBottom = vh - Math.max(44, Math.round(vh * 0.13));
      var dY = Math.round(clamp(vh * 0.52 - dCardH / 2, dMinY, Math.max(dMinY, dMaxBottom - dCardH)));
      for (var dh = 0; dh < 3; dh++) {
        difficultyRects.push({
          x: dStartX + dh * (dCardW + dGapH),
          y: dY,
          w: dCardW,
          h: dCardH,
        });
      }
    } else {
      var dvCardW = Math.round(clamp(vw * 0.68, 220, 440));
      var dvTop = Math.round(vh * 0.23);
      var dvBottom = Math.round(vh * 0.85);
      var dvAvail = Math.max(180, dvBottom - dvTop);
      var dvGap = Math.round(clamp(dvAvail * 0.07, 10, 24));
      var dvCardH = Math.round(clamp((dvAvail - dvGap * 2) / 3, 54, 118));
      var dvStackH = dvCardH * 3 + dvGap * 2;
      var dvStartY = Math.round(dvTop + Math.max(0, (dvAvail - dvStackH) / 2));
      var dvX = Math.round((vw - dvCardW) / 2);
      for (var dv = 0; dv < 3; dv++) {
        difficultyRects.push({
          x: dvX,
          y: dvStartY + dv * (dvCardH + dvGap),
          w: dvCardW,
          h: dvCardH,
        });
      }
    }

    layout = {
      w: vw,
      h: vh,
      dpr: dpr,
      minDim: minDim,
      maxDim: maxDim,
      s: minDim,
      isLandscape: isLandscape,
      layoutMode: layoutMode,
      paletteLayout: paletteLayout,
      topBarH: topBarH,
      boardX: boardX,
      boardY: boardY,
      boardSize: boardSize,
      cellSize: cellSize,
      gap: gap,
      panelRect: panelRect,
      panelHeaderH: panelHeaderH,
      panelFooterH: panelFooterH,
      paletteRects: paletteRects,
      paletteHitRects: paletteHitRects,
      difficultyLayout: difficultyLayout,
      difficultyRects: difficultyRects,
    };
    window._layout = layout;
  }

  // ---- Drawing Helpers ----

  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  }

  function drawRoundRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, typeof r === "number" ? r : r[0]);
    ctx.fill();
  }

  function drawText(text, x, y, fontSize, color, align) {
    var fs = Math.max(8, Math.round(fontSize));
    ctx.fillStyle = color;
    ctx.font = "bold " + fs + 'px "Courier New", monospace';
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  function drawTextOutline(text, x, y, fontSize, outlineColor, fillColor, align) {
    var fs = Math.max(10, Math.round(fontSize));
    ctx.save();
    ctx.font = "bold " + fs + 'px "Courier New", monospace';
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = Math.max(2, fs / 8);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fillColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawScanlines() {
    var L = layout;
    var step = L.minDim > 600 ? 4 : 3;
    ctx.fillStyle = "rgba(0,0,0,0.055)";
    for (var i = 0; i < L.h; i += step) {
      ctx.fillRect(0, i, L.w, 1);
    }
  }

  function drawCorners(color) {
    var L = layout;
    var m = Math.round(clamp(L.minDim * 0.035, 10, 26));
    var cs = Math.round(clamp(L.minDim * 0.055, 16, 40));
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.round(L.minDim * 0.004));
    // TL
    ctx.beginPath();
    ctx.moveTo(m, m + cs); ctx.lineTo(m, m); ctx.lineTo(m + cs, m);
    ctx.stroke();
    // TR
    ctx.beginPath();
    ctx.moveTo(L.w - m - cs, m); ctx.lineTo(L.w - m, m); ctx.lineTo(L.w - m, m + cs);
    ctx.stroke();
    // BL
    ctx.beginPath();
    ctx.moveTo(m, L.h - m - cs); ctx.lineTo(m, L.h - m); ctx.lineTo(m + cs, L.h - m);
    ctx.stroke();
    // BR
    ctx.beginPath();
    ctx.moveTo(L.w - m - cs, L.h - m); ctx.lineTo(L.w - m, L.h - m); ctx.lineTo(L.w - m, L.h - m - cs);
    ctx.stroke();
  }

  function drawGridPattern() {
    var L = layout;
    ctx.strokeStyle = "rgba(49,162,242,0.07)";
    ctx.lineWidth = 1;
    var step = Math.max(22, Math.round(L.minDim * 0.045));
    for (var x = 0; x < L.w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, L.h); ctx.stroke();
    }
    for (var y = 0; y < L.h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(L.w, y); ctx.stroke();
    }
  }

  // ---- Draw Title Screen ----

  function drawTitleScreen(now) {
    var L = layout;
    var cx = L.w / 2;
    var t = now * 0.001;

    drawRect(0, 0, L.w, L.h, COLORS.navy);
    drawGridPattern();

    // Animated circuit lines
    ctx.strokeStyle = "rgba(163,206,39,0.12)";
    ctx.lineWidth = 2;
    for (var i = 0; i < 5; i++) {
      var sx = (Math.sin(t * 0.7 + i * 1.3) * 0.5 + 0.5) * L.w;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, L.h); ctx.stroke();
    }

    // Title glow
    var titleSize = Math.round(clamp(Math.min(L.w * 0.16, L.h * 0.24), 32, 130));
    var titleY = Math.round(L.h * 0.38);
    var pulse = Math.sin(t * 2) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = COLORS.skyBlue;
    ctx.shadowBlur = 22 * pulse;
    drawTextOutline("IKONOKU", cx, titleY, titleSize, COLORS.skyBlue, COLORS.white);
    ctx.restore();

    // Blinking prompt
    var promptY = Math.round(L.h * 0.60);
    if (Math.sin(t * 3) > 0) {
      var promptSize = Math.round(clamp(Math.min(L.w * 0.036, L.h * 0.055), 11, 24));
      drawText("[ PRESS ANY KEY / TAP TO START ]", cx, promptY, promptSize, COLORS.skyBlue);
    }

    // Color preview row
    var blockGap = Math.round(clamp(L.w * 0.012, 3, 12));
    var bs = Math.round(clamp(Math.min((L.w * 0.72 - blockGap * 8) / 9, L.h * 0.075), 14, 34));
    var rowW = 9 * bs + 8 * blockGap;
    var rowStartX = cx - rowW / 2;
    var baseY = Math.round(Math.min(L.h * 0.76, L.h - bs - Math.max(24, L.h * 0.08)));

    for (var b = 0; b < 9; b++) {
      var bx = rowStartX + b * (bs + blockGap);
      var by = baseY + Math.sin(t * 2 + b * 0.5) * bs * 0.14;
      drawRoundRect(bx, by, bs, bs, bs * 0.18, GAME_COLORS[b]);
    }

    drawCorners(COLORS.skyBlue);
    drawScanlines();
  }

  // ---- Draw Difficulty Screen ----

  function drawDifficultyScreen(now) {
    var L = layout;
    var cx = L.w / 2;
    var t = now * 0.001;

    drawRect(0, 0, L.w, L.h, COLORS.navy);
    drawGridPattern();

    // Title
    var titleSize = Math.round(clamp(Math.min(L.w * 0.068, L.h * 0.09), 20, 50));
    drawTextOutline("SELECT DIFFICULTY", cx, Math.round(L.h * 0.14), titleSize, COLORS.iceBlue, COLORS.white);

    // Cards
    for (var i = 0; i < 3; i++) {
      var r = L.difficultyRects[i];
      var isActive = (difficultyCursor === i);
      var radius = Math.round(clamp(Math.min(r.w, r.h) * 0.16, 8, 18));
      var labelSize = Math.round(clamp(Math.min(r.w * 0.16, r.h * 0.34), 16, 30));
      var descSize = Math.round(clamp(Math.min(r.w * 0.095, r.h * 0.17), 11, 16));
      var cardCx = r.x + r.w / 2;

      if (isActive) {
        ctx.save();
        ctx.shadowColor = DIFF_COLORS[i];
        ctx.shadowBlur = 16;
        drawRoundRect(r.x, r.y, r.w, r.h, radius, DIFF_COLORS[i]);
        ctx.restore();
        drawText(DIFF_LABELS[i], cardCx, r.y + r.h * 0.38, labelSize, COLORS.black);
        drawText(DIFF_DESCS[i], cardCx, r.y + r.h * 0.70, descSize, COLORS.navy);
      } else {
        drawRoundRect(r.x, r.y, r.w, r.h, radius, COLORS.slate);
        ctx.strokeStyle = DIFF_COLORS[i];
        ctx.lineWidth = Math.max(2, Math.round(L.minDim * 0.003));
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, radius);
        ctx.stroke();
        drawText(DIFF_LABELS[i], cardCx, r.y + r.h * 0.38, labelSize, DIFF_COLORS[i]);
        drawText(DIFF_DESCS[i], cardCx, r.y + r.h * 0.70, descSize, COLORS.iceBlue);
      }
    }

    // Hint
    if (Math.sin(t * 3) > 0) {
      var hintSize = Math.round(clamp(Math.min(L.w * 0.032, L.h * 0.042), 11, 18));
      var hintY = L.h - Math.max(24, Math.round(L.h * 0.075));
      drawText("[ TAP / CLICK OR ARROWS + ENTER ]", cx, hintY, hintSize, COLORS.gray);
    }

    drawCorners(COLORS.skyBlue);
    drawScanlines();
  }

  // ---- Draw Game Board ----

  function drawGameScreen(now) {
    var L = layout;
    var t = now * 0.001;

    drawRect(0, 0, L.w, L.h, COLORS.navy);

    // ---- Top Info Bar ----
    drawRect(0, 0, L.w, L.topBarH, COLORS.slate);
    ctx.fillStyle = "rgba(49,162,242,0.28)";
    ctx.fillRect(0, L.topBarH - 1, L.w, 1);

    var infoSize = Math.round(clamp(Math.min(L.w * 0.034, L.topBarH * 0.42), 11, 20));
    var barPadX = Math.max(12, Math.round(L.w * 0.025));
    drawText("IKONOKU — " + DIFF_CONFIG[difficulty].label, barPadX, L.topBarH / 2, infoSize, COLORS.iceBlue, "left");
    drawText("FILLED: " + filledCells + "/" + totalCells, L.w - barPadX, L.topBarH / 2, infoSize, COLORS.yellow, "right");

    // ---- Board Border ----
    drawRect(L.boardX - 2, L.boardY - 2, L.boardSize + 4, L.boardSize + 4, COLORS.gray);

    // ---- Grid Cells ----
    var cs = L.cellSize;
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var x = L.boardX + c * cs;
        var y = L.boardY + r * cs;
        var val = cellGrid[r][c];
        var isClue = initialBoard[r][c] !== 0;

        if (val !== 0) {
          drawRect(x, y, cs, cs, GAME_COLORS[val - 1]);
          if (isClue) {
            // Anchored visual motif for fixed initial clues
            ctx.fillStyle = "rgba(0,0,0,0.20)";
            ctx.fillRect(x + cs * 0.08, y + cs * 0.08, cs * 0.84, cs * 0.84);
            var pip = Math.max(3, Math.round(cs * 0.14));
            ctx.fillStyle = "rgba(0,0,0,0.26)";
            ctx.fillRect(x + (cs - pip) / 2, y + (cs - pip) / 2, pip, pip);
          } else {
            // Bright inner highlight + corner mark for player-placed (clearable) tiles
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fillRect(x + cs * 0.1, y + cs * 0.1, cs * 0.8, cs * 0.8);
            var cornerSz = Math.max(4, cs * 0.17);
            ctx.fillStyle = "rgba(255,255,255,0.52)";
            ctx.beginPath();
            ctx.moveTo(x + cs - cornerSz - 1, y + 1);
            ctx.lineTo(x + cs - 1, y + 1);
            ctx.lineTo(x + cs - 1, y + cornerSz + 1);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          drawRect(x, y, cs, cs, ((r + c) % 2 === 0) ? COLORS.navy : "#152029");
        }

        // Thin cell border
        ctx.strokeStyle = "rgba(157,157,157,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
      }
    }

    // ---- Clear Confirmation Effect ----
    if (clearEffect && clearEffect.remainingMs > 0) {
      var cRatio = clearEffect.remainingMs / clearEffect.durationMs;
      var cex = L.boardX + clearEffect.col * cs;
      var cey = L.boardY + clearEffect.row * cs;
      ctx.save();
      ctx.fillStyle = "rgba(178,220,240," + (cRatio * 0.45).toFixed(3) + ")";
      ctx.fillRect(cex + 2, cey + 2, cs - 4, cs - 4);
      ctx.strokeStyle = COLORS.iceBlue;
      ctx.globalAlpha = cRatio;
      ctx.lineWidth = Math.max(2, cs * 0.08);
      ctx.strokeRect(cex + 2, cey + 2, cs - 4, cs - 4);
      ctx.restore();
    }

    // ---- Thick 3x3 box borders ----
    var thick = Math.max(2, Math.round(cs * 0.055));
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = thick;
    for (var vc = 0; vc <= 9; vc++) {
      if (vc % 3 === 0) {
        var vx = L.boardX + vc * cs;
        ctx.beginPath(); ctx.moveTo(vx, L.boardY); ctx.lineTo(vx, L.boardY + L.boardSize); ctx.stroke();
      }
    }
    for (var vh = 0; vh <= 9; vh++) {
      if (vh % 3 === 0) {
        var vy = L.boardY + vh * cs;
        ctx.beginPath(); ctx.moveTo(L.boardX, vy); ctx.lineTo(L.boardX + L.boardSize, vy); ctx.stroke();
      }
    }

    // ---- Invalid Placement Flash & Conflict Highlight ----
    if (flashCell && flashRemainingMs > 0) {
      var fRatio = flashRemainingMs / FLASH_DURATION;
      var fx = L.boardX + flashCell.col * cs;
      var fy = L.boardY + flashCell.row * cs;
      ctx.fillStyle = "rgba(190,38,51," + (fRatio * 0.55).toFixed(3) + ")";
      ctx.fillRect(fx, fy, cs, cs);

      // Draw crisp crimson X inside rejected cell
      ctx.save();
      ctx.strokeStyle = COLORS.white;
      ctx.globalAlpha = Math.min(1, fRatio * 1.2);
      ctx.lineWidth = Math.max(2, cs * 0.09);
      ctx.lineCap = "round";
      var padXMark = cs * 0.28;
      ctx.beginPath();
      ctx.moveTo(fx + padXMark, fy + padXMark);
      ctx.lineTo(fx + cs - padXMark, fy + cs - padXMark);
      ctx.moveTo(fx + cs - padXMark, fy + padXMark);
      ctx.lineTo(fx + padXMark, fy + cs - padXMark);
      ctx.stroke();
      ctx.restore();

      // Highlight conflicting tiles causing the rule violation
      for (var cf = 0; cf < conflictCells.length; cf++) {
        var cCell = conflictCells[cf];
        var cfx = L.boardX + cCell.col * cs;
        var cfy = L.boardY + cCell.row * cs;
        ctx.save();
        ctx.strokeStyle = COLORS.crimson;
        ctx.globalAlpha = Math.min(1, fRatio * 1.2);
        ctx.lineWidth = Math.max(3, cs * 0.1);
        ctx.strokeRect(cfx + 2, cfy + 2, cs - 4, cs - 4);
        ctx.restore();
      }
    }

    // ---- Cursor Highlight ----
    var curX = L.boardX + cursorCol * cs;
    var curY = L.boardY + cursorRow * cs;
    var pulseAlpha = 0.22 + Math.sin(t * 4) * 0.10;
    ctx.fillStyle = "rgba(178,220,240," + pulseAlpha.toFixed(3) + ")";
    ctx.fillRect(curX + 1, curY + 1, cs - 2, cs - 2);
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = Math.max(2, cs * 0.05);
    ctx.strokeRect(curX + 1, curY + 1, cs - 2, cs - 2);

    // ---- Hold-to-Clear Radial Progress Overlay ----
    if (holdState) {
      var holdElapsed = now - holdState.startTime;
      if (holdElapsed >= HOLD_VISUAL_DELAY) {
        var visProgress = clamp(
          (holdElapsed - HOLD_VISUAL_DELAY) / (HOLD_CLEAR_DURATION - HOLD_VISUAL_DELAY),
          0,
          1
        );
        var hx = L.boardX + holdState.col * cs;
        var hy = L.boardY + holdState.row * cs;
        var hcx = hx + cs / 2;
        var hcy = hy + cs / 2;

        // Progressive darkening veil
        ctx.fillStyle = "rgba(27,38,50," + (0.18 + visProgress * 0.45).toFixed(3) + ")";
        ctx.fillRect(hx + 1, hy + 1, cs - 2, cs - 2);

        // Ring backing
        var radius = Math.max(8, cs * 0.34);
        var ringWidth = Math.max(3, cs * 0.095);
        ctx.save();
        ctx.beginPath();
        ctx.arc(hcx, hcy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = ringWidth;
        ctx.stroke();

        // Active sweep arc
        ctx.shadowColor = COLORS.skyBlue;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(hcx, hcy, radius, -Math.PI / 2, -Math.PI / 2 + visProgress * Math.PI * 2);
        ctx.strokeStyle = COLORS.white;
        ctx.lineCap = "round";
        ctx.lineWidth = ringWidth;
        ctx.stroke();
        ctx.restore();

        // Centered X glyph inside the ring
        var xArm = Math.max(3, radius * 0.38);
        ctx.save();
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = Math.max(2, cs * 0.065);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hcx - xArm, hcy - xArm);
        ctx.lineTo(hcx + xArm, hcy + xArm);
        ctx.moveTo(hcx + xArm, hcy - xArm);
        ctx.lineTo(hcx - xArm, hcy + xArm);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ---- Color Palette Panel ----
    var pRect = L.panelRect;
    var pRadius = Math.round(clamp(Math.min(pRect.w, pRect.h) * 0.05, 8, 16));
    drawRoundRect(pRect.x, pRect.y, pRect.w, pRect.h, pRadius, "#152029");
    ctx.strokeStyle = (inputFocus === "palette") ? COLORS.skyBlue : "rgba(157,157,157,0.28)";
    ctx.lineWidth = (inputFocus === "palette") ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(pRect.x + 0.5, pRect.y + 0.5, pRect.w - 1, pRect.h - 1, pRadius);
    ctx.stroke();

    // Panel Header
    var headerSize = Math.round(clamp(Math.min(pRect.w * 0.075, L.panelHeaderH * 0.55), 11, 16));
    var palLabel = "SELECT COLOR" + (inputFocus === "palette" ? " \u25B6" : "");
    drawText(
      palLabel,
      pRect.x + pRect.w / 2,
      pRect.y + L.panelHeaderH * 0.54,
      headerSize,
      inputFocus === "palette" ? COLORS.skyBlue : COLORS.iceBlue
    );

    // Palette Swatches
    for (var i = 0; i < 9; i++) {
      var sr = L.paletteRects[i];
      var sRad = Math.round(clamp(sr.w * 0.16, 4, 12));
      var isSelected = (i === paletteCursor);

      if (isSelected) {
        ctx.save();
        ctx.shadowColor = GAME_COLORS[i];
        ctx.shadowBlur = 14;
        drawRoundRect(sr.x, sr.y, sr.w, sr.h, sRad, GAME_COLORS[i]);
        ctx.restore();
      } else {
        drawRoundRect(sr.x, sr.y, sr.w, sr.h, sRad, GAME_COLORS[i]);
      }

      if (isSelected) {
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = Math.max(2, Math.round(sr.w * 0.065));
        ctx.beginPath();
        ctx.roundRect(sr.x + 1, sr.y + 1, sr.w - 2, sr.h - 2, sRad);
        ctx.stroke();

        // Inner highlight ring for unmistakable active color cue
        ctx.strokeStyle = "rgba(27,38,50,0.75)";
        ctx.lineWidth = Math.max(1, Math.round(sr.w * 0.03));
        ctx.beginPath();
        ctx.roundRect(sr.x + 3.5, sr.y + 3.5, sr.w - 7, sr.h - 7, Math.max(2, sRad - 2));
        ctx.stroke();
      }

      // Corner number badge (1-9) with high-contrast dark pill
      var badgeFont = Math.round(clamp(sr.w * 0.28, 9, 15));
      var badgeW = Math.round(badgeFont * 1.15);
      var badgeH = Math.round(badgeFont * 1.15);
      var badgeX = sr.x + sr.w - badgeW - Math.max(2, Math.round(sr.w * 0.06));
      var badgeY = sr.y + sr.h - badgeH - Math.max(2, Math.round(sr.h * 0.06));
      drawRoundRect(badgeX, badgeY, badgeW, badgeH, Math.max(2, badgeW * 0.25), "rgba(27,38,50,0.72)");
      drawText("" + (i + 1), badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5, badgeFont, COLORS.white);
    }

    // Panel Footer / Dynamic Status Hint
    var footerTop = pRect.y + pRect.h - L.panelFooterH;
    var footerCy = footerTop + L.panelFooterH * 0.48;
    var footerCx = pRect.x + pRect.w / 2;

    if (holdState && holdState.progress > 0.05) {
      var holdHintSize = Math.round(clamp(pRect.w * 0.055, 10, 14));
      drawText("HOLDING TO CLEAR...", footerCx, footerCy, holdHintSize, COLORS.iceBlue);
    } else if (statusHint && statusHint.remainingMs > 0) {
      var stSize = Math.round(clamp(pRect.w * 0.058, 10, 15));
      drawText(statusHint.text, footerCx, footerCy, stSize, statusHint.color);
    } else if (L.layoutMode === "landscape") {
      var lineSize = Math.round(clamp(Math.min(pRect.w * 0.056, L.panelFooterH * 0.29), 9, 13));
      if (inputFocus === "palette") {
        drawText("ARROWS MOVE · ENTER PICK", footerCx, footerTop + L.panelFooterH * 0.30, lineSize, COLORS.skyBlue);
        drawText("TAB RETURNS TO GRID", footerCx, footerTop + L.panelFooterH * 0.68, lineSize, COLORS.skyBlue);
      } else {
        drawText("TAP COLOR \u2192 TAP CELL", footerCx, footerTop + L.panelFooterH * 0.30, lineSize, COLORS.gray);
        drawText("HOLD TILE 2s TO CLEAR", footerCx, footerTop + L.panelFooterH * 0.68, lineSize, COLORS.gray);
      }
    } else {
      var pHintSize = Math.round(clamp(Math.min(pRect.w * 0.036, L.panelFooterH * 0.46), 9, 14));
      if (inputFocus === "palette") {
        drawText("PALETTE: \u2190 \u2192 MOVE · ENTER PICK · TAB GRID", footerCx, footerCy, pHintSize, COLORS.skyBlue);
      } else {
        drawText("TAP COLOR · TAP CELL · HOLD TILE TO CLEAR", footerCx, footerCy, pHintSize, COLORS.gray);
      }
    }

    drawScanlines();
  }

  // ---- Draw Win Screen ----

  function drawWinScreen(now) {
    var L = layout;
    var cx = L.w / 2;
    var t = now * 0.001;

    drawRect(0, 0, L.w, L.h, COLORS.navy);

    // Floating color blocks (confetti)
    for (var i = 0; i < 40; i++) {
      var px = (Math.sin(t * 0.8 + i * 2.1) * 0.5 + 0.5) * L.w;
      var py = ((t * 0.12 + i * 0.07) % 1.2) * L.h;
      var sz = L.minDim * 0.018 + Math.sin(i * 1.5) * L.minDim * 0.004;
      ctx.fillStyle = GAME_COLORS[i % 9];
      ctx.globalAlpha = 0.35;
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.globalAlpha = 1;

    drawGridPattern();

    // Win title
    var pulse = Math.sin(t * 3) * 0.3 + 0.7;
    var titleSize = Math.round(clamp(Math.min(L.w * 0.085, L.h * 0.12), 22, 84));
    ctx.save();
    ctx.shadowColor = COLORS.lime;
    ctx.shadowBlur = 24 * pulse;
    drawTextOutline("PUZZLE COMPLETE", cx, Math.round(L.h * 0.24), titleSize, COLORS.lime, COLORS.white);
    ctx.restore();

    // Stats
    var statSize = Math.round(clamp(Math.min(L.w * 0.036, L.h * 0.05), 12, 26));
    drawText("DIFFICULTY: " + DIFF_CONFIG[difficulty].label, cx, Math.round(L.h * 0.41), statSize, COLORS.iceBlue);
    drawText("CELLS FILLED: " + filledCells + "/" + totalCells, cx, Math.round(L.h * 0.49), statSize, COLORS.yellow);

    // Difficulty stars
    var starCount = (difficulty === "Hard" ? 3 : difficulty === "Medium" ? 2 : 1);
    var starSize = Math.round(clamp(Math.min(L.w * 0.06, L.h * 0.07), 18, 42));
    var starSpacing = starSize * 1.4;
    var starY = Math.round(L.h * 0.59);
    for (var st = 0; st < 3; st++) {
      var sx = cx + (st - 1) * starSpacing;
      ctx.fillStyle = st < starCount ? COLORS.yellow : COLORS.gray;
      ctx.globalAlpha = st < starCount ? 1 : 0.3;
      ctx.font = starSize + 'px "Courier New", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u2605", sx, starY);
    }
    ctx.globalAlpha = 1;

    // Color bar display
    var dBlockW = Math.round(clamp(Math.min(L.w * 0.055, 36), 14, 36));
    var dGap = Math.round(clamp(dBlockW * 0.3, 4, 12));
    var dBlockH = Math.round(clamp(L.h * 0.045, 10, 24));
    var dTotalW = 9 * dBlockW + 8 * dGap;
    var dStartX = cx - dTotalW / 2;
    var dY = Math.round(L.h * 0.69 - dBlockH / 2);
    for (var d = 0; d < 9; d++) {
      drawRoundRect(dStartX + d * (dBlockW + dGap), dY, dBlockW, dBlockH, dBlockH * 0.22, GAME_COLORS[d]);
    }

    // Play again
    if (Math.sin(t * 3) > 0) {
      var promptSize = Math.round(clamp(Math.min(L.w * 0.036, L.h * 0.05), 11, 24));
      drawText("[ TAP / PRESS ANY KEY TO PLAY AGAIN ]", cx, Math.round(L.h * 0.84), promptSize, COLORS.skyBlue);
    }

    drawCorners(COLORS.lime);
    drawScanlines();
  }

  // ---- Hit Testing ----

  function pointInRect(px, py, rect) {
    return px >= rect.x && px < rect.x + rect.w && py >= rect.y && py < rect.y + rect.h;
  }

  function getGridCell(px, py) {
    var L = layout;
    if (!L) return null;
    if (px >= L.boardX && px < L.boardX + L.boardSize &&
        py >= L.boardY && py < L.boardY + L.boardSize) {
      var col = Math.floor((px - L.boardX) / L.cellSize);
      var row = Math.floor((py - L.boardY) / L.cellSize);
      if (row >= 0 && row < 9 && col >= 0 && col < 9) return { row: row, col: col };
    }
    return null;
  }

  function getPaletteIndex(px, py) {
    var L = layout;
    if (!L || !L.paletteHitRects) return -1;
    for (var i = 0; i < L.paletteHitRects.length; i++) {
      if (pointInRect(px, py, L.paletteHitRects[i])) return i;
    }
    return -1;
  }

  function getDifficultyButton(px, py) {
    var L = layout;
    if (!L || !L.difficultyRects) return -1;
    for (var i = 0; i < L.difficultyRects.length; i++) {
      if (pointInRect(px, py, L.difficultyRects[i])) return i;
    }
    return -1;
  }

  // ---- Game Actions ----

  function placeColor(autoAdvance) {
    if (initialBoard[cursorRow][cursorCol] !== 0) return false;
    if (cellGrid[cursorRow][cursorCol] !== 0) return false;
    if (selectedColor < 1 || selectedColor > 9) return false;

    if (!isValid(cellGrid, cursorRow, cursorCol, selectedColor)) {
      flashCell = { row: cursorRow, col: cursorCol };
      conflictCells = getConflicts(cellGrid, cursorRow, cursorCol, selectedColor);
      flashRemainingMs = FLASH_DURATION;
      showStatusHint("RULE CONFLICT!", COLORS.crimson, 1200);
      return false;
    }

    cellGrid[cursorRow][cursorCol] = selectedColor;
    filledCells++;

    if (autoAdvance) {
      var found = false;
      for (var sr = cursorRow; sr < 9 && !found; sr++) {
        for (var sc = (sr === cursorRow ? cursorCol : 0); sc < 9 && !found; sc++) {
          if (initialBoard[sr][sc] === 0 && cellGrid[sr][sc] === 0) {
            cursorRow = sr;
            cursorCol = sc;
            found = true;
          }
        }
      }
      if (!found) {
        for (var sr2 = 0; sr2 < 9 && !found; sr2++) {
          for (var sc2 = 0; sc2 < 9 && !found; sc2++) {
            if (initialBoard[sr2][sc2] === 0 && cellGrid[sr2][sc2] === 0) {
              cursorRow = sr2;
              cursorCol = sc2;
              found = true;
            }
          }
        }
      }
    }

    if (filledCells === totalCells) {
      gameState = STATE_WIN;
      pointerState = null;
      holdState = null;
    }
    return true;
  }

  function clearPlayerCell(row, col) {
    if (initialBoard[row][col] !== 0) return false;
    if (cellGrid[row][col] === 0) return false;

    var oldColor = cellGrid[row][col];
    cellGrid[row][col] = 0;
    filledCells--;
    clearEffect = {
      row: row,
      col: col,
      color: GAME_COLORS[oldColor - 1],
      remainingMs: CLEAR_EFFECT_DURATION,
      durationMs: CLEAR_EFFECT_DURATION,
    };
    showStatusHint("TILE CLEARED", COLORS.iceBlue, 1200);
    return true;
  }

  // ---- Input Handlers ----

  function getCanvasCoords(cx, cy) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: cx - rect.left,
      y: cy - rect.top,
    };
  }

  function handlePointerDown(e) {
    if (!layout) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pointerState !== null) return;

    e.preventDefault();
    var pos = getCanvasCoords(e.clientX, e.clientY);

    if (gameState === STATE_TITLE) {
      gameState = STATE_DIFFICULTY;
      return;
    }

    if (gameState === STATE_DIFFICULTY) {
      var btn = getDifficultyButton(pos.x, pos.y);
      if (btn >= 0) {
        difficultyCursor = btn;
        difficulty = DIFF_KEYS[btn];
        gameState = STATE_PLAYING;
        initGame();
      }
      return;
    }

    if (gameState === STATE_WIN) {
      gameState = STATE_DIFFICULTY;
      return;
    }

    if (gameState === STATE_PLAYING) {
      // Check color palette swatches first
      var palIdx = getPaletteIndex(pos.x, pos.y);
      if (palIdx >= 0) {
        paletteCursor = palIdx;
        selectedColor = palIdx + 1;
        inputFocus = "grid";
        return;
      }

      // Check grid cell
      var cell = getGridCell(pos.x, pos.y);
      if (cell) {
        try {
          if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        } catch (_) {}

        cursorRow = cell.row;
        cursorCol = cell.col;
        inputFocus = "grid";

        var isLocked = initialBoard[cell.row][cell.col] !== 0;
        var currentVal = cellGrid[cell.row][cell.col];
        var wasEmpty = !isLocked && currentVal === 0;
        var wasPlayerFilled = !isLocked && currentVal !== 0;
        var now = performance.now();

        pointerState = {
          pointerId: e.pointerId,
          startX: pos.x,
          startY: pos.y,
          row: cell.row,
          col: cell.col,
          wasEmpty: wasEmpty,
          wasPlayerFilled: wasPlayerFilled,
          startTime: now,
          holdCleared: false,
          cancelled: false,
        };

        if (wasPlayerFilled) {
          holdState = {
            row: cell.row,
            col: cell.col,
            startTime: now,
            progress: 0,
            pointerId: e.pointerId,
          };
        } else {
          holdState = null;
        }
      }
    }
  }

  function handlePointerMove(e) {
    if (!pointerState || e.pointerId !== pointerState.pointerId || pointerState.cancelled) return;
    if (!layout) return;

    var pos = getCanvasCoords(e.clientX, e.clientY);
    var cellX = layout.boardX + pointerState.col * layout.cellSize;
    var cellY = layout.boardY + pointerState.row * layout.cellSize;
    var slop = Math.max(16, layout.cellSize * 0.45);
    var outsideExpandedCell = (
      pos.x < cellX - slop ||
      pos.x > cellX + layout.cellSize + slop ||
      pos.y < cellY - slop ||
      pos.y > cellY + layout.cellSize + slop
    );
    var dist = Math.hypot(pos.x - pointerState.startX, pos.y - pointerState.startY);

    if (outsideExpandedCell && dist > Math.max(18, layout.cellSize * 0.65)) {
      pointerState.cancelled = true;
      holdState = null;
    }
  }

  function handlePointerUp(e) {
    if (!pointerState || e.pointerId !== pointerState.pointerId) return;

    var ps = pointerState;
    var now = performance.now();
    if (holdState && !ps.holdCleared && !ps.cancelled &&
        (now - holdState.startTime) >= HOLD_CLEAR_DURATION) {
      clearPlayerCell(holdState.row, holdState.col);
      ps.holdCleared = true;
    }

    pointerState = null;
    holdState = null;

    try {
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (gameState === STATE_PLAYING && !ps.holdCleared && !ps.cancelled) {
      if (ps.wasEmpty) {
        if (initialBoard[ps.row][ps.col] === 0 && cellGrid[ps.row][ps.col] === 0) {
          cursorRow = ps.row;
          cursorCol = ps.col;
          placeColor(false);
        }
      } else if (ps.wasPlayerFilled) {
        showStatusHint("HOLD TILE TO CLEAR", COLORS.iceBlue, 1500);
      }
    }
  }

  function cancelActivePointer() {
    pointerState = null;
    holdState = null;
  }

  function handleKeyDown(e) {
    var key = e.key;

    if (gameState === STATE_TITLE) {
      gameState = STATE_DIFFICULTY;
      e.preventDefault();
      return;
    }

    if (gameState === STATE_DIFFICULTY) {
      if (key === "ArrowUp" || key === "ArrowLeft") {
        difficultyCursor = (difficultyCursor + 2) % 3;
        e.preventDefault();
      } else if (key === "ArrowDown" || key === "ArrowRight") {
        difficultyCursor = (difficultyCursor + 1) % 3;
        e.preventDefault();
      } else if (key === "Enter" || key === " ") {
        difficulty = DIFF_KEYS[difficultyCursor];
        gameState = STATE_PLAYING;
        initGame();
        e.preventDefault();
      }
      return;
    }

    if (gameState === STATE_PLAYING) {
      if (key === "Tab") {
        inputFocus = (inputFocus === "grid" ? "palette" : "grid");
        e.preventDefault();
        return;
      }

      if (inputFocus === "palette") {
        if (key === "ArrowLeft" || key === "ArrowUp") {
          paletteCursor = (paletteCursor + 8) % 9;
          selectedColor = paletteCursor + 1;
          e.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown") {
          paletteCursor = (paletteCursor + 1) % 9;
          selectedColor = paletteCursor + 1;
          e.preventDefault();
        } else if (key === "Enter") {
          selectedColor = paletteCursor + 1;
          inputFocus = "grid";
          e.preventDefault();
        }
        return;
      }

      if (key === "ArrowUp") {
        cursorRow = Math.max(0, cursorRow - 1);
        e.preventDefault();
      } else if (key === "ArrowDown") {
        cursorRow = Math.min(8, cursorRow + 1);
        e.preventDefault();
      } else if (key === "ArrowLeft") {
        cursorCol = Math.max(0, cursorCol - 1);
        e.preventDefault();
      } else if (key === "ArrowRight") {
        cursorCol = Math.min(8, cursorCol + 1);
        e.preventDefault();
      } else if (key === "Enter" || key === " ") {
        if (initialBoard[cursorRow][cursorCol] === 0 && cellGrid[cursorRow][cursorCol] === 0) {
          placeColor(true);
        }
        e.preventDefault();
      } else if (key >= "1" && key <= "9") {
        selectedColor = parseInt(key, 10);
        paletteCursor = selectedColor - 1;
      } else if (key === "Backspace" || key === "Delete") {
        clearPlayerCell(cursorRow, cursorCol);
        e.preventDefault();
      }
      return;
    }

    if (gameState === STATE_WIN) {
      gameState = STATE_DIFFICULTY;
      e.preventDefault();
    }
  }

  // ---- Event Listeners ----

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", cancelActivePointer);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  window.addEventListener("blur", cancelActivePointer);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) cancelActivePointer();
  });
  document.addEventListener("keydown", handleKeyDown);

  window.addEventListener("resize", function () { recalcLayout(false); });
  window.addEventListener("orientationchange", function () {
    setTimeout(function () { recalcLayout(true); }, 50);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () { recalcLayout(false); });
  }

  // ---- Test / Inspection Hook ----

  window._ikonoku = {
    getState: function () {
      return {
        gameState: gameState,
        difficulty: difficulty,
        filledCells: filledCells,
        totalCells: totalCells,
        selectedColor: selectedColor,
        cursorRow: cursorRow,
        cursorCol: cursorCol,
        inputFocus: inputFocus,
        holdDuration: HOLD_CLEAR_DURATION,
        holdProgress: holdState ? holdState.progress : 0,
        holdingCell: holdState ? { row: holdState.row, col: holdState.col } : null,
        flashActive: flashRemainingMs > 0,
        flashCell: flashCell,
        conflictCells: conflictCells,
        initialBoard: initialBoard,
        cellGrid: cellGrid,
        solvedBoard: solvedBoard,
        layout: layout,
      };
    },
  };

  // ---- Game Loop ----

  function gameLoop() {
    var now = performance.now();
    var dt = lastFrameTime ? Math.min(100, now - lastFrameTime) : 16;
    lastFrameTime = now;

    recalcLayout(false);

    // Update hold-to-clear progress
    if (holdState && gameState === STATE_PLAYING) {
      var elapsed = now - holdState.startTime;
      holdState.progress = clamp(elapsed / HOLD_CLEAR_DURATION, 0, 1);
      if (elapsed >= HOLD_CLEAR_DURATION) {
        clearPlayerCell(holdState.row, holdState.col);
        if (pointerState && pointerState.pointerId === holdState.pointerId) {
          pointerState.holdCleared = true;
        }
        holdState = null;
      }
    }

    // Update timed feedback effects
    if (flashRemainingMs > 0) {
      flashRemainingMs = Math.max(0, flashRemainingMs - dt);
      if (flashRemainingMs === 0) {
        flashCell = null;
        conflictCells = [];
      }
    }
    if (clearEffect && clearEffect.remainingMs > 0) {
      clearEffect.remainingMs = Math.max(0, clearEffect.remainingMs - dt);
      if (clearEffect.remainingMs === 0) clearEffect = null;
    }
    if (statusHint && statusHint.remainingMs > 0) {
      statusHint.remainingMs = Math.max(0, statusHint.remainingMs - dt);
      if (statusHint.remainingMs === 0) statusHint = null;
    }

    switch (gameState) {
      case STATE_TITLE:      drawTitleScreen(now);      break;
      case STATE_DIFFICULTY: drawDifficultyScreen(now); break;
      case STATE_PLAYING:    drawGameScreen(now);       break;
      case STATE_WIN:        drawWinScreen(now);        break;
    }

    requestAnimationFrame(gameLoop);
  }

  // ---- Start ----
  recalcLayout(true);
  requestAnimationFrame(gameLoop);

})();
