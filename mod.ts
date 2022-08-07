
export * from 'https://esm.sh/svg2png-wasm@0.6.1';
import { createCanvas, loadImage } from "https://deno.land/x/canvas@v1.4.1/mod.ts";

import { PIECES_100, PIECES_50, BACKGROUND } from './pieces.ts';

type Piece = "k" | "q" | "r" | "b" | "n" | "p";
type Color = "w" | "b";
type Theme = { light: string, dark: string, highlight: string };

const FILES = "abcdefgh";

export class Position {

	squares: { [square: string]: { piece: Piece, color: Color } | null } = { };
	highlights: string[] = [];

	constructor(board?: ({ type: string, color: Color } | null)[][]) {
		for (let i = "a"; i <= "h"; i = FILES[FILES.indexOf(i) + 1])
			for (let j = 1; j <= 8; j++) this.squares[`${i}${j}`] = null;
		if (board) this.set(board);
	}

	place(piece: Piece, color: Color, square: string) {
		if (square.length !== 2) return false;
		if (square[0] < "a" || square[0] > "h") return false;
		if (square[1] < "1" || square[1] > "8") return false;
		this.squares[square] = { piece, color };
		return true;
	}

	set(board: ({ type: string, color: Color } | null)[][]) {
		if (board.length != 8) { this.clear(); return; }
		for (let i = 0; i < 8; i++) {
			if (board[i].length != 8) { this.clear(); return; }
			for (let j = 0; j < 8; j++) {
				const square = FILES[j] + (8 - i);
				if (board[i][j] == null) {
					this.squares[square] = null;
					continue;
				}
				const { type, color } = board[i][j]!;
				this.squares[square] = { piece: type as Piece, color };
			}
		}
	}

	remove(square: string) {
		if (square.length !== 2) return;
		if (square[0] < "a" || square[0] > "h") return;
		if (square[1] < "1" || square[1] > "8") return;
		this.squares[square] = null;
	}

	clear() {
		for (let i = "a"; i <= "h"; i = FILES[FILES.indexOf(i) + 1])
			for (let j = 1; j <= 8; j++) this.squares[`${i}${j}`] = null;
	}

	highlight(square: string) {
		if (square.length !== 2) return;
		if (square[0] < "a" || square[0] > "h") return;
		if (square[1] < "1" || square[1] > "8") return;
		this.highlights.push(square);
	}

	async picture(perspective: Color = "w") {
		const size = 800, side = 100;
		const canvas = createCanvas(size, size);
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		// draw background
		const background = await loadImage(BACKGROUND[perspective]);
		ctx.drawImage(background, 0, 0);
		for (const f of FILES) {
			for (let r = 1; r <= 8; r++) {
				let x = 0, y = 0;
				if (perspective == "w") {
					x = side * FILES.indexOf(f);
					y = side * (8 - r);
				} else {
					x = side * (8 - FILES.indexOf(f) - 1);
					y = side * (r - 1);
				}
				// place pieces
				if (!this.squares[`${f}${r}`]) continue;
				const { piece, color } = this.squares[`${f}${r}`]!;
				const image = await loadImage(
					side == 100 ? PIECES_100[color][piece] : PIECES_50[color][piece]
				);
				ctx.drawImage(image, x, y, side, side);
			}
		}
		return canvas.toBuffer("image/png");
	}

	async frame(perspective: Color = "w",
				coords = true,
				theme: Theme = {
					light: "#F0D9B5",
					dark: "#B58863",
					highlight: "rgba(32, 108, 244, 0.4)" 
				}) {
		const size = 400, side = 50;
		const canvas = createCanvas(size, size);
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		// draw light squares
		ctx.fillStyle = theme.light;
		ctx.fillRect(0, 0, size, size);
		ctx.fillStyle = theme.dark;
		for (const f of FILES) {
			for (let r = 1; r <= 8; r++) {
				if ((FILES.indexOf(f) + r) % 2 == 0) {
					// draw dark squares
					ctx.fillRect(
						side * FILES.indexOf(f), side * (r - 1),
						side, side
					);
				}
			}
		}
		for (const f of FILES) {
			for (let r = 1; r <= 8; r++) {
				let x = 0, y = 0;
				if (perspective == "w") {
					x = side * FILES.indexOf(f);
					y = side * (8 - r);
				} else {
					x = side * (8 - FILES.indexOf(f) - 1);
					y = side * (r - 1);
				}
				// draw coordinates
				if (coords) {
					ctx.fillStyle = (FILES.indexOf(f) + r) % 2 ? theme.light : theme.dark;
					ctx.font = "bold " + side / 6 + "px 'Helvetica', sans-serif";
					const sx = side / 10;
					if (perspective == "w") {
						if (r == 1) ctx.fillText(f, x + sx, y + side - sx);
						if (f == "h") ctx.fillText(`${r}`, x + side - sx - 3, y + 12);
					} else {
						if (r == 8) ctx.fillText(f, x + sx, y + side - sx);
						if (f == "a") ctx.fillText(`${r}`, x + side - sx - 3, y + 12);
					}
				}
				// draw highlights
				if (this.highlights.includes(`${f}${r}`)) {
					ctx.fillStyle = theme.highlight;
					ctx.fillRect(x, y, side, side);
					ctx.fillStyle = theme.dark;
				}
				// place pieces
				if (!this.squares[`${f}${r}`]) continue;
				const { piece, color } = this.squares[`${f}${r}`]!;
				const image = await loadImage(PIECES_50[color][piece]);
				ctx.drawImage(image, x, y, side, side);
			}
		}
		return canvas.toBuffer("image/png");
	}

}
