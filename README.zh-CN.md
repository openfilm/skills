# OpenFilm skills

[English](README.md) · 简体中文

[OpenFilm](https://github.com/openfilm/openfilm) 自带的 skill。一个 skill 是交给 agent 的一份需求书：这类片子要达到什么效果、哪几件事必须为真、OpenFilm 为它提供了什么。怎么做是 agent 自己的手艺，skill 不教。

## skill 的定位

**这些 skill 只是帮你快速起步。** 有了它们，做每一类片子不必从一张白纸开始。模型越强，越不需要它们：通用大模型早已学会的东西（怎么剪、怎么设计、怎么做动画、怎么讲故事）不需要 skill 来教，这些 skill 也会随着模型进步而变短，甚至退役。

**skill 最有价值的用途，是放进只有你知道的信息**：你的品牌、你的系列和固定开头、你的频道说话的方式、你的人物和规矩。这些是模型在任何地方都学不到的。把它们做成你自己的 skill，skill 才会一直有价值。

**OpenFilm 支持任何 skill。** 为其他工具写的 skill，哪怕教的是别的产品的架构或代码，也一样能用：OpenFilm 会读懂这个 skill 要做什么，再按自己的技术方案实现，做成由网页组成、能在 Studio 里继续修改的片子。可以从文件夹或链接添加。

## 场景

| | | |
| --- | --- | --- |
| <img src="skills/replicate/cover.jpg" width="200" alt=""> | [视频复刻](skills/replicate) | 在 OpenFilm 里重做一条视频：可以逐帧一模一样，也可以换成你的内容。 |
| <img src="skills/long-to-short/cover.jpg" width="200" alt=""> | [长视频转短视频](skills/long-to-short) | 把讲座、播客、直播切成一条条能单独看懂的竖版短视频。 |
| <img src="skills/screen-demo/cover.jpg" width="200" alt=""> | [录屏演示](skills/screen-demo) | 把录屏做成精致的演示，展示的是真实的产品。 |
| <img src="skills/motion-graphics/cover.jpg" width="200" alt=""> | [高级 MG 动画](skills/motion-graphics) | 工作室水准的讲解、宣传或片头，只属于这个主题。 |
| <img src="skills/presenter-pip/cover.jpg" width="200" alt=""> | [小窗人物口播](skills/presenter-pip) | 讲到什么，画面就满屏展示什么，人在小窗里。 |

## 风格

| | | |
| --- | --- | --- |
| <img src="skills/whiteboard/cover.jpg" width="200" alt=""> | [手绘白板风格](skills/whiteboard) | 配音讲到哪，板上就画到哪。 |
| <img src="skills/vintage-film/cover.jpg" width="200" alt=""> | [复古胶片相册](skills/vintage-film) | 把照片和视频做成回忆短片，像从老胶卷里找出来的。 |
| <img src="skills/lyric-video/cover.jpg" width="200" alt=""> | [动态歌词 MV](skills/lyric-video) | 为一首歌量身定做的歌词视频，每个字都落在歌声上。 |
| <img src="skills/keynote/cover.jpg" width="200" alt=""> | [发布会风格](skills/keynote) | 真实的产品上台，一次只讲一件事。 |
| <img src="skills/collage/cover.jpg" width="200" alt=""> | [剪贴风 MG](skills/collage) | 用照片、纸张和印刷品剪下来、亲手拼成的动画。 |

## 怎么用

- **在 OpenFilm 里**：已经内置。在对话里选一个，或者在消息里点名。
- **在你自己的 agent 里**（Claude Code、Codex 等）：先装 OpenFilm，再装这些。

  ```sh
  npx skills add openfilm/openfilm
  npx skills add openfilm/skills
  ```

- **你自己的 skill**：[SPEC.md](SPEC.md) 说明怎么为 OpenFilm 写 skill。OpenFilm 可以从文件夹或链接添加，也可以和你一起做一个。

每个 skill 有自己的版本号，写在它的 `openfilm.json` 里；[CHANGELOG.md](CHANGELOG.md) 记录改了什么、为什么改。

## 许可

[MIT](LICENSE)。封面由 OpenFilm 贡献者制作，同样按 MIT 授权。
