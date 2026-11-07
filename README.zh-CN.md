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

| | | 作者 | |
| --- | --- | --- | --- |
| [视频复刻](https://github.com/openfilm/skill-replicate) | `openfilm/replicate` | OpenFilm | 在 OpenFilm 里把一条视频重新做出来：外观和节奏都一样，内容换成你的；也可以逐帧一模一样。 |
| [口播精剪](https://github.com/WEBGRS/openfilm-talking-head) | `webgrs/talking-head` | WEBGRS | 你的口播录像：只在停顿处下刀，去掉能干净取出的口癖和空档，再加上重点词、人物名片和封面。 |
| [素材剪成片](https://github.com/WEBGRS/openfilm-footage-cut) | `webgrs/footage-cut` | WEBGRS | 用你自己拍的素材剪成片：每个镜头都配着当时说的话，跟着你的解说，或者素材里讲出来的故事。 |
| [音乐卡点](https://github.com/WEBGRS/openfilm-beat-cut) | `webgrs/beat-cut` | WEBGRS | 跟着音乐剪：每次换画面都踩在拍子上，安静段镜头更长，音乐起来的那一秒正好换镜头。 |
| [横屏转竖屏](https://github.com/WEBGRS/openfilm-reframe) | `webgrs/reframe` | WEBGRS | 把横屏素材做成竖屏或方形：先测每个镜头的主体，把画框画在帧上，测错的地方再靠看图改。 |
| [换语种配音](https://github.com/WEBGRS/openfilm-dub) | `webgrs/dub` | WEBGRS | 把配好音的片子做成另一种语言：重新配音，画面文字和字幕一起换，每个画面仍然踩在它的词上。 |
| [小窗口播产品推广](https://github.com/WEBGRS/openfilm-pip-promo) | `webgrs/pip-promo` | WEBGRS | 产品的真实画面按你说的话依次出现；你在小窗里讲，小窗自己让开正在演示的地方。 |
| [可重录的网页演示](https://github.com/WEBGRS/openfilm-web-demo) | `webgrs/web-demo` | WEBGRS | 按步骤从线上产品录出的演示，每次改版后按原步骤重录，剪辑原样保留。 |

我们一个一个地做，每个都用真实需求实测。OpenFilm 的「发现」读的就是 [index.json](index.json)，登记进来的 skill 会马上出现在每个 OpenFilm 里。

## 整体怎么运作

1. **每个 skill 是一个独立的仓库**，谁都可以做：需求书放在 `skills/<名字>/`，用来实测的真实需求和结果写在 `evals/README.md`，版本用
   标签记录，有自己的 issue 和 pull request。模板自带的 workflow 会在每次推送时跑这个仓库的检查。skill 的名字是
   `<所有者>/<名字>`，取自仓库所有者：`openfilm/replicate` 是我们的；放在别人账号下的 skill 属于他们，在任何地方展示都带
   着他们的名字。
2. **这个仓库登记值得展示的 skill。** `index.json` 里的每一条都固定到 skill 仓库的某一个提交，所以大家拿到的就是审核过的
   那一版，重新固定之前不会变。登记一个 skill 或升级到新版本，用 `pin.mjs` 生成改动再提 pull request。登记的条件：检查
   通过，需求书符合 [SPEC.md](SPEC.md)，仓库写明了许可证，并且用真实需求做过带和不带它的对比实测。
3. **OpenFilm 读取这个索引。** 「发现」里每个登记的 skill，展示内容来自它自己的 `openfilm.json`（按固定的提交读取）；安
   装就是复制那个提交。索引固定到更新的提交时，已安装的 skill 会提示更新；从索引里移除后，已安装的仍然保留，并标明已不
   在索引里。没有登记的 skill，也可以从文件夹或链接添加。

## skill 的定位

**skill 最有价值的用途，是放进只有你知道的信息**：你的品牌、你的系列和固定开头、你的频道说话的方式、你的人物和规矩。这些是模型在任何地方都学不到的。把它们做成你自己的 skill。

**OpenFilm 支持任何 skill。** 为其他工具写的 skill 也一样能用：OpenFilm 会读懂这个 skill 要做什么，再按自己的方式实现，做成由网页组成、能在 Studio 里继续修改的片子。可以从文件夹或链接添加。

## 自己做一个

把 [template/](template) 复制到一个新仓库，按 [SPEC.md](SPEC.md) 写需求书，再用真实需求实测。每个 pull request 都会自动跑检查。

## 许可证

[MIT](LICENSE)。
