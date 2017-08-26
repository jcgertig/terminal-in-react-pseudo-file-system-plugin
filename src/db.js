import Dexie from 'dexie';
import { autobind } from 'core-decorators';
import { STORAGE_KEY, DIR, FILE } from './consts';

function defineDB(pathSeporator) {
  const db = new Dexie(STORAGE_KEY);

  db.version(1).stores({
    folders: '++id,&[id+path],folderId,fullPath',
    files: '++id,&[folderId+filename],filename,extension,folderId,fullPath',
  });

  @autobind
  class Folder {
    constructor(path, parentFolder = { fullPath: '' }, base = false) {
      this.path = path;
      this.fullPath = parentFolder.fullPath + path + pathSeporator;
      this.folderId = parentFolder.id;
      this.type = DIR;
      this.isBase = base;
    }

    save() {
      return db.folders.put(this);
    }
  }

  @autobind
  class File {
    constructor(filename, extention, parentFolder, contents = '') {
      this.fullPath = `${parentFolder.fullPath + filename}.${extention}`;
      this.filename = filename;
      this.extention = extention;
      this.folderId = parentFolder.id;
      this.content = contents;
      this.type = FILE;
    }

    setContents(contents = '') {
      this.content = contents;
      this.save();
    }

    getFullName() {
      return (this.filename || '') + (this.extention ? '.' : '') + (this.extention || '');
    }

    save() {
      return db.files.put(this);
    }
  }

  db.folders.mapToClass(Folder);
  db.files.mapToClass(File);

  return [db, Folder, File];
}

export default function (pathSeporator, clear) {
  if (clear) {
    Dexie.delete(STORAGE_KEY);
  }
  const [db, Folder, File] = defineDB(pathSeporator);
  db.folders.count((count) => {
    if (count === 0) {
      db.folders.add(new Folder('', { fullPath: '' }, true));
      db.folders.toCollection().first().then((item) => {
        db.folders.add(new Folder('home', item));
        db.folders.add(new Folder('user', { fullPath: `${item.fullPath}home${pathSeporator}`, id: item.id + 1 }));
      });
    }
  });

  return [db, Folder, File];
}
