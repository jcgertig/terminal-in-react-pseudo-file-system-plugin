import basic from './basic';
import db from './indexDb';

export default function configPlugin(pathSeporator = '/', type = 'basic', ...args) {
  if (type === 'basic') {
    return basic(pathSeporator, ...args);
  } else if (type === 'db') {
    return db(pathSeporator, ...args);
  }
  throw new Error(`The type "${type}" is not an available storage type`);
}
