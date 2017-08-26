# Pseudo File System Plugin

[![Downloads][npm-dm]][package-url]
[![Downloads][npm-dt]][package-url]
[![NPM Version][npm-v]][package-url]
[![Dependencies][deps]][package-url]
[![Dev Dependencies][dev-deps]][package-url]
[![License][license]][package-url]

__Plugin to add a pseudo file system to terminal-in-react__

<p align="center">
  <img src="http://g.recordit.co/4xcIZRKJCD.gif" />
</p>

# Install

```bash
npm i -S terminal-in-react-pseudo-file-system-plugin
```

```bash
yarn add terminal-in-react-pseudo-file-system-plugin
```

# Usage

The default export is a function the returns the plugin class. The function takes
on argument the `pathSeporator` this is defaulted to `'\'` so it is not required.


You can also specify the storage type for the filesystem. There are two types `basic` or `db`. `basic` is the default type and just uses client side json object and as such will not keep files from one session to another. `db` uses indexedDb and as such only works in browsers where it is supported but has the benefit of keeping files from session to session.

If you use the `db` storage type there is a third parameter that can be passed in
for if you would like to clear the db on start, by default it is `false`.


```jsx
import pseudoFileSystemPlugin from 'terminal-in-react-pseudo-file-system-plugin';
const FileSystemPlugin = pseudoFileSystemPlugin();

...
<Terminal
  plugins={[
    FileSystemPlugin
  ]}
/>
...
```

# Commands
The commands it adds are:

 - `cd`
 - `ls`
 - `rm`
 - `mkdir`
 - `touch`
 - `cat`
 - `echo`

# Plugin public methods
The methods available to other plugins

 - `parsePath`
 - `isValidPath`
 - `createDir`
 - `createFile`
 - `removeDir`
 - `removeFile`
 - `readDir`
 - `readFile`
 - `writeFile`
 - `pathToString`
 - `types`

# Details

## The Path Object
Path objects are core to most of the functions. It has a few parts.

 - `parts`: an array of the string parts of the path that would be separated by the path separator
 - `isDir`: if this path points to a directory
 - `isRoot`: if the given path string when parsed was a full path or not

The way to create these objects is via the `parsePath` method. This function will take a
string path and return a path object. This object is just a representation of a path
it does not mean that anything exist at that path.

### Validating if a path exists
To check that a given path object points to something in the filesystem you need to
use the `isValidPath` method. This function take a path object and a callback as its
parameters. If the path is valid will be returned to the callback as a parameter.

```javascript
isValidPath(pathObj, (valid) => {
  if (valid) {
    // Do thing
  }
});
```

### Path back into a string
To take a path object and turn it back into a string just pass it into the method `pathToString`.

## Reading files
To read a file's contents use the `readFile` method. This function takes a path object and
a callback function. The callback will receive the string contents of the file or `null`
if there was some issue reading the file.

```javascript
readFile(pathObj, (content) => {
  if (content !== null) {
    // Do thing
  }
});
```

## Reading directories
To read a directory's contents use the `readDir` method. This function takes a path object and a callback function. The callback will receive an array of objects refrencing the files and folders that are children of the folder or `null` if there was an issue getting the contents.

```javascript
readDir(pathObj, (content) => {
  if (content !== null) {
    // Do thing
  }
});
```

[npm-dm]: https://img.shields.io/npm/dm/terminal-in-react-pseudo-file-system-plugin.svg
[npm-dt]: https://img.shields.io/npm/dt/terminal-in-react-pseudo-file-system-plugin.svg
[npm-v]: https://img.shields.io/npm/v/terminal-in-react-pseudo-file-system-plugin.svg
[deps]: https://img.shields.io/david/jcgertig/terminal-in-react-pseudo-file-system-plugin.svg
[dev-deps]: https://img.shields.io/david/dev/jcgertig/terminal-in-react-pseudo-file-system-plugin.svg
[license]: https://img.shields.io/npm/l/terminal-in-react-pseudo-file-system-plugin.svg
[package-url]: https://npmjs.com/package/terminal-in-react-pseudo-file-system-plugin
