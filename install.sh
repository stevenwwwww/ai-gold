#!/bin/bash
# 安装脚本 - 使用 yarn 安装依赖
# 用法: bash install.sh

# 设置代理（如果你的代理端口是 7897，取消下面的注释）
# export http_proxy=http://127.0.0.1:7897
# export https_proxy=http://127.0.0.1:7897

# 检查 yarn 是否安装
if ! command -v yarn &> /dev/null; then
    echo "yarn 未安装，正在安装..."
    npm install -g yarn --registry=https://registry.npmmirror.com
fi

# 使用 yarn 安装依赖（已配置淘宝镜像）
yarn install

echo ""
echo "=============================="
echo "安装完成！运行以下命令启动开发："
echo ""
echo "  H5 预览:    yarn dev:h5"
echo "  微信小程序:  yarn dev:weapp"
echo "=============================="
