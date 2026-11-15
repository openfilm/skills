# OpenFilm 社区

[English](README.md) · 简体中文

大家分享给 [OpenFilm](https://github.com/openfilm/openfilm) 的东西都在这里：技能、工作台、连接器和素材。每个版本在到达任何人手里之前，都要在这里经过检查。OpenFilm 的社区窗口（发现、已添加、发布）展示的，就是这里和素材库里登记的内容。

| | |
| --- | --- |
| [index.json](index.json) | OpenFilm 展示的技能、工作台和连接器，每个固定到一个提交；以及已下架的内容 |
| [kinds.json](kinds.json) | 作品的种类：名字、在 OpenFilm 里出现在哪、怎么审核 |
| [schema/openfilm.schema.json](schema/openfilm.schema.json) | 作品的 `openfilm.json`：怎么展示、声明了哪些权限 |
| [SPEC.md](SPEC.md) | 怎么写、怎么实测、怎么登记一个 OpenFilm skill |
| [POLICIES/](POLICIES) | [社区准则](POLICIES/community-guidelines.md)、[开发者政策](POLICIES/developer-policy.md)、[审核标准](POLICIES/review-standard.md)、[许可](POLICIES/licensing.md)、[下架和申诉](POLICIES/takedown-and-appeals.md)、[标准回复](POLICIES/canned-responses.md) |
| [SECURITY.md](SECURITY.md) · [REMOVED.md](REMOVED.md) | 怎么报告安全问题；所有下架记录 |
| [template/](template) | 新建 skill 仓库时的起点 |
| `scripts/` | `check.mjs` 检查作品；`scan.mjs` 找政策禁止的东西；`review.mjs` 是 AI 审核；`pin.mjs` 把仓库里的 skill 登记到这里；`digest.mjs` 算一个文件夹的摘要 |

## 怎么参与

1. **使用。** 在 OpenFilm 里打开社区，喜欢就添加，不用登录。登记的东西都免费，素材可以免费商用。
2. **分享素材。** 模板、文字样式、贴纸、特效、转场、滤镜、音效和音乐，必须是你自己做的，以 CC0 分享。目前投到 [openfilm/library](https://github.com/openfilm/library)，见它的 [CONTRIBUTING.md](https://github.com/openfilm/library/blob/main/CONTRIBUTING.md)。
3. **开发。** 技能、工作台和连接器，放在你自己的开源仓库里，登记到这里。从 [template/](template) 开始，先读[开发者政策](POLICIES/developer-policy.md)。

不管在哪一级，都可以举报问题、参与审核。

## 种类

种类是一张开放的表（[kinds.json](kinds.json)），加一个种类就是加一条。每个种类走两条路线之一。

| 种类 | 路线 | 在 OpenFilm 里出现在 | 档位 |
| --- | --- | --- | --- |
| 工作台 | 代码 | 自己的工作界面，从工作台切换里选 | C |
| 技能 | 代码 | 交给智能体 | B |
| 连接器 | 代码 | 智能体的连接器 | C |
| 模板、文本、贴纸、特效、转场、滤镜、音效、音乐 | 素材 | 素材库里对应种类的标签页 | A |

- **代码**放在发布者自己的仓库里，有自己的 issue 和版本。这个仓库在 [index.json](index.json) 里登记它，固定到一个提交：大家拿到的就是审核过的那一版，重新固定之前不会变。
- **素材**是没有代码的文件，目前放在 [openfilm/library](https://github.com/openfilm/library)，由它发布到 OpenFilm 读取的目录。

## 怎么审核

每个作品的每个版本都审，不只是第一版：

1. **检查**：`check.mjs` 检查格式：名字、语言、文件、大小、指回源码的链接。
2. **扫描**：`scan.mjs` 读每个文件，找[开发者政策](POLICIES/developer-policy.md)禁止的东西：隐藏字符、藏起来的指令、让人粘贴的命令、读取密钥、运行时加载或安装代码、混淆、用了却没声明的域名。
3. **AI 审核**：`review.mjs` 把整个作品、扫描结果、和上一个登记版本的差异，连同[审核标准](POLICIES/review-standard.md)一起交给顶级 AI 模型。它对比作品自己说的用途和它实际让智能体、让电脑做的事，对比声明的权限和代码的实际行为。结论会贴在 pull request 上。
4. **人工**：审核标准要求时就由人来定：新发布者、权限增加、有高危发现、带"元素"、模型拿不准。每次登记都由维护者合并。

pull request 上的检查只读，拿不到任何密钥。AI 审核跑的是这个仓库自己的代码，把作品当数据读：审核时作品里的任何东西都不会被运行。

在 OpenFilm 里：页面只能访问作品声明的域名；项目自带的技能默认关闭，要人同意才启用；带脚本的社区技能安装前会先问；已下架的东西在所有地方都会被停用。

## 信任

- **谁做的**：每个作品都有全名 `<所有者>/<名字>`，取自发布它的 GitHub 账号。`openfilm/` 是 OpenFilm 自己的。发布者的账号要满 7 天，并开启两步验证。
- **它能做什么**：添加之前先展示它的权限，每项附一句理由。
- **你拿到的是什么**：就是审核过的那个提交。
- **只叫"已扫描"，不叫"安全"**：检查能降低风险，不能消除风险。添加之前看一看它是什么。
- **下架**：发现有害的作品会加进 [index.json](index.json) 的 `revoked`，在每个 OpenFilm 里停用，并记录在 [REMOVED.md](REMOVED.md)。

## 举报

- **作品**违反规则或名不副实：[提交举报](../../issues/new?template=report.yml)，写上全名、原因和证据。涉及个人信息的证据发到 support@openfilm.dev。
- **安全问题**或恶意软件：按 [SECURITY.md](SECURITY.md) 私下报告。
- **你的作品未经许可被分享**：legal@openfilm.dev。

之后怎么处理：见[下架和申诉](POLICIES/takedown-and-appeals.md)。

## 现有的 skill

| | | 作者 | |
| --- | --- | --- | --- |
| [视频复刻](https://github.com/openfilm/skill-replicate) | `openfilm/replicate` | OpenFilm | 在 OpenFilm 里把一条视频重新做出来：外观和节奏都一样，内容换成你的；也可以逐帧一模一样。 |

一个 skill 是交给智能体的一份需求书：这类片子要达到什么效果、哪几件事必须为真、OpenFilm 为它提供了什么。怎么做是智能体自己的手艺，skill 不教。

**skill 最有价值的用途，是放进只有你知道的信息**：你的品牌、你的系列和固定开头、你的频道说话的方式、你的人物和规矩。这些是模型在任何地方都学不到的。把它们做成你自己的 skill。

**OpenFilm 支持任何 skill。** 为其他工具写的 skill 也一样能用：OpenFilm 会读懂这个 skill 要做什么，再按自己的方式实现，做成由网页组成、能在 Studio 里继续修改的片子。可以从文件夹或链接添加。

## 开发和登记一个 skill

1. **每个 skill 是一个独立的仓库**，谁都可以做：需求书放在 `skills/<名字>/`，用来实测的真实需求和结果写在 `evals/README.md`，版本用标签记录，有自己的 issue 和 pull request。把 [template/](template) 复制过去，按 [SPEC.md](SPEC.md) 写需求书，再用真实需求实测。模板自带的 workflow 会在每次推送时跑这个仓库的检查。skill 的名字是 `<所有者>/<名字>`：`openfilm/replicate` 是我们的；放在别人账号下的 skill 属于他们，在任何地方展示都带着他们的名字。
2. **用 pull request 登记到这里。** `node scripts/pin.mjs <仓库> [标签]` 把仓库里的 skill 加进 [index.json](index.json)，或升级到更新的提交，版本号取自各自的 `openfilm.json`；然后 `node scripts/check.mjs` 按固定的提交取回每个 skill 并检查。登记的条件：检查通过，需求书符合 [SPEC.md](SPEC.md)，仓库有开源许可证，版本打了标签，用真实需求做过带和不带它的对比实测，并且通过上面的审核。
3. **OpenFilm 读取这个索引。** 「发现」里每个登记的 skill，展示内容来自它自己的 `openfilm.json`（按固定的提交读取）；安装就是复制那个提交。索引固定到更新的提交时，已安装的 skill 会提示更新；从索引里移除后，已安装的仍然保留，并标明已不在索引里，被下架的除外。没有登记的 skill，也可以从文件夹或链接添加。

自己跑检查（在这个仓库的副本里，需要 Node.js 22.2 或更新）：

```sh
node scripts/check.mjs <你的仓库>                 # 格式
node scripts/scan.mjs <你的 skill 文件夹>          # 政策禁止的东西
node scripts/review.mjs <你的 skill 文件夹> --dry-run   # AI 审核会发出的提示词
node --test scripts/*.test.mjs                    # 这个仓库自己的测试
```

## 许可证

[MIT](LICENSE)。
