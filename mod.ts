
export * from 'https://esm.sh/svg2png-wasm@0.6.1';
import { EmulatedCanvas2D, Image, createCanvas, loadImage }
	from 'https://deno.land/x/canvas@v1.4.1/mod.ts';
import { decode, ColorType, DecodeResult }
	from 'https://deno.land/x/pngs@0.1.1/mod.ts';
import { GIFEncoder, quantize, applyPalette }
	from 'https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js';

import { PIECES_100, PIECES_50, BACKGROUND } from './pieces.ts';

type Piece = "k" | "q" | "r" | "b" | "n" | "p";
type Color = "w" | "b";
type Theme = { light: string, dark: string, highlight: string };
type Board =  ({ type: string, color: Color } | null)[][];

const FILES = "abcdefgh";

const PIECES: { [color: string]: { [piece: string]: Image }; }= {
	'w': {
		'p': await loadImage(PIECES_50["w"]["p"]),
		'n': await loadImage(PIECES_50["w"]["n"]),
		'b': await loadImage(PIECES_50["w"]["b"]),
		'r': await loadImage(PIECES_50["w"]["r"]),
		'q': await loadImage(PIECES_50["w"]["q"]),
		'k': await loadImage(PIECES_50["w"]["k"])
	},
	'b': {
		'p': await loadImage(PIECES_50["b"]["p"]),
		'n': await loadImage(PIECES_50["b"]["n"]),
		'b': await loadImage(PIECES_50["b"]["b"]),
		'r': await loadImage(PIECES_50["b"]["r"]),
		'q': await loadImage(PIECES_50["b"]["q"]),
		'k': await loadImage(PIECES_50["b"]["k"])
	}
};

export class Position {

	squares: { [square: string]: { piece: Piece, color: Color } | null } = { };
	highlights: string[] = [];

	constructor(board?: Board) {
		for (let i = "a"; i <= "h"; i = FILES[FILES.indexOf(i) + 1])
			for (let j = 1; j <= 8; j++) this.squares[`${i}${j}`] = null;
		if (board) this.set(board);
	}

	place(piece: Piece, color: Color, square: string) {
		if (square.length !== 2) return this;
		if (square[0] < "a" || square[0] > "h") return this;
		if (square[1] < "1" || square[1] > "8") return this;
		this.squares[square] = { piece, color };
		return this;
	}

	set(board: ({ type: string, color: Color } | null)[][]) {
		if (board.length != 8) { this.clear(); return this; }
		for (let i = 0; i < 8; i++) {
			if (board[i].length != 8) { this.clear(); return this; }
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
		return this;
	}

	remove(square: string) {
		if (square.length !== 2) return this;
		if (square[0] < "a" || square[0] > "h") return this;
		if (square[1] < "1" || square[1] > "8") return this;
		this.squares[square] = null;
		return this;
	}

	clear() {
		for (let i = "a"; i <= "h"; i = FILES[FILES.indexOf(i) + 1])
			for (let j = 1; j <= 8; j++) this.squares[`${i}${j}`] = null;
		return this;
	}

	highlight(square: string) {
		if (square.length !== 2) return this;
		if (square[0] < "a" || square[0] > "h") return this;
		if (square[1] < "1" || square[1] > "8") return this;
		this.highlights.push(square);
		return this;
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

}

function rgba(board: DecodeResult) {
	if (board.colorType == ColorType.RGBA) return board.image.slice(0);
	const data = new Uint8Array(Math.floor(board.image.length / 3) * 4);
	for (let i = 0; i < board.image.length; i += 3) {
		data.set([
			board.image[i + 0],
			board.image[i + 1],
			board.image[i + 2],
			255
		], Math.floor(i / 3) * 4);
	}
	return data;
}

export class Positions {

	#boards: Board[] = []; #highlights: string[][] = [];
	#perspective: Color; #theme: Theme; #coords: boolean;
	#canvas: EmulatedCanvas2D;

	constructor(perspective: Color = "w", coords = true, theme: Theme = {
		light: "#F0D9B5", dark: "#B58863", highlight: "rgba(15, 164, 46, 0.35)"
	}) {
		this.#perspective = perspective;
		this.#coords = coords;
		this.#theme = theme;
		// create the board that we can copy for each frame:
		const size = 400, side = 50;
		const canvas = createCanvas(size, size);
		const ctx = canvas.getContext("2d");
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
		if (!coords) { this.#canvas = canvas; return; }
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
		}
		this.#canvas = canvas;
	}

	add(board: Board, highlight: string[] = []) {
		this.#boards.push(board);
		this.#highlights.push(highlight);
	}

	gif() {
		const frames = this.#frames();
		const encoder = GIFEncoder();
		if (frames.length == 0) return null;
		for (const frame of frames) {
			const data = rgba(decode(frame));
			const palette = quantize(data, 24, { format: 'rgb444' });
			const index = applyPalette(data, palette, 'rgb444');
			encoder.writeFrame(index, 400, 400, { palette, repeat: -1 });
		}
		encoder.finish();
		return encoder.bytes();
	}

	#frames() {
		const frames = [], side = 50; let i = 0;
		for (const board of this.#boards) {
			const highlights = this.#highlights[i++];
			const frame = this.#buffer();
			const ctx = frame.getContext('2d');
			for (const f of FILES) {
				for (let r = 8; r >= 1; r--) {
					let x = 0, y = 0;
					if (this.#perspective == "w") {
						x = side * FILES.indexOf(f);
						y = side * (8 - r);
					} else {
						x = side * (7 - FILES.indexOf(f));
						y = side * (r - 1);
					}
					// draw highlights
					if (highlights.includes(`${f}${r}`)) {
						ctx.fillStyle = this.#theme.highlight;
						ctx.fillRect(x, y, side, side);
						ctx.fillStyle = this.#theme.dark;
					}
					// place pieces
					const square = board[8 - r][FILES.indexOf(f)];
					if (square == null) continue;
					const { type, color } = square!;
					ctx.drawImage(PIECES[color][type], x, y, side, side);
				}
			}
			frames.push(frame.toBuffer('image/png'));
		}
		return frames;
	}

	// copy of the canvas
	#buffer() {
		const canvas = createCanvas(this.#canvas.width, this.#canvas.height);
		const ctx = canvas.getContext('2d');
		ctx.drawImage(this.#canvas, 0, 0);
		return canvas;
	}

}
