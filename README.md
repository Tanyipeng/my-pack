### package.json配置bin
```json
// 作用是通过my-pack命令就可以执行my-pack.js这个文件
"bin": {
  "my-pack": "./bin/my-pack.js"
}
```

### 通过npm link将这个命令映射到全局
```bash
npm link

// mac下需要sudo
sudo npm link
```

### 在项目中使用my-pack
```bash
// 将全局的my-pack映射到项目的node_modules文件夹下
npm link my-pack

// 使用npx my-pack就可以对项目进行打包
npx my-pack
```
