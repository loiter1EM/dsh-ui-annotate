window.__ModuleLoader__.load({
	id: "dsh-ui-annotate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		let react_dom = require("react-dom");

		const h = react.createElement;
		/** Marks every node this plugin renders so hit-testing can skip them. */
		const ATTR = "data-dsh-ui-annotate";
		const Z = 2147483000;
		const FONT = "ui-sans-serif, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

		// ------------------------------------------------------------------
		// DOM helpers
		// ------------------------------------------------------------------

		const own = (node) => !!(node && node.closest && node.closest("[" + ATTR + "]"));

		/** Topmost real element under a viewport point, ignoring this plugin's UI. */
		function elementAt(x, y) {
			const stack = document.elementsFromPoint(x, y) || [];
			for (const node of stack) {
				if (!(node instanceof Element)) continue;
				if (own(node)) continue;
				if (node === document.documentElement || node === document.body) continue;
				return node;
			}
			return null;
		}

		const SAFE_IDENT = /^[A-Za-z0-9_-]+$/;

		/** One selector segment for an element, using only characters that stay valid. */
		function segmentFor(node) {
			let sel = node.tagName.toLowerCase();
			const cls = (node.getAttribute("class") || "")
				.trim()
				.split(/\s+/)
				.filter((c) => c && SAFE_IDENT.test(c))
				.slice(0, 2);
			if (cls.length) sel += "." + cls.join(".");
			const parent = node.parentElement;
			if (parent) {
				const same = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName);
				if (same.length > 1) sel += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
			}
			return sel;
		}

		function matchesOnly(sel, el) {
			try {
				const list = document.querySelectorAll(sel);
				return list.length === 1 && list[0] === el;
			} catch (err) {
				return false;
			}
		}

		/**
		 * CSS path for an element, extended ancestor by ancestor until it selects
		 * exactly that element — a path that is merely short is useless when the
		 * agent has to land a change on one specific node out of many look-alikes.
		 */
		function cssPath(el) {
			if (!el || el.nodeType !== 1) return { path: "", unique: false };
			const chain = [];
			let node = el;
			while (node && node.nodeType === 1 && node !== document.documentElement && chain.length < 12) {
				chain.push(node);
				node = node.parentElement;
			}
			let sel = "";
			let best = "";
			let unique = false;
			for (const item of chain) {
				const seg = item.id && SAFE_IDENT.test(item.id) ? item.tagName.toLowerCase() + "#" + item.id : segmentFor(item);
				sel = sel ? seg + " > " + sel : seg;
				best = sel;
				// An id is usually unique, but a duplicate id is exactly the case
				// where stopping early hands the agent an ambiguous selector — so the
				// lookup decides, not the presence of `#`.
				if (matchesOnly(sel, el)) {
					unique = true;
					break;
				}
			}
			return { path: best, unique };
		}

		/**
		 * The element the frame is meant to target.
		 *
		 * The centre hit test alone answers "what is on top in the middle", which is
		 * wrong whenever the frame spans a heading and the row beneath it. Climb to
		 * the deepest ancestor that still contains (almost) the whole frame, so a
		 * frame drawn around two stacked pieces of one block selects the block.
		 */
		function pickTarget(area) {
			const hit = elementAt(area.x + area.w / 2, area.y + area.h / 2);
			if (!hit) return null;
			let el = hit;
			let pct = coverPct(hit.getBoundingClientRect(), area);
			// The frame already belongs to this element — a button drawn inside its
			// own frame covers most of it, and climbing would drag the target up to
			// the toolbar around the button.
			for (let i = 0; i < 8 && pct < 55; i += 1) {
				const parent = el.parentElement;
				if (!parent || parent === document.body || parent === document.documentElement) break;
				const next = coverPct(parent.getBoundingClientRect(), area);
				if (next <= pct) break;
				el = parent;
				pct = next;
			}
			return el;
		}

		/** A rect in viewport coordinates, rounded. */
		function viewRect(r) {
			return {
				x: Math.round(r.left),
				y: Math.round(r.top),
				w: Math.round(r.width),
				h: Math.round(r.height),
			};
		}

		/** How much of the dragged frame a rect covers, in percent of the frame. */
		function coverPct(r, area) {
			if (!area.w || !area.h) return 0;
			const iw = Math.max(0, Math.min(r.right, area.x + area.w) - Math.max(r.left, area.x));
			const ih = Math.max(0, Math.min(r.bottom, area.y + area.h) - Math.max(r.top, area.y));
			return Math.round(((iw * ih) / (area.w * area.h)) * 100);
		}

		/**
		 * The elements the frame actually covers, largest share first.
		 *
		 * The single point hit test answers "what is on top at the centre"; when the
		 * frame spans a header and the row under it, that answer is one of two
		 * plausible targets and the agent has no way to tell which one the user
		 * meant. Listing what the frame covers, with shares, settles it.
		 */
		function frameCandidates(area, top) {
			if (!top) return [];
			const inside = (r) =>
				r.left <= area.x + 1 && r.top <= area.y + 1 && r.right >= area.x + area.w - 1 && r.bottom >= area.y + area.h - 1;
			let anchor = top;
			for (let i = 0; i < 8 && anchor.parentElement; i += 1) {
				anchor = anchor.parentElement;
				if (inside(anchor.getBoundingClientRect())) break;
			}
			if (!anchor || anchor === document.body || anchor === document.documentElement) return [];
			const out = [];
			const frameArea = area.w * area.h;
			const walk = (node) => {
				for (const child of Array.from(node.children || [])) {
					if (own(child)) continue;
					const r = child.getBoundingClientRect();
					if (r.width < 1 || r.height < 1) continue;
					// A full-page wrapper covers the frame completely while saying
					// nothing about what is inside it — keep only elements of a size
					// comparable to the frame.
					const oversized = r.width * r.height > frameArea * 4;
					if (!oversized) {
						const pct = coverPct(r, area);
						if (pct >= 5 && child !== top) out.push({ el: child, rect: viewRect(r), pct });
					}
					if (out.length < 400) walk(child);
				}
			};
			try {
				walk(anchor);
			} catch (err) {
				console.error("[dsh-ui-annotate] candidate walk failed", err);
			}
			out.sort((a, b) => b.pct - a.pct || a.rect.w * a.rect.h - b.rect.w * b.rect.h);
			return out.slice(0, 6);
		}

		/** `body > main > section.foo > div.bar`, for orientation only. */
		function ancestorTrail(el) {
			const parts = [];
			let node = el && el.parentElement;
			let depth = 0;
			while (node && node.nodeType === 1 && node !== document.documentElement && depth < 6) {
				parts.unshift(node.id && SAFE_IDENT.test(node.id) ? node.tagName.toLowerCase() + "#" + node.id : segmentFor(node));
				node = node.parentElement;
				depth += 1;
			}
			return parts.join(" > ");
		}

		const px = (v) => (v === undefined || v === null || v === "" ? "" : String(v));

		function shortLabel(el) {
			const text = String(el.innerText || el.textContent || "")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 60);
			const label = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
			return text ? label + ' "' + text + '"' : label;
		}

		/** Everything the agent needs to find and restyle the picked element. */
		function describeElement(el, rect) {
			let cs = {};
			try {
				cs = getComputedStyle(el) || {};
			} catch (err) {
				cs = {};
			}
			const text = String(el.innerText || el.textContent || "")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 200);
			const attrs = [];
			for (const attr of Array.from(el.attributes || [])) {
				if (!attr.name.startsWith("data-")) continue;
				if (attr.name === ATTR) continue;
				attrs.push(attr.name + "=" + attr.value);
			}
			const boxRect = el.getBoundingClientRect();
			const sel = cssPath(el);
			const cands = frameCandidates(rect, el);
			return {
				tag: el.tagName.toLowerCase(),
				id: el.id || "",
				classes: (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 6),
				role: el.getAttribute("role") || "",
				ariaLabel: el.getAttribute("aria-label") || el.getAttribute("title") || "",
				path: sel.path,
				pathUnique: sel.unique,
				trail: ancestorTrail(el),
				text,
				attrs: attrs.slice(0, 4),
				style: {
					color: px(cs.color),
					background: px(cs.backgroundColor || cs.background),
					fontSize: px(cs.fontSize),
					fontWeight: px(cs.fontWeight),
					padding: px(cs.padding),
					margin: px(cs.margin),
					borderRadius: px(cs.borderRadius),
					border: px(cs.border),
					display: px(cs.display),
					position: px(cs.position),
					opacity: px(cs.opacity),
					boxShadow: px(cs.boxShadow).slice(0, 80),
				},
				box: {
					width: Math.round(boxRect.width),
					height: Math.round(boxRect.height),
				},
				location: viewRect(boxRect),
				covers: coverPct(boxRect, rect),
				candidates: cands.map((c) => ({
					label: shortLabel(c.el),
					path: cssPath(c.el).path,
					pct: c.pct,
					location: c.rect,
				})),
				rect,
			};
		}

		function styleSummary(s) {
			const out = [];
			if (s.color) out.push("color: " + s.color);
			if (s.background && s.background !== "rgba(0, 0, 0, 0)") out.push("background: " + s.background);
			if (s.fontSize) out.push("font-size: " + s.fontSize);
			if (s.fontWeight) out.push("font-weight: " + s.fontWeight);
			if (s.padding && s.padding !== "0px") out.push("padding: " + s.padding);
			if (s.borderRadius && s.borderRadius !== "0px") out.push("border-radius: " + s.borderRadius);
			if (s.border && s.border !== "0px none rgb(0, 0, 0)" && !s.border.startsWith("0px")) out.push("border: " + s.border);
			if (s.display) out.push("display: " + s.display);
			if (s.opacity && s.opacity !== "1") out.push("opacity: " + s.opacity);
			return out.join("; ") || "(无法读取)";
		}

		/** Where the element is being asked to go, in the terms the agent needs. */
		function describeTarget(target, picked) {
			if (!target) return null;
			const from = picked.location;
			const cx = from.x + from.w / 2;
			const cy = from.y + from.h / 2;
			const tx = target.x + target.w / 2;
			const ty = target.y + target.h / 2;
			return {
				rect: target,
				dx: Math.round(tx - cx),
				dy: Math.round(ty - cy),
				sizeChanged: Math.abs(target.w - from.w) > 8 || Math.abs(target.h - from.h) > 8,
			};
		}

		function buildMessage(picked, note, target) {
			const r = picked.rect;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const dpr = window.devicePixelRatio || 1;
			const el = [];
			el.push("<" + picked.tag + (picked.classes.length ? ' class="' + picked.classes.join(" ") + '"' : "") + ">");
			const lines = [
				"【界面调整请求】我想修改 DSH 界面上的这个位置。",
				"",
				"- 目标元素(CSS 路径): `" + picked.path + "`" + (picked.pathUnique ? "(该路径在全页唯一命中此元素)" : "(该路径未能唯一命中,请结合下方祖先链与候选元素定位)"),
				"- 元素: " + el.join("") + (picked.role ? " role=" + picked.role : "") + (picked.ariaLabel ? " aria-label=" + JSON.stringify(picked.ariaLabel) : ""),
			];
			if (picked.trail) lines.push("- 祖先链: " + picked.trail);
			lines.push(
				"- 元素实际位置(视口坐标): x=" + picked.location.x + " y=" + picked.location.y + " w=" + picked.location.w + " h=" + picked.location.h +
					" / 视口 " + vw + "×" + vh + " @" + dpr + "x",
			);
			lines.push("- 框选区域(视口坐标): x=" + r.x + " y=" + r.y + " w=" + r.w + " h=" + r.h + " —— 占该元素的 " + picked.covers + "%");
			if (picked.text) lines.push("- 元素文本: " + JSON.stringify(picked.text));
			if (picked.attrs.length) lines.push("- data 属性: " + picked.attrs.join("  "));
			lines.push("- 当前样式: " + styleSummary(picked.style));
			if (target) {
				const t = describeTarget(target, picked);
				lines.push("");
				lines.push("移动目标位置(我另外框出来的):");
				lines.push("  - 目标框(视口坐标): x=" + target.x + " y=" + target.y + " w=" + target.w + " h=" + target.h);
				lines.push(
					"  - 相对元素中心点的位移: dx=" + t.dx + "px, dy=" + t.dy + "px(正数向右/向下)",
				);
				lines.push(
					"  - 目标框与元素尺寸: " + (t.sizeChanged ? "不同 —— 按目标框的尺寸 " + target.w + "×" + target.h + "px 调整" : "基本一致,只挪位置"),
				);
				lines.push("  - 请把该元素移动/调整到上面「目标框」覆盖的区域内。");
			}
			if (picked.candidates.length > 0) {
				lines.push("");
				lines.push("框选范围内包含的元素(按覆盖面积排序):");
				picked.candidates.forEach((c, i) => {
					lines.push(
						"  " + (i + 1) + ". `" + c.path + "` — 覆盖 " + c.pct + "% — " + c.label +
							" @ x=" + c.location.x + " y=" + c.location.y + " w=" + c.location.w + " h=" + c.location.h,
					);
				});
				lines.push("");
				lines.push("注意:改动请落在上面「元素实际位置」的坐标范围内,不要挪到相邻元素上。");
			}
			lines.push("");
			lines.push("我想改成: " + (note.trim() || "(还没想好,先问我要改成什么样)"));
			return lines.join("\n");
		}

		/** Put text into the composer: caret insert first, whole-draft fallback. */
		function insertIntoComposer(actions, text) {
			if (actions) {
				try {
					if (typeof actions.captureInsertion === "function" && typeof actions.insertText === "function") {
						const span = actions.captureInsertion();
						if (actions.insertText(text, span)) return true;
					}
				} catch (err) {
					console.error("[dsh-ui-annotate] insertText failed", err);
				}
				try {
					if (typeof actions.setDraft === "function") {
						const ed = document.querySelector('[contenteditable="true"]');
						const existing = ed ? String(ed.innerText || "").replace(/\s+$/, "") : "";
						actions.setDraft(existing ? existing + "\n\n" + text : text);
						if (typeof actions.persistDraft === "function") actions.persistDraft();
						return true;
					}
				} catch (err) {
					console.error("[dsh-ui-annotate] setDraft failed", err);
				}
			}
			// Last resort: type into the live editor the way a user would.
			try {
				const ed = document.querySelector('[contenteditable="true"]');
				if (ed) {
					ed.focus();
					const range = document.createRange();
					range.selectNodeContents(ed);
					range.collapse(false);
					const sel = window.getSelection();
					if (sel) {
						sel.removeAllRanges();
						sel.addRange(range);
					}
					if (document.execCommand("insertText", false, text)) return true;
				}
			} catch (err) {
				console.error("[dsh-ui-annotate] execCommand fallback failed", err);
			}
			return false;
		}

		// ------------------------------------------------------------------
		// UI
		// ------------------------------------------------------------------

		const sBtn = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 26,
			height: 26,
			padding: 0,
			border: "1px solid transparent",
			borderRadius: 6,
			background: "transparent",
			color: "inherit",
			cursor: "pointer",
			fontFamily: FONT,
			flex: "0 0 auto",
		};

		const sPanelBtn = (primary) => ({
			height: 28,
			padding: "0 12px",
			borderRadius: 6,
			border: primary ? "1px solid transparent" : "1px solid rgba(128,128,128,.35)",
			background: primary ? "#2f6feb" : "transparent",
			color: primary ? "#fff" : "inherit",
			fontSize: 12,
			fontFamily: FONT,
			cursor: "pointer",
		});

		// Amber is the theme's "attention, but nothing is broken" accent. These are the
		// same tokens DSH itself uses for warning strips (--dsw-alias-state-warn-*), so the
		// row tracks light/dark themes instead of hard-coding a colour; the literal values
		// are only fallbacks for a page that has not loaded the theme stylesheet.
		const WARN_FG = "var(--dsw-alias-state-warn-primary, #f59e0b)";
		const WARN_BG = "var(--dsw-alias-state-warn-tertiary, rgba(245,158,11,.14))";
		const warnEdge = (pct) => "1px solid color-mix(in srgb, " + WARN_FG + " " + pct + "%, transparent)";
		const sTargetBtn = () => ({
			height: 26,
			padding: "0 10px",
			borderRadius: 6,
			border: warnEdge(72),
			background: "transparent",
			color: WARN_FG,
			fontSize: 12,
			fontWeight: 600,
			fontFamily: FONT,
			cursor: "pointer",
			whiteSpace: "nowrap",
		});

		function CropIcon() {
			return h(
				"svg",
				{ width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" },
				h("path", { d: "M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" }),
			);
		}

		const norm = (a, b) => ({
			x: Math.round(Math.min(a.x, b.x)),
			y: Math.round(Math.min(a.y, b.y)),
			w: Math.round(Math.abs(a.x - b.x)),
			h: Math.round(Math.abs(a.y - b.y)),
		});

		function PickerEntry(props) {
			const actions = props ? props.inputActions : undefined;
			const [phase, setPhase] = react.useState("idle"); // idle | drag | describe | target
			const [rect, setRect] = react.useState(null);
			const [picked, setPicked] = react.useState(null);
			const [target, setTarget] = react.useState(null);
			const [note, setNote] = react.useState("");
			const [failed, setFailed] = react.useState("");
			const startRef = react.useRef(null);
			const overlayRef = react.useRef(null);
			const noteRef = react.useRef(null);

			const reset = react.useCallback(() => {
				setPhase("idle");
				setRect(null);
				setPicked(null);
				setTarget(null);
				setNote("");
				setFailed("");
				startRef.current = null;
			}, []);

			react.useEffect(() => {
				if (phase === "idle") return undefined;
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						if (phase === "target") {
							setRect(null);
							setPhase("describe");
							return;
						}
						reset();
					}
				};
				window.addEventListener("keydown", onKey, true);
				return () => window.removeEventListener("keydown", onKey, true);
			}, [phase, reset]);

			react.useEffect(() => {
				if (phase !== "describe") return;
				const t = setTimeout(() => {
					if (noteRef.current) noteRef.current.focus();
				}, 30);
				return () => clearTimeout(t);
			}, [phase]);

			const onDown = (event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				const p = { x: event.clientX, y: event.clientY };
				startRef.current = p;
				setRect({ x: p.x, y: p.y, w: 0, h: 0 });
			};

			const onMove = (event) => {
				const start = startRef.current;
				if (!start) return;
				setRect(norm(start, { x: event.clientX, y: event.clientY }));
			};

			const onUp = (event) => {
				const start = startRef.current;
				if (!start) return;
				startRef.current = null;
				const area = norm(start, { x: event.clientX, y: event.clientY });
				if (area.w < 6 || area.h < 6) {
					if (phase === "target") {
						setRect(null);
						setPhase("describe");
						return;
					}
					reset();
					return;
				}
				if (phase === "target") {
					setTarget(area);
					setRect(null);
					setPhase("describe");
					return;
				}
				const overlay = overlayRef.current;
				if (overlay) overlay.style.display = "none";
				void document.body.offsetHeight; // force the hit test to see the page, not us
				let el = null;
				try {
					el = pickTarget(area);
				} catch (err) {
					console.error("[dsh-ui-annotate] hit test failed", err);
				}
				if (overlay) overlay.style.display = "";
				if (!el) {
					reset();
					return;
				}
				setPicked(describeElement(el, area));
				setPhase("describe");
			};

			const submit = () => {
				if (!picked) return;
				const text = buildMessage(picked, note, target);
				const ok = insertIntoComposer(actions, text);
				if (ok) {
					reset();
				} else {
					setFailed("没能写进输入框,下面是整理好的文字,请手动复制:");
				}
			};

			const button = h(
				"button",
				{
					type: "button",
					title: "圈选改这里",
					"aria-label": "圈选改这里",
					style: sBtn,
					onClick: () => {
						setPicked(null);
						setTarget(null);
						setNote("");
						setFailed("");
						setRect(null);
						setPhase("drag");
					},
				},
				h(CropIcon, null),
			);

			if (phase === "idle") return button;

			const overlayChildren = [];
			const dragging = phase === "drag" || phase === "target";
			const sourceBox = picked ? picked.location : null;
			const boxOutline = (key, box, color, dashed) =>
				h("div", {
					key,
					style: {
						position: "absolute",
						left: box.x,
						top: box.y,
						width: box.w,
						height: box.h,
						border: "1.5px " + (dashed ? "dashed " : "solid ") + color,
						background: dashed ? "transparent" : color + "24",
						pointerEvents: "none",
					},
				});
			const sizeTag = (key, box, color, text) =>
				h(
					"div",
					{
						key,
						style: {
							position: "absolute",
							left: box.x,
							top: Math.max(2, box.y - 22),
							padding: "2px 6px",
							borderRadius: 4,
							background: color,
							color: "#fff",
							fontSize: 11,
							fontFamily: FONT,
							pointerEvents: "none",
							whiteSpace: "nowrap",
						},
					},
					text,
				);
			if (dragging) {
				overlayChildren.push(
					h(
						"div",
						{
							key: "hint",
							style: {
								position: "absolute",
								top: 16,
								left: "50%",
								transform: "translateX(-50%)",
								padding: "7px 14px",
								borderRadius: 999,
								background: "rgba(20,20,22,.86)",
								color: phase === "target" ? "#f7d9ac" : "#fff",
								border: phase === "target" ? warnEdge(60) : "1px solid transparent",
								fontSize: 12,
								fontFamily: FONT,
								letterSpacing: ".02em",
								pointerEvents: "none",
								whiteSpace: "nowrap",
							},
						},
						phase === "target" ? "再框一次,标出你想移到/改成的位置 · Esc 返回" : "拖动框选要修改的区域 · Esc 取消",
					),
				);
			}
			// The element already picked stays visible while marking where it should go.
			if (sourceBox && (phase === "describe" || phase === "target")) {
				overlayChildren.push(boxOutline("src", sourceBox, "#4da3ff", true));
				overlayChildren.push(sizeTag("src-size", sourceBox, "#4da3ff", "改动对象 " + sourceBox.w + "×" + sourceBox.h));
			}
			if (!dragging && target) {
				overlayChildren.push(boxOutline("dst", target, "#37c26a", false));
				overlayChildren.push(sizeTag("dst-size", target, "#37c26a", "目标位置 " + target.w + "×" + target.h));
			}
			if (rect && rect.w > 0 && rect.h > 0) {
				const tint = phase === "target" ? "#37c26a" : "#4da3ff";
				overlayChildren.push(
					h("div", {
						key: "sel",
						style: {
							position: "absolute",
							left: rect.x,
							top: rect.y,
							width: rect.w,
							height: rect.h,
							border: "1.5px solid " + tint,
							background: tint + "24",
							boxShadow: "0 0 0 9999px rgba(0,0,0,.36)",
							pointerEvents: "none",
						},
					}),
					sizeTag("size", rect, tint, rect.w + " × " + rect.h),
				);
			}

			const overlay = h(
				"div",
				{
					ref: overlayRef,
					[ATTR]: "overlay",
					style: {
						position: "fixed",
						inset: 0,
						zIndex: Z,
						cursor: "crosshair",
						userSelect: "none",
						WebkitUserSelect: "none",
					},
					onMouseDown: onDown,
					onMouseMove: onMove,
					onMouseUp: onUp,
					onContextMenu: (event) => event.preventDefault(),
				},
				overlayChildren,
			);

			let panel = null;
			if (phase === "describe" && picked) {
				panel = h(
					"div",
					{
						[ATTR]: "panel",
						onMouseDown: (event) => event.stopPropagation(),
						style: {
							position: "fixed",
							right: 20,
							bottom: 120,
							width: 400,
							maxHeight: "70vh",
							overflow: "auto",
							zIndex: Z + 1,
							padding: 14,
							borderRadius: 10,
							border: "1px solid rgba(128,128,128,.28)",
							background: "var(--dsh-surface, #1c1c1f)",
							color: "var(--dsh-text, #eee)",
							boxShadow: "0 12px 40px rgba(0,0,0,.35)",
							fontFamily: FONT,
							fontSize: 12,
							lineHeight: 1.6,
						},
					},
					h("div", { style: { fontWeight: 600, marginBottom: 6 } }, "已选中 " + picked.tag + (picked.classes.length ? "." + picked.classes[0] : "")),
					h(
						"div",
						{ style: { opacity: 0.7, marginBottom: 6 } },
						"实际位置 x=" + picked.location.x + " y=" + picked.location.y + " " + picked.location.w + "×" + picked.location.h + "px · 框选覆盖 " + picked.covers + "%",
					),
					!picked.pathUnique
						? h("div", { style: { color: WARN_FG, marginBottom: 6 } }, "这条路径没能唯一命中,消息里会附上祖先链和候选元素,帮我确认下框对没有。")
						: null,
					picked.candidates.length > 0
						? h("div", { style: { opacity: 0.7, marginBottom: 6 } }, "框内还有 " + picked.candidates.length + " 个更小的元素,它们会列在消息里。")
						: null,
					h(
						"div",
						{
							[ATTR]: "target-row",
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginBottom: 8,
								marginTop: 2,
								padding: "8px 10px",
								borderRadius: 8,
								border: warnEdge(40),
								background: WARN_BG,
							},
						},
						h(
							"span",
							{
								style: {
									flex: "1 1 auto",
									color: WARN_FG,
									fontSize: 12,
									fontWeight: 500,
									lineHeight: 1.5,
								},
							},
							target
								? "目标位置 x=" + target.x + " y=" + target.y + " " + target.w + "×" + target.h + "px"
								: "要挪位置?可以再框一次,标出你想移到的地方。",
						),
						h(
							"button",
							{
								type: "button",
								style: sTargetBtn(),
								onClick: () => {
									setRect(null);
									setPhase("target");
								},
							},
							target ? "重画" : "标记目标位置",
						),
						target
							? h(
									"button",
									{
										type: "button",
										style: sTargetBtn(),
										onClick: () => setTarget(null),
									},
									"清除",
								)
							: null,
					),
					h(
						"code",
						{
							style: {
								display: "block",
								padding: "4px 6px",
								borderRadius: 5,
								background: "rgba(128,128,128,.14)",
								wordBreak: "break-all",
								marginBottom: 8,
							},
						},
						picked.path,
					),
					picked.text
						? h(
								"div",
								{ style: { opacity: 0.75, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
								"文本:" + picked.text,
							)
						: null,
					h(
						"textarea",
						{
							ref: noteRef,
							value: note,
							onChange: (event) => setNote(event.target.value),
							rows: 3,
							placeholder: "我想把它改成……(比如:字号再大一点、换成深色背景、移到右边)",
							style: {
								width: "100%",
								boxSizing: "border-box",
								resize: "vertical",
								padding: 8,
								borderRadius: 6,
								border: "1px solid rgba(128,128,128,.3)",
								background: "rgba(128,128,128,.1)",
								color: "inherit",
								fontFamily: FONT,
								fontSize: 12,
								lineHeight: 1.6,
							},
						},
					),
					failed
						? h("div", { style: { color: "#e6a23c", marginTop: 8 } }, failed)
						: null,
					failed
						? h(
								"textarea",
								{
									readOnly: true,
									value: buildMessage(picked, note, target),
									rows: 8,
									style: {
										width: "100%",
										boxSizing: "border-box",
										marginTop: 6,
										padding: 8,
										borderRadius: 6,
										border: "1px solid rgba(128,128,128,.3)",
										background: "rgba(128,128,128,.1)",
										color: "inherit",
										fontFamily: "ui-monospace, monospace",
										fontSize: 11,
									},
								},
							)
						: null,
					h(
						"div",
						{ style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 } },
						h("span", { style: { opacity: 0.55, fontSize: 11 } }, "回车换行 · Esc 取消"),
						h(
							"div",
							{ style: { display: "flex", gap: 8 } },
							h("button", { type: "button", style: sPanelBtn(false), onClick: reset }, "取消"),
							h("button", { type: "button", style: sPanelBtn(true), onClick: submit }, "发送"),
						),
					),
				);
			}

			return h(
				react.Fragment,
				null,
				button,
				react_dom.createPortal(overlay, document.body),
				panel ? react_dom.createPortal(panel, document.body) : null,
			);
		}

		function apply(ctx) {
			ctx.slots.inject("conversation.input.left", () =>
				ctx.slots.register(
					{
						name: "conversation.input.left",
						id: "dsh-ui-annotate",
						order: 120,
						label: "圈选改这里",
					},
					PickerEntry,
				),
			);
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		exports.name = "dsh-ui-annotate";
		return module.exports;
	},
});
