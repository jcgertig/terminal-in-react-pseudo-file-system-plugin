import React from 'react'; // eslint-disable-line
import { PluginBase } from 'terminal-in-react'; // eslint-disable-line
import { autobind, decorate } from 'core-decorators';
import memoize from 'memoizerific';
import langMap from 'lang-map';
import SyntaxHighlighter from 'react-syntax-highlighter';
import * as syntaxStyles from 'react-syntax-highlighter/dist/styles';
import { displayName, version, CURRENT_DIR, PARENT_DIR, HOME_DIR, DIR, FILE } from './consts';
import dbCreator from './db';

const HOME_PATH = ['', 'home', 'user'];

function last(ary) {
  return ary[ary.length - 1];
}

function parentFolderPath(path) {
  const len = path.length;
  if (len - 1 <= 0) {
    return { parts: [], isRoot: true, isDir: true };
  }
  return { parts: path.slice(0, len - 1), isRoot: true, isDir: true };
}

export default function configPlugin(pathSeporator = '/', clearDbOnStart = false) {
  const [db, Folder, File] = dbCreator(pathSeporator, clearDbOnStart);

  function pathFromArgs(args, dir = false) {
    let path = args._.join(' ').trim();
    if (dir && last(path) !== pathSeporator) {
      path += pathSeporator;
    } else if (!dir && last(path) === pathSeporator) {
      path = path.slice(0, path.length - 1);
    }
    return path;
  }

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

  function editOrCreateFolder(parent, name) {
    db.folders
      .where('fullPath').equals(parent.fullPath + name + pathSeporator)
      .count((count) => {
        if (count === 0) {
          db.folders.add(new Folder(name, parent));
        }
      });
  }

  function editOrCreateFile(parent, name, content) {
    const split = name.split('.');
    const extention = last(split);
    const filename = split.slice(0, split.length - 1).join('.');
    db.files
      .where('fullPath').equals(parent.fullPath + name)
      .first((file) => {
        if (typeof file === 'undefined') {
          db.files.add(new File(filename, extention, parent, content));
        } else {
          file.setContents(content);
        }
      });
  }

  function getFolder(path, cb) {
    const fullPath = toStringPath(path);
    db.folders.where('fullPath').equals(fullPath).first(cb);
  }

  function getFile(path, cb) {
    const fullPath = toStringPath(path);
    db.files.where('fullPath').equals(fullPath).first(cb);
  }

  function modifyFileSystem({ parts, isDir }, data) {
    if (parts.length > 0) {
      getFolder(parentFolderPath(parts), (parent) => {
        if (isDir) {
          editOrCreateFolder(parent, last(parts));
        } else {
          editOrCreateFile(parent, last(parts), data);
        }
      });
    }
  }

  function getContents(path, cb, str = false) {
    if (path.isDir) {
      getFolder(path, (folder) => {
        if (typeof folder === 'undefined') {
          cb(null);
        } else if (str) {
          db.folders.where('folderId').equals(folder.id).toArray((folders) => {
            db.files.where('folderId').equals(folder.id).toArray((files) => {
              cb([...folders, ...files]);
            });
          });
        } else {
          cb(folder);
        }
      });
    } else {
      getFile(path, (file) => {
        if (typeof file === 'undefined') {
          cb(null);
        } else if (str) {
          cb(file.content);
        } else {
          cb(file);
        }
      });
    }
  }

  function removeFromFileSystem(path) {
    getContents(path, (item) => {
      if (item !== null) {
        if (path.isDir) {
          if (!item.isBase) {
            db.folders.delete(item.id);
          }
        } else {
          db.files.delete(item.id);
        }
      }
    });
  }


  @autobind
  class PseudoFileSystem extends PluginBase {
    static displayName = displayName;
    static version = version;

    constructor(api, config) {
      super(api, config);

      this.currentPath = '';
      window.commands = this.getPublicMethods;
      window.pathFromArgs = pathFromArgs;
      window.getContents = getContents;

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
      readDir: (path, cb) => this.getContents(path, cb, DIR, true),
      readFile: (path, cb) => this.getContents(path, cb, FILE, true),
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

    isValidPath(path, cb) {
      const handleRes = (res) => {
        if (typeof res === 'undefined') {
          this.api.printLine(`Not a valid path: ${toStringPath(path)}`);
          cb(false);
        } else {
          cb(true);
        }
      };
      if (path.isDir) {
        getFolder(path, handleRes);
      } else {
        getFile(path, handleRes);
      }
    }

    getContents(path, cb, type, str = false) {
      if ((type === DIR && path.isDir) || (type === FILE && !path.isDir)) {
        this.isValidPath(path, (valid) => {
          if (valid) {
            getContents(path, cb, str);
          } else {
            cb(null);
          }
        });
      } else {
        cb(null);
      }
    }

    enterDir() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const newPath = this.parsePath(pathFromArgs(args, true));
            this.isValidPath(newPath, (valid) => {
              if (valid) {
                this.currentPath = newPath;
                this.api.setPromptPrefix(`${toStringPath(this.currentPath)} `);
              }
            });
          }
        },
      };
    }

    createDirCommand() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const path = this.parsePath(pathFromArgs(args, true));
            this.createDir(path);
          }
        },
      };
    }

    createDir(path) {
      this.isValidPath(parentFolderPath(path.parts), (valid) => {
        if (valid) {
          modifyFileSystem(path);
        }
      });
    }

    createFileCommand() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const path = this.parsePath(pathFromArgs(args));
            this.createFile(path);
          }
        },
      };
    }

    createFile(path) {
      this.isValidPath(parentFolderPath(path.parts), (valid) => {
        if (valid) {
          modifyFileSystem(path, '');
        }
      });
    }

    remove(path) {
      this.validPath(path, (valid) => {
        if (valid) {
          removeFromFileSystem(path);
        }
      });
    }

    removeFromFileSystemCommand() {
      return {
        method: (args) => {
          if (args._.length > 0) {
            const path = this.parsePath(args._.join(' ').trim());
            this.validPath(path, (valid) => {
              if (valid) {
                if (path.isDir) {
                  this.getContents(path, (contents) => {
                    if (contents.length > 0 && !args.recursive) {
                      this.api.printLine(`${toStringPath(path)} is not empty`);
                    } else if (contents.length > 0 && !args.force) {
                      this.api.printLine(`${toStringPath(path)} is not empty`);
                    } else {
                      this.remove(path);
                    }
                  }, DIR, true);
                } else {
                  this.remove(path);
                }
              }
            });
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
            const pathA = this.parsePath(pathFromArgs({ _: split[0].split(' ') }));
            this.getContents(pathA, (fileA) => {
              if (fileA !== null) {
                if (args._.indexOf('>>') > 0) {
                  const pathB = this.parsePath(pathFromArgs({ _: split[1].split(' ') }));
                  this.writeToFile(pathB, fileA.content, { flag: 'a' });
                } else {
                  const lang = langMap.languages(fileA.extention || '')[0];
                  this.api.printLine((
                    <SyntaxHighlighter language={lang} style={syntaxStyles[lang]}>
                      {fileA.content}
                    </SyntaxHighlighter>
                  ));
                }
              }
            }, FILE);
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
              const path = this.parsePath(pathFromArgs({ _: split[1].split(' ') }));
              this.writeToFile(path, split[0], { flag: 'a' });
            } else {
              this.api.printLine(args._.join(' '));
            }
          }
        },
      };
    }

    writeToFile(path, contents = '', options = { flag: 'w' }) {
      this.isValidPath(path, (valid) => {
        if (valid) {
          this.getContents(path, (file) => {
            if (file !== null) {
              let content = file;
              if (options.flag === 'w') {
                content = `${contents}`;
              } else if (options.flag === 'a') {
                content += `\n${contents}`;
              }
              modifyFileSystem(path, content);
            }
          }, FILE, true);
        }
      });
    }

    listDirContents() {
      return {
        method: (args) => {
          const path = this.parsePath(pathFromArgs({ _: (args._.length > 0 ? args._ : ['.']) }, true));
          if (path.isDir) {
            this.getContents(path, (dir) => {
              if (dir !== null) {
                const contents = [
                  {
                    path: '.',
                    type: DIR,
                  },
                  {
                    path: '..',
                    type: DIR,
                  },
                  ...dir,
                ];
                this.api.printLine((
                  <span>
                    {contents.map((item) => {
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
                          key={`${item.fullPath}-${item.type}`}
                        >
                          {item.type === DIR ? item.path : (item.getFullName())}
                        </span>
                      );
                    })}
                  </span>
                ));
              }
            }, DIR, true);
          }
        },
      };
    }
  }

  return PseudoFileSystem;
}
