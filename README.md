## GitHub Pages 博客

## 本地运行

先安装 Ruby 和 Bundler (Ruby 的包管理器)
```bash
winget search Ruby
```

寻找带 MSYS2 的最新版本安装 (新版通常自带 Bundler)
```
winget install RubyInstallerTeam.RubyWithDevKit.3.4
```

进入项目目录, 安装项目依赖
```bash
bundle install
```

启动服务器
```bash
bundle exec jekyll serve
```


预览效果: [http://localhost:4000](http://localhost:4000)
实际效果: [https://sherlocknieh.github.io](https://sherlocknieh.github.io)

