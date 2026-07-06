# Steam Launch Tracker

追踪 Steam `Popular Upcoming` 游戏在发售前后窗口里的公开数据表现。

当前方案是文档归档，不依赖 GitHub Pages：

- 每天由 GitHub Actions 自动执行采集。
- 数据写入 `data/data.json`、`data/archive.json`、`data/archive.csv`。
- 面向阅读的结果写入 [`REPORT.md`](REPORT.md)。
- Actions 只 commit 文件，不部署网页。

## 追踪口径

入池游戏来自 Steam `Popular Upcoming`。

发售前数据：

- T-7 到 T-1 每天记录一次公开愿望单排名。
- 愿望单排名来自 Steam `Top Wishlists`，通过 appid 匹配到入池游戏。
- Steam 不公开单个游戏的 wishlist count，所以这里记录的是 rank，不是数量。

发售后数据：

- D0 到 D7 每天记录一次 Steam 公开评论总数。

## 文档入口

直接在 GitHub 仓库打开：

```text
REPORT.md
```

适合表格处理的文件：

```text
data/archive.csv
```

完整结构化数据：

```text
data/archive.json
data/data.json
```

## 自动任务

工作流文件：

```text
.github/workflows/daily-report.yml
```

现在已经不部署 Pages，只生成文档报告。默认每天 `09:35 Asia/Shanghai` 执行一次。

本地手动执行：

```powershell
npm run daily
```

只重新生成报告：

```powershell
npm run report
```

## 本地查看旧网页

旧的本地网页代码仍保留，方便需要时本地预览：

```powershell
npm run serve
```

然后打开：

```text
http://localhost:5177
```

这个本地网页不再是线上发布方案的一部分。

## 注意

- Steam 页面和接口可能限流或调整结构。
- SteamDB 没有公开 API，也不适合自动抓取页面。
- 本工具只使用 Steam 公开页面/API 能拿到的数据。
