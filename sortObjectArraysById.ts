interface TBaseKeyBase {
  id?: string;
}

function idComparator(a: TBaseKeyBase, b: TBaseKeyBase) {
  if (a.id === b.id) {
    return 0;
  }

  if (a.id == null || a.id < b.id) {
    return -1;
  }

  return 1;
}

const TRANSFORMED_KEY = '___TRANSFORMED___';

export function mapObjectArraysById(obj: object): object {
  if (!obj) {
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length == 0) return obj;
    if (typeof obj[0] !== 'object') return obj.sort();
    if (obj[0].id == null) return obj.map(mapObjectArraysById);

    const tmpObject: {[k: string]: any} = {
      [TRANSFORMED_KEY]: true,
    };
    obj.forEach(el => {
      tmpObject[el.id] = mapObjectArraysById(el);
    });
    return tmpObject;
  }

  if (typeof obj !== 'object') return obj;

  const tmpObject: {[k: string]: any} = {};
  Object.entries(obj).forEach(([key, value]) => {
    tmpObject[key] = mapObjectArraysById(value);
  });

  return tmpObject;
}

export function unmapObjectArraysById(obj: {[k: string]: any}): object {
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj;

  if (obj[TRANSFORMED_KEY] === true) {
    delete obj[TRANSFORMED_KEY];
    return Object.values(obj).sort(idComparator).map(unmapObjectArraysById);
  }

  const tmpObject: {[k: string]: any} = {};
  Object.entries(obj).forEach(([key, value]) => {
    tmpObject[key] = unmapObjectArraysById(value);
  });
  return tmpObject;
}