# OpenFilm skills

[English](README.md) · 简体中文

[OpenFilm](https://github.com/openfilm/openfilm) 的 skill 索引，以及怎么写一个 skill。一个 skill 是交给 agent 的一份需求书：这类片子要达到什么效果、哪几件事必须为真、OpenFilm 为它提供了什么。怎么做是 agent 自己的手艺，skill 不教。

skill 本身不放在这里。每个 skill 有自己的仓库，有自己的 issue、版本，以及用来实测它的真实需求。这个仓库只记录它们在哪。

| | |
| --- | --- |
| [index.json](index.json) | OpenFilm 展示的 skill，每个固定到它仓库的某一个提交 |
| [SPEC.md](SPEC.md) | 怎么写、怎么实测、怎么登记一个 OpenFilm skill |
| [template/](template) | 新建 skill 仓库时的起点 |
| `scripts/` | `check.mjs` 检查 skill；`pin.mjs` 把一个仓库里的 skill 登记到这里 |

## 现有的 skill

| | | |
| --- | --- | --- |
| [视频复刻](https://github.com/openfilm/skill-replicate) | `openfilm/replicate` | 在 OpenFilm 里把一条视频重新做出来：外观和节奏都一样，内容换成你的；也可以逐帧一模一样。 |

我们一个一个地做，每个都用真实需求实测。OpenFilm 的「发现」读的就是 [index.json](index.json)，登记进来的 skill 会马上出现在每个 OpenFilm 里。

## skill 的定位

**skill 最有价值的用途，是放进只有你知道的信息**：你的品牌、你的系列和固定开头、你的频道说话的方式、你的人物和规矩。这些是模型在任何地方都学不到的。把它们做成你自己的 skill。

**OpenFilm 支持任何 skill。** 为其他工具写的 skill 也一样能用：OpenFilm 会读懂这个 skill 要做什么，再按自己的方式实现，做成由网页组成、能在 Studio 里继续修改的片子。可以从文件夹或链接添加。

## 自己做一个

把 [template/](template) 复制到一个新仓库，按 [SPEC.md](SPEC.md) 写需求书，再用真实需求实测。每个 pull request 都会自动跑检查。

## 许可证

[MIT](LICENSE)。
