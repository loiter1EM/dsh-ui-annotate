# 更新日志 / Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。每个版本的改动都记录在这里。

All notable changes to this project are documented in this file.

---

## 0.1.2 — 2026-11-07

### 新增

- **标记目标位置(第二框)**:面板里新增一行琥珀色提示条,点「标记目标位置」后可以再拖一个框,
  标出你想把元素挪到/改成哪。消息里会多出一段:

  ```
  移动目标位置(我另外框出来的):
    - 目标框(视口坐标): x=860 y=300 w=320 h=96
    - 相对元素中心点的位移: dx=180px, dy=120px(正数向右/向下)
    - 目标框与元素尺寸: 基本一致,只挪位置
    - 请把该元素移动/调整到上面「目标框」覆盖的区域内。
  ```

  支持「重画」「清除」;`Esc` 在第二框阶段只退回面板,不会取消整个操作;不标记就和旧版完全一样。
- 选中元素以蓝色虚线框、目标框以绿色实线框同时显示,各自带 `宽×高` 标签。
- 面板新增「框内还有 N 个更小的元素」提示行;路径不唯一时显示琥珀色告警。

### 修复

- 框选位置与实际改动位置不一致

---

## 0.1.1 — 2026-11-06

**仅文档与开发脚本,无功能改动。** 发布这一版是为了让 npm 页面上的 README 同步。

- README 补充开发流程(`./sync.sh` → `npm version patch` → `npm publish`)。
- `sync.sh` 改为只覆盖 `node_modules/dsh-ui-annotate`(原先还会写一个无人读取的 `local/` 副本)。

---

## 0.1.0 — 2026-11-06

首个版本。

- 在输入框工具行左侧(`conversation.input.left`)注册裁剪图标按钮,悬停提示「圈选改这里」。
- 点击后整屏变暗,拖框选择区域,实时显示 `宽 × 高`,`Esc` 取消。
- 松手后提取:CSS 路径、class、`role` / `aria-label`、文本、`data-*`、当前样式子集、元素尺寸。
- 弹出面板写「我想把它改成……」,**回车换行**,确认用「发送」按钮。
- 点「发送」把整理好的消息插入输入框草稿,**不会自动提交**。
- 写入输入框三级回退:`insertText` → `setDraft()` + `persistDraft()` → 手动复制文本框。
- 纯客户端插件:不访问文件系统、不截图、不上传;宿主侧 `lib/index.js` 为空,不新增端口或权限。

---

## English

### 0.1.2 — 2026-11-07

**Added**

- **Mark target position (second box).** A new amber row in the panel opens a second
  drag pass so you can show *where* the element should go or how it should be sized.
  The message gains a block with the target rect, the centre-to-centre offset
  (`dx` / `dy`), and whether the sizes differ. Re-draw or clear it at any time;
  `Esc` during the second pass only returns to the panel; skip it and behaviour is
  exactly as before.
- The picked element (blue dashed) and the target (green solid) are shown together,
  each labelled with its own `w × h`.
- The panel now reports how many smaller elements sit inside the frame, and warns in
  amber when the CSS path is not unique.

**Fixed**

- Selection drift — the reported element did not match the area actually changed.

### 0.1.1 — 2026-11-06

Docs and dev script only; no functional change. Published to sync the README on npm.

### 0.1.0 — 2026-11-06

Initial release: circle any region, describe the change, and get a structured request
inserted into the composer draft (never auto-submitted).
