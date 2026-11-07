# dsh-ui-annotate

> 圈选 DSH 界面上的区域,描述想改成什么样,自动整理成一条改进请求填进输入框。
> Circle any DSH UI region, describe the change, and it lands in the composer as a structured request.

<!-- 中文 -->
<details open>
<summary><b>中文</b></summary>

## 最近更新

**0.1.2**

- 新增「标记目标位置」:说不清要挪到哪时,再框一次标出目标位置,消息里带上目标坐标、位移与尺寸差异
- 修复框选位置与实际改动位置不一致

完整记录见 [CHANGELOG.md](https://unpkg.com/dsh-ui-annotate/CHANGELOG.md)。

## 它做了什么

- 在输入框工具行左侧(`conversation.input.left`)注册一个裁剪图标按钮,悬停提示「圈选改这里」
- 点击后整屏变暗,拖框选择区域,实时显示 `宽 × 高`,`Esc` 取消
- 松手后先做命中测试,再在必要时向上收拢到能覆盖整个框的容器(仅在覆盖率真的提升时上移),
  提取:唯一 CSS 路径、祖先链、元素在视口中的**实际位置**、框选区域占该元素的百分比、
  框里还包含哪些更小的元素(按覆盖面积排序)、class、`role` / `aria-label`、文本、`data-*`、当前样式
- CSS 路径会一直向上拼到**全页唯一命中该元素**为止(有 id 也验证唯一性),并在消息里明确
  「实际位置」与「请落在这个坐标范围内」,避免改动落到相邻元素上
- 弹出面板写「我想把它改成……」:面板里会显示实际位置与覆盖比例,**回车换行**,确认用「发送」按钮
- 想挪位置但说不清挪到哪?点面板里的「标记目标位置」再拖一次框,消息里会多出目标框坐标、
  相对位移与尺寸差异;可以「重画」「清除」,不标记就跟原来一样
- 点「发送」后把整理好的消息插入输入框草稿,**不会自动提交**,你还能再改
- 纯客户端插件:不访问文件系统、不截图、不上传任何东西,宿主侧 `lib/index.js` 是空的

生成的消息长这样:

```
【界面调整请求】我想修改 DSH 界面上的这个位置。

- 目标元素(CSS 路径): `section#settings-card`(该路径在全页唯一命中此元素)
- 元素: <section>
- 祖先链: body > div#app > main
- 元素实际位置(视口坐标): x=560 y=180 w=320 h=96 / 视口 1440×900 @2x
- 框选区域(视口坐标): x=572 y=192 w=290 h=72 —— 占该元素的 88%
- 元素文本: "插件市场 这里是一段说明文字"
- 当前样式: color: rgb(…) / background-color: … / border-radius: 8px

框选范围内包含的元素(按覆盖面积排序):
  1. `h2#settings-title` — 覆盖 16% — h2 "插件市场" @ x=572 y=192 w=180 h=28
  2. `p.settings-desc` — 覆盖 37% — p "这里是一段说明文字" @ x=572 y=232 w=290 h=32

注意:改动请落在上面「元素实际位置」的坐标范围内,不要挪到相邻元素上。

移动目标位置(我另外框出来的):
  - 目标框(视口坐标): x=860 y=300 w=320 h=96
  - 相对元素中心点的位移: dx=180px, dy=120px(正数向右/向下)
  - 目标框与元素尺寸: 基本一致,只挪位置
  - 请把该元素移动/调整到上面「目标框」覆盖的区域内。

我想改成: 标题再大一点,说明文字换成浅灰
```

## 安装

```bash
dsh plugin --profile web add dsh-ui-annotate
```

然后**完全退出并重开** DSH NEXT(客户端插件的 bundle 只在启动时重新扫描、重算 `rev`)。

装完在输入框左侧会多一个 ⛶ 按钮。

## 只用得到这些 API

| 用途 | API |
|---|---|
| 挂按钮 | `ctx.slots.inject("conversation.input.left", …)` + `ctx.slots.register({ name, id, order, label }, Component)` |
| 写输入框 | `conversation.input.for(actx)` → `actions.captureInsertion()` / `insertText(text, span)`,失败落 `setDraft()` |

不依赖任何宿主侧能力,也不新增端口、进程或权限。

## 开发

```bash
./sync.sh        # 把当前源码覆盖进 web profile 的 node_modules/dsh-ui-annotate
```

profile 里装的是 registry 上的发布版本(依赖写作 `^0.1.0`),所以改完源码要先跑一次
`sync.sh` 才能本地验证。改完同样要完全退出并重开 DSH NEXT 才会生效。

发布新版:

```bash
npm version patch      # 或 minor / major
npm publish            # 需要 2FA
```

</details>

---

## English

A DSH client plugin: circle a region of the harness UI, describe what you want changed, and the plugin turns it into a structured request in the composer.

### What's new

**0.1.2**

- "Mark target position": drag a second box to show where the element should go; the
  message then carries the target rect, the offset and any size difference
- Fixed selection drift — the element reported did not match the area actually changed

Full history: [CHANGELOG.md](https://unpkg.com/dsh-ui-annotate/CHANGELOG.md).

### What it does

- Adds a crop-icon button to `conversation.input.left` (tooltip: "圈选改这里" / annotate here)
- Click it, the screen dims; drag a rectangle (live `w × h`, `Esc` to cancel)
- On release it hit-tests the center point, climbs to a container only while that
  enlarges coverage, and extracts:
  a unique CSS path, the ancestor chain, the element's **actual viewport position**, the
  frame's coverage of that element, the smaller elements inside the frame (ranked by
  covered area), classes, `role` / `aria-label`, text, `data-*` attributes, and a subset
  of computed styles
- Paths are extended upward until they match **exactly one element** on the page (ids are
  verified too), and the message states the actual coordinates with an explicit "keep the
  change inside this box" note, so edits stop landing on neighbours
- Can't describe where it should go? Click **"标记目标位置"** in the panel and drag a
  second box — the message then carries the target rect, the centre-to-centre offset and
  any size difference. Re-draw or clear it at any time; skip it and nothing changes
- A panel opens for your description — it shows the actual position and coverage,
  **Enter inserts a newline**, the "发送" button confirms
- The composed message is inserted into the composer draft — **never auto-submitted**
- Pure client-side: no filesystem access, no screenshots, no uploads; the host half (`lib/index.js`) is empty

### Install

```bash
dsh plugin --profile web add dsh-ui-annotate
```

Fully quit and reopen DSH NEXT afterwards — client bundles are only rescanned at startup.

### Development

```bash
./sync.sh        # overwrite node_modules/dsh-ui-annotate in the web profile with this source
```

The profile installs the published registry version (dependency pinned as `^0.1.0`), so
run `sync.sh` to verify local source changes before cutting a release.

```bash
npm version patch      # or minor / major
npm publish            # 2FA required
```

### Surface area

Two documented APIs only: `ctx.slots.register(...)` for the button, and
`conversation.input.for(actx)` → `captureInsertion()` / `insertText()` / `setDraft()`
for writing the draft. No extra ports, processes, or permissions.

## License

MIT
