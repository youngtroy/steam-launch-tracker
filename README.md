# Steam Launch Tracker

## GitHub Pages 部署

可以直接部署成 GitHub Pages 静态网页，并用 GitHub Actions 每天自动采集和归档。

部署步骤见：

```text
GITHUB_PAGES_DEPLOY.md
```

核心文件：

```text
.github/workflows/daily-pages.yml
```

工作流每天 `09:35 Asia/Shanghai` 执行一次：

```powershell
npm run daily
npm run build:pages
```

## 一键启动

双击：

```text
start.bat
```

它会自动：

- 生成缺失的 `config.json`
- 采集 Top 5 热门即将推出榜单数据
- 启动本地看板服务
- 打开 `http://localhost:5177`

如果只想命令行启动：

```powershell
npm run launch
```

## 每日自动采集和归档

注册 Windows 每日任务：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File install-daily-task.ps1
```

默认每天 `09:30` 执行：

```powershell
npm run daily
```

归档文件：

```text
data/archive.json
data/archive.csv
```

归档口径：

- 发售前 7 天：每天的 Steam `Top Wishlists` 公开愿望单排名。
- 发售后 0 到 7 天：每天的 Steam 评论总数。
- 入池对象：Steam `Popular Upcoming` 热门即将推出榜单。

本工具用于追踪 Steam 公开可见的热门即将推出作品在上线前后一段时间的表现，重点是 `T-7 ~ T+7` 窗口。

它不会伪造“愿望单数量”：Steam 不公开每个游戏的 wishlist count。这里默认采集的是 Steam 热门即将推出榜单排名、评测摘要、当前在线人数、价格/发售状态等。

## 使用

```powershell
cd D:\test\steam-launch-tracker
Copy-Item config.example.json config.json
npm run collect
npm run serve
```

打开：

```text
http://localhost:5177
```

如果只是想先看界面：

```powershell
npm run sample
npm run serve
```

## 采集数据

- `rank`: Steam `Popular Upcoming` 搜索结果中的公开排名。
- `current_players`: Steam Web API 当前在线人数。
- `reviews_total / reviews_positive / reviews_negative`: Steam appreviews 摘要。
- `coming_soon / detected_release_at`: 通过 Store appdetails 状态检测。
- `price_text / discount_percent`: Store appdetails 价格信息。

数据保存在：

```text
data/data.json
```

建议用 Windows 任务计划程序或 cron 每 1 小时执行一次 `npm run collect`。

## 注意

- Steam 页面和接口可能限流或调整结构，采集器会把错误写入 `data/errors.log`。
- SteamDB 不提供公开 API，也明确不允许自动抓取它的页面；本工具只从 Steam 公开页面/API 取数。
- 愿望单数量只有开发者可在 Steamworks 后台看到，公开工具只能记录公开排名或做谨慎估算。
