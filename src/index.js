import React from 'react'; // eslint-disable-line
import { PluginBase } from 'terminal-in-react'; // eslint-disable-line
import { autobind, decorate } from 'core-decorators';
import set from 'lodash.set';
import memoize from 'memoizerific';
import langMap from 'lang-map';
import SyntaxHighlighter from 'react-syntax-highlighter';
import * as syntaxStyles from 'react-syntax-highlighter/dist/styles';

const DIR = 'dir';
const FILE = 'file';
const CURRENT_DIR = '.';
const PARENT_DIR = '..';
const HOME_DIR = '~';
const HOME_PATH = ['home', 'user'];

function has(obj, key) {
  return typeof obj[key] !== 'undefined';
}

export default function configPlugin(pathSeporator = '/') {
  function toStringPath(path) {
    const stringParts = [...path.parts];
    if (path.isDir) {
      stringParts.push('');
    }
    if (path.isRoot) {
      stringParts.unshift('');
    }
    return stringParts.join(pathSeporator);
  }

  @autobind
  class PseudoFileSystem extends PluginBase {
    static displayName = 'PseudoFileSystem';
    static version = '2.0.0';
    static defaultData = {
      name: pathSeporator,
      type: DIR,
      contents: {
        home: {
          name: 'home',
          type: DIR,
          contents: {
            user: {
              name: 'user',
              type: DIR,
              contents: {},
            },
          },
        },
      },
    };

    constructor(api, config) {
      super(api, config);

      this.currentPath = '';

      const _ = [
        `${pathSeporator}${HOME_PATH.join(pathSeporator)}${pathSeporator}`,
      ];
      this.enterDir().method({ _ });
    }

    commands = {
      cd: this.enterDir(),
      ls: this.listDirContents(),
      rm: this.removeFromFileSystemCommand(),
      mkdir: this.createDirCommand(),
      touch: this.createFileCommand(),
      cat: this.runCat(),
      echo: this.runEcho(),
    };

    descriptions = {
      cd: false,
      ls: false,
      rm: false,
      mkdir: false,
      touch: false,
      cat: false,
      echo: false,
    };

    getPublicMethods = () => ({
      parsePath: this.parsePath,
      isValidPath: this.isValidPath,
      createDir: this.createDir,
      createFile: this.createFile,
      removeDir: this.remove,
      removeFile: this.remove,
      readDir: path => this.getContents(path, true),
      readFile: (path) => {
        const file = this.getContents(path);
        if (file !== null && typeof file === 'object') {
          return file.contents;
        }
        return file;
      },
      writeFile: this.writeToFile,
      pathToString: toStringPath,
      types: {
        dir: DIR,
        file: FILE,
      },
    })

    @decorate(memoize(500))
    doParse(split, currentPath) { // eslint-disable-line class-methods-use-this
      let isDir = false;
      let isRoot = false;
      const baseIsASymbol = [CURRENT_DIR, PARENT_DIR, HOME_DIR].indexOf(split[0]) > -1;
      if (split[split.length - 1] === '' || (split.length === 1 && baseIsASymbol)) {
        isDir = true;
      }
      if (split[0] === '') {
        isRoot = true;
      }
      let modPath = split.filter(part => part.length !== 0);
      if (!isRoot) {
        if (modPath[0] === CURRENT_DIR) {
          modPath = [...currentPath.parts, ...modPath.slice(1)];
        } else if (modPath[0] === HOME_DIR) {
          modPath = [...HOME_PATH, ...modPath.slice(1)];
        } else if (modPath[0] === PARENT_DIR) {
          modPath = [...currentPath.parts, ...modPath];
        }
      }

      if (baseIsASymbol) {
        isRoot = true;
      }

      for (let i = 0; i < modPath.length; i += 1) {
        if (modPath[i] === CURRENT_DIR) {
          modPath[i] = '';
        } else if (modPath[i] === PARENT_DIR) {
          if (i - 1 >= 0) {
            modPath[i - 1] = '';
          }
          modPath[i] = '';
        }
      }
      modPath = modPath.filter(part => part.length !== 0);

      return {
        parts: modPath,
        isRoot,
        isDir,
      };
    }

    parsePath(path) {
      const split = path.split(pathSeporator);
      if (['', CURRENT_DIR, PARENT_DIR, HOME_DIR].indexOf(split[0]) < 0) {
        split.unshift('.');
      }
      return this.doParse(split, this.currentPath);
    }

    isValidPath(path) {
      const { parts } = path;
      let last = this.api.getData();
      for (let i = 0; i < parts.length; i += 1) {
        if (has(last.contents, parts[i])) {
          last = last.contents[parts[i]];
        } else {
          this.api.printLine(`Not a valid path: ${toStringPath(path)}`);
          return false;
        }
      }
      return true;
    }

    getContents(path, str = false) {
      const { parts } = path;
      if (this.isValidPath(path)) {
        let last = this.api.getData();
        for (let i = 0; i < parts.length; i += 1) {
          if (has(last.contents, parts[i])) {
            last = last.contents[parts[i]];
          }
        }
        if (str && typeof last !== 'string') {
          return ['.', '..', ...Object.keys(last)];
        }
        return last;
      }
      return null;
    }

    addToFileSystem({ parts }, data) {
      const path = ['contents', ...parts.join('Ω…ΩcontentsΩ…Ω').split('Ω…Ω')];
      this.api.setData(set(this.api.getData(), path, data));
    }

    enterDir() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const newPath = this.parsePath(args._.join(' '));
            if (this.isValidPath(newPath)) {
              this.currentPath = newPath;
              this.api.setPromptPrefix(`${toStringPath(this.currentPath)} `);
            }
          }
        },
      };
    }

    createDirCommand() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const path = this.parsePath(args._[0]);
            this.createDir(path);
          }
        },
      };
    }

    createDir(path) {
      if (this.isValidPath(path)) {
        const parentDir = path.parts.slice(0, path.parts.length - 2);
        const newDir = path.parts[path.parts.length - 1];
        const dir = this.getContents({ parts: parentDir });
        if (dir !== null) {
          if (!has(dir.contents, newDir)) {
            this.addToFileSystem(path, {
              name: newDir,
              type: DIR,
              contents: {},
            });
          }
        }
      }
    }

    createFileCommand() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const path = this.parsePath(args._[0]);
            this.createFile(path);
          }
        },
      };
    }

    createFile(path) {
      const parentDir = path.parts.slice(0, path.parts.length - 2);
      if (this.isValidPath({ parts: parentDir })) {
        const newFile = path.parts[path.parts.length - 1];
        const dir = this.getContents({ parts: parentDir });
        if (dir !== null) {
          if (!has(dir.contents, newFile)) {
            this.addToFileSystem(path, {
              name: newFile,
              type: FILE,
              contents: '',
            });
          }
        }
      }
    }

    remove(path) {
      const contents = this.getContents(path);
      if (contents !== null && typeof contents !== 'undefined') {
        this.addToFileSystem(path, undefined);
      }
    }

    removeFromFileSystemCommand() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const path = this.parsePath(args._.join(' '));
            const contents = this.getContents(path);
            if (contents !== null) {
              if (
                contents.type === DIR &&
                Object.keys(contents.contents).length > 0 &&
                !args.recursive
              ) {
                this.api.printLine(`${toStringPath(path)} is not empty`);
              } else {
                this.addToFileSystem(path, undefined);
              }
            }
          }
        },
        options: [
          {
            name: 'recursive',
            description: 'Each item in the folder as well',
            defaultValue: false,
          },
          {
            name: 'force',
            description: 'Force the delete',
            defaultValue: false,
          },
        ],
      };
    }

    runCat() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            let split = args._;
            if (args._.indexOf('>>') > 0) {
              split = args._.join(' ').split('>>');
            }
            const pathA = this.parsePath(split[0].trim());
            const file = this.getContents(pathA);
            if (file !== null && file.type === FILE) {
              if (args._.indexOf('>>') > 0) {
                const pathB = this.parsePath(split[1].trim());
                this.writeToFile(pathB, file.contents, { flag: 'a' });
              } else {
                const splitName = file.name.split('.');
                const lang = langMap.languages(splitName[splitName.length - 1])[0];
                this.api.printLine((
                  <SyntaxHighlighter language={lang} style={syntaxStyles[lang]}>
                    {file.contents}
                  </SyntaxHighlighter>
                ));
              }
            }
          }
        },
      };
    }

    runEcho() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            if (args._.indexOf('>>') > -1) {
              const split = args._.join(' ').split(' >> ');
              const path = this.parsePath(split[1]);
              this.writeToFile(path, split[0], { flag: 'a' });
            } else {
              this.api.printLine(args._.join(' '));
            }
          }
        },
      };
    }

    writeToFile(path, contents = '', options = { flag: 'w' }) {
      if (this.isValidPath(path)) {
        const file = this.getContents(path);
        if (file !== null && file.type === FILE) {
          if (options.flag === 'w') {
            file.contents = `${contents}`;
          } else if (options.flag === 'a') {
            file.contents += `\n${contents}`;
          }
          this.addToFileSystem(path, file);
        }
      }
    }

    listDirContents() {
      return {
        method: (args) => {
          const path = this.parsePath(args._[0] || '.');
          if (path.isDir) {
            const dir = this.getContents(path);
            if (dir !== null) {
              const contents = [
                {
                  name: '.',
                  type: DIR,
                },
                {
                  name: '..',
                  type: DIR,
                },
                ...Object.values(dir.contents),
              ];
              this.api.printLine((
                <span>
                  {contents.filter(item => typeof item !== 'undefined').map((item) => {
                    const styles = {
                      color: '#bdc3c7',
                      marginRight: 5,
                      width: 'calc(33% - 5px)',
                      display: 'inline-block',
                    };
                    if (contents.length > 3) {
                      styles.marginBottom = 5;
                    }
                    if (item.type === DIR) {
                      styles.color = '#2980b9';
                    }
                    return (
                      <span
                        style={styles}
                        title={item.type.toUpperCase()}
                        key={`${item.name}-${item.type}`}
                      >
                        {item.name}
                      </span>
                    );
                  })}
                </span>
              ));
            }
          }
        },
      };
    }
  }

  return PseudoFileSystem;
}
