const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const babylon = require('babylon');
const traverse = require('@babel/traverse').default;
const types = require('@babel/types');
const generator = require('@babel/generator').default;
const {
  SyncHook
} = require('tapable');

/**
 * babylon          生成AST
 * @babel/traverse  解析AST
 * @babel/types     节点替换
 * @babel/generator 节点生成
 */

module.exports = class Compiler {
  constructor(config) {
    this.config = config;
    // 需要保存入口文件的路径
    this.entryId;
    // 需要保存所以模块的依赖
    this.modules = {};
    // 保存入口文件相对路径
    this.entry = config.entry;
    // 工作路径
    this.root = process.cwd();
    // rules
    this.rules = config.module && config.module.rules;
    // 钩子
    this.hooks = {
      entryOptions: new SyncHook(),
      compile: new SyncHook(),
      afterCompile: new SyncHook(),
      afterPlugins: new SyncHook(),
      run: new SyncHook(),
      emit: new SyncHook(),
      done: new SyncHook()
    }
    const plugins = config.plugins;
    if (Array.isArray(plugins)) {
      plugins.forEach(plugin => plugin.apply(this));
    }
    this.hooks.afterPlugins.call();
  }

  run() {
    this.hooks.run.call();
    this.hooks.compile.call();
    // 执行并创建模块的依赖关系   第二个参数表示是否是主模块
    this.buildModule(path.resolve(this.root, this.entry), true);
    this.hooks.afterCompile.call();
    // 发射一个文件===>打包后的文件
    this.hooks.emit.call();
    this.emitFile();
    this.hooks.done.call();
  }

  getSource(modulePath) {
    let content = fs.readFileSync(modulePath, 'utf8');
    if (this.rules) {
      this.rules.forEach(rule => {
        const {
          test,
          use
        } = rule;
        if (test.test(modulePath)) {
          let len = use.length - 1;
          handleLoader();

          function handleLoader() {
            const loader = require(use[len--]);
            content = loader(content);
            if (len >= 0) {
              handleLoader();
            }
          }
        }
      });
    }
    return content;
  }

  parse(source, parentPath) { // AST解析语法树
    const AST = babylon.parse(source);
    const dependencies = [];
    traverse(AST, {
      CallExpression(p) {
        const node = p.node;
        if (node.callee.name === 'require') {
          node.callee.name = '__webpack_require__';
          let moduleId = node.arguments[0].value;
          moduleId = moduleId + (path.extname(moduleId) ? '' : '.js');
          moduleId = './' + path.join(parentPath, moduleId);
          dependencies.push(moduleId);
          node.arguments = [types.stringLiteral(moduleId)];
        }
      }
    });
    const sourceCode = JSON.stringify(generator(AST).code);
    return {
      sourceCode,
      dependencies
    };
  }

  buildModule(modulePath, isEntry) {
    // 拿到模块的内容
    const source = this.getSource(modulePath);
    // 拿到模块id   modulePath - root
    const moduleId = './' + path.relative(this.root, modulePath);
    if (isEntry) {
      this.entryId = moduleId;
    }
    const {
      sourceCode,
      dependencies
    } = this.parse(source, path.dirname(moduleId));
    this.modules[moduleId] = sourceCode;
    dependencies.forEach(dep => {
      this.buildModule(path.join(this.root, dep), false);
    });
  }

  emitFile() {
    const main = path.join(this.config.output.path, this.config.output.filename);
    const templateStr = fs.readFileSync(path.resolve(__dirname, './main.ejs'), 'utf8');
    const code = ejs.render(templateStr, {
      entryId: this.entryId,
      modules: this.modules
    });
    this.assets = {};
    this.assets[main] = code;
    fs.writeFileSync(main, code);
  }
}
