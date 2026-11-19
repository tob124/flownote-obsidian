# FlowNote for Obsidian

FlowNote 的 Obsidian 原型。把想法写成独立的 Markdown 文件，用主题页和 Bases 浏览，用自己的 DeepSeek Key 整理笔记、综合主题以及回顾相关的旧想法。跨设备同步可交给坚果云的 Nutstore Sync 插件。

## 第一次打开

1. 解压下载包，保留 `FlowNote-Vault/.obsidian` 隐藏目录。在 Obsidian 1.11.5 或更新版本里，选择「打开文件夹作为库」，打开 `FlowNote-Vault`。
2. 打开「设置 → 核心插件」，启用 Bases（数据库）。在「设置 → 第三方插件」关闭受限模式，再启用 **FlowNote Assistant**。构建后的插件已经随示例库提供。
3. 打开「首页」。点击侧栏的 FlowNote 助手图标，或在命令面板搜索「FlowNote Assistant」。
4. 先不填 Key 试用。选择「随手记」录入一条想法，再用「整理当前笔记」选择已有主题。用「生成主题 Wiki」试出一份离线 Wiki。运行 Dream，输入「怎样从失败样本完善评价指标」，查看来自不同主题的候选和原笔记链接。

| 功能 | 用法 |
| --- | --- |
| 随手记 | 只填原话也能保存。每条记录是一个新文件。可以在 Obsidian 中给命令设置快捷键。 |
| 整理笔记 | 打开收件箱的一条笔记。手动编辑属性，或让 DeepSeek 建议标题、主题、标签和摘要。确认后才写入属性。 |
| Wiki | 从「主题」文件夹选一个主题，生成索引；接入 DeepSeek 后可以生成带引文的综合草稿。 |
| Dream | 用中文词项匹配或英文关键词筛出最多八篇笔记，可离线保存候选，也可以让 DeepSeek 根据候选做跨主题回顾。 |
| 当前判断 | 示例主题页有「当前判断」区域。可以自行编辑，AI 把综合结果写成独立回顾页。 |

## 接入自己的 DeepSeek

在「设置 → FlowNote Assistant」保存 Key。插件使用 Obsidian 的密钥存储，通过 DeepSeek 官方 `chat/completions` 接口调用 `deepseek-flash`。打开 Obsidian、离线记录、离线 Wiki 和候选检索都不会发起模型请求。点击对应的 AI 按钮时，才会发送该操作提示中列出的摘录和相关字段。Wiki 和 Dream 会检查返回的引句能否在提供给模型的摘录中找到，再附上原笔记链接。引句能对上原文，观点和关联仍值得自己复核。

## 接入坚果云

在每台设备为同一个 Vault 安装 [Nutstore Sync](https://community.obsidian.md/plugins/nutstore-sync)，登录坚果云，选择一个新的专用远程目录和双向同步。先让电脑上传完整示例库内容，再接入另一台设备。首次同步先看操作预览。建议先同步 Markdown 和 Bases 文件，各设备分别启用插件和配置 Key，试用期间保持 `.obsidian` 配置目录的同步关闭。第二台设备也需要拥有本包的插件文件。手机可先断网记一条，再联网手动同步，回到电脑确认收到，随后在反方向验证一次。

同一个 Vault 只使用一套双向同步。真实笔记放在试用库以外，或者在导入前保留独立备份。若用 Git 管理插件源代码，可把日常笔记库复制到项目目录之外。

## 源码与验证

源码在 `src/`，随库交付的 Obsidian 插件在 `FlowNote-Vault/.obsidian/plugins/flownote-assistant/`。Node.js 20 以上运行 `npm run check`，会构建插件、执行测试和检查生成代码语法，无须安装第三方依赖。提交前重新运行构建。

当前原型的 Dream 使用中文双字词项和英文关键词，语义向量检索、自动定时回顾和外部资料检索暂未接入。Windows 和 Android 的实际同步、Obsidian 客户端显示及真实 DeepSeek 请求需要在配置好插件、账号和 Key 后做设备验收。

接口资料：[Bases](https://obsidian.md/help/bases) · [Obsidian 密钥存储](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Guides/Store%20secrets.md) · [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
