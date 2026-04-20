# 中子星经典模型 3D 动画网页

这是一个已经整理好的静态网站仓库版本，适合直接上传到 GitHub，然后一键接入 Netlify。

## 仓库内容

- `index.html`：网页入口
- `styles.css`：样式
- `app.js`：Three.js 渲染主循环与界面联动
- `models.js`：三个模型的动画与文案注册表
- `vendor/three/`：本地化的 Three.js 运行文件
- `netlify.toml`：Netlify 发布配置

## 已包含的模型

- 磁星 `alpha-omega` 效应
- 双中子星并合与引力波
- `SURON -> BH` 坍塌与 `blitzar / FRB`

## GitHub -> Netlify 发布步骤

1. 在 GitHub 新建一个仓库。
2. 把当前这个文件夹里的全部内容上传到仓库根目录。
3. 登录 Netlify。
4. 选择 `Add new project` -> `Import an existing project`。
5. 连接 GitHub，并选择这个仓库。
6. Netlify 会自动读取 `netlify.toml`，发布当前仓库根目录。
7. 部署完成后，Netlify 会生成一个公开网址。

## 自定义域名

如果你想让别人输入你自己的网址访问：

1. 在域名服务商那里购买域名。
2. 在 Netlify 项目设置中添加 custom domain。
3. 按 Netlify 提示配置 DNS 解析。

## 本地预览

如果你想先在本地预览，可以在这个文件夹里运行：

```powershell
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

## 后续扩展模型

后续如果你想继续补充经典模型，主要修改 `models.js`。

你只需要：

1. 新增一个 `buildXxxExperience(root)` 动画函数
2. 在 `MODEL_DEFINITIONS` 数组里追加模型对象
3. 配好标题、摘要、阶段、参考文献和动画逻辑

界面按钮、右侧说明和阶段时间线会自动联动，不需要额外改页面结构。

## 说明

- 这是一个静态站点，不依赖后端。
- `Three.js` 已本地化，不依赖外部 CDN，公网访问更稳定。
- 动画是面向教学展示的三维物理示意，不是严格数值模拟。
