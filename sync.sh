#!/usr/bin/env bash
# 把工作区里的插件源码同步进 web profile,然后重启 DSH 生效。
#
# 用法:
#   cd ~/Desktop/test/dsh-ui-annotate && ./sync.sh
#
# 为什么需要它:profile 里装的是 npm registry 上的已发布版本(依赖写作 "^0.1.0"),
# 改完源码不会自动生效。这个脚本把当前源码直接覆盖进 node_modules,
# 用于在发布新版之前本地验证。
#
# 注意:目标在 ~/.dsh 下,属于工作区之外,需要放行沙箱(在 DSH 里跑时用 danger-full-access,
#       或者直接在普通终端里跑,普通终端没有沙箱限制)。
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
PROFILE="${DSH_HOME:-$HOME/.dsh}/profiles/web"
DST="$PROFILE/node_modules/dsh-ui-annotate"

# 只同步 package.json 里 files 列出的内容,和 npm 打包结果保持一致
rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC/lib" "$SRC/cordis.patch.yml" "$SRC/README.md" "$SRC/CHANGELOG.md" "$SRC/LICENSE" "$SRC/package.json" "$DST/"

echo "已更新: $DST"
echo "下一步: 完全退出 DSH NEXT(⌘Q)后重新打开,客户端 bundle 会重新打包。"
echo "注意: dsh plugin ... update 会用 registry 版本覆盖这份改动。"
