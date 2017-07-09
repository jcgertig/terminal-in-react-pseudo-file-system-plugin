import React from 'react'; // eslint-disable-line
import { autobind, decorate } from 'core-decorators';
import set from 'lodash.set';
import memoize from 'memoizerific';

const DIR = 'dir';
const FILE = 'file';
const CURRENT_DIR = '.';
const PARENT_DIR = '..';
const HOME_DIR = '~';
const HOME_PATH = ['home', 'user'];

function has(obj, key) {
  return typeof obj[key] !== 'undefined';
}

@autobind
export default class PseudoFileSystem {
  name = 'PseudoFileSystem';
  version = '1.0.19';

  constructor(pathSeporator = '/') {
    this.pathSeporator = pathSeporator;
  }

  load(api) {
    this.api = api;
    this.currentPath = '';
    this.filesystem = {
      name: this.pathSeporator,
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

    window.filesystem = this.filesystem;

    const _ = [
      `${this.pathSeporator}${HOME_PATH.join(this.pathSeporator)}${this.pathSeporator}`,
    ];
    this.enterDir().method({ _ });
  }

  commands = {
    cd: this.enterDir(),
    ls: this.listDirContents(),
    rm: this.removeFromFileSystem(),
    mkdir: this.createDir(),
    touch: this.createFile(),
  };

  descriptions = {
    cd: 'Enter a directory',
    ls: 'List the contents of a directory',
    rm: 'Remove a file(s)',
    mkdir: 'Create a directory',
    touch: 'Create a file',
  };

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
    const split = path.split(this.pathSeporator);
    if (['', CURRENT_DIR, PARENT_DIR, HOME_DIR].indexOf(split[0]) < 0) {
      split.unshift('.');
    }
    return this.doParse(split, this.currentPath);
  }

  toStringPath(path) {
    const stringParts = [...path.parts];
    if (path.isDir) {
      stringParts.push('');
    }
    if (path.isRoot) {
      stringParts.unshift('');
    }
    return stringParts.join(this.pathSeporator);
  }

  isValidPath(path) {
    const { parts } = path;
    let last = this.filesystem;
    for (let i = 0; i < parts.length; i += 1) {
      if (has(last.contents, parts[i])) {
        last = last.contents[parts[i]];
      } else {
        this.api.printLine(`Not a valid path: ${this.toStringPath(path)}`);
      }
    }
    return true;
  }

  getContents(path) {
    const { parts } = path;
    if (this.isValidPath(path)) {
      let last = this.filesystem;
      for (let i = 0; i < parts.length; i += 1) {
        if (has(last.contents, parts[i])) {
          last = last.contents[parts[i]];
        }
      }
      return last;
    }
    return null;
  }

  addToFileSystem({ parts }, data) {
    const path = ['contents', ...parts.join('Ω…ΩcontentsΩ…Ω').split('Ω…Ω')];
    set(this.filesystem, path, data);
  }

  enterDir() {
    return {
      method: (args) => {
        if (args._.length > 0) {
          const newPath = this.parsePath(args._.join(' '));
          if (this.isValidPath(newPath)) {
            this.currentPath = newPath;
            this.api.setPromptPrefix(`${this.toStringPath(this.currentPath)} `);
          }
        }
      },
    };
  }

  createDir() {
    return {
      method: (args) => {
        if (args._.length > 0) {
          const path = this.parsePath(args._[0]);
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
      },
    };
  }

  createFile() {
    return {
      method: (args) => {
        if (args._.length > 0) {
          const path = this.parsePath(args._[0]);
          const parentDir = path.parts.slice(0, path.parts.length - 2);
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
      },
    };
  }

  removeFromFileSystem() {
    return {
      method: (args) => {
        if (args._.length > 0) {
          const path = this.parsePath(args._[0]);
          const contents = this.getContents(path);
          if (contents !== null) {
            if (
              contents.type === DIR &&
              Object.keys(contents.contents).length > 0 &&
              !args.recursive
            ) {
              this.api.printLine(`${this.toStringPath(path)} is not empty`);
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

  listDirContents() {
    return {
      method: (args) => {
        const path = this.parsePath(args._[0] || '.');
        if (path.isDir) {
          const dir = this.getContents(path);
          if (dir !== null) {
            const contents = Object.values(dir.contents);
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
