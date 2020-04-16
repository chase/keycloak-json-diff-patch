import { compare, applyPatch, Operation } from 'fast-json-patch';
import { mapObjectArraysById, unmapObjectArraysById } from './sortObjectArraysById';
import { readFileSync } from 'fs';

function exitUsage() {
  console.log('Invalid args. Usage: {diff, patch} file1.json {file2.json, file2.patch.json}');
  process.exit(1);
}

const NOISY_KEYS = [
  'authenticatorConfig',
  'authenticationFlows',
  'adminEventsEnabled',
  'eventsEnabled',
  'eventsExpiration',
  'enabledEventTypes',
  'users',
]

function removeNoisyKeys(object: Record<any, any>) {
  NOISY_KEYS.forEach(key => object[key] = undefined);
  if (object.clients != null) {
    // Remove security admin console client, each client auth settings and URIs
    Object.keys(object.clients).forEach(client => {
      if (object.clients[client] == null || object.clients[client] === true) return;
      if (object.clients[client].clientId === 'security-admin-console') {
        object.clients[client] = undefined;
        return;
      }

      object.clients[client].authorizationSettings = undefined;
      object.clients[client].redirectUris= undefined;
      object.clients[client].baseUrl = undefined;
      object.clients[client].adminUrl = undefined;
    });
  }
  return object;
}

function readSortedJSON(path: string) {
  return removeNoisyKeys(mapObjectArraysById(JSON.parse(readFileSync(path, 'utf8'))));
}

// Need to change array with ID into map
// Calculate patch/apply patch
// After apply patch turn ID map into array

function main(arg: string[]) {
  if (arg.length < 3) {
    exitUsage();
  }

  const [action, file1, file2] = arg;

  const sortedFile1 = readSortedJSON(file1);

  if (action === 'diff') {
    const sortedFile2 = readSortedJSON(file2);
    console.log(JSON.stringify(compare(sortedFile1, sortedFile2, true), null, 4));
  } else if (action === 'patch') {
    const patch = JSON.parse(readFileSync(file2, 'utf8'))
    try {
      const result = applyPatch(sortedFile1, patch as Operation[]);
      console.log(JSON.stringify(unmapObjectArraysById(result.newDocument), null, 4));
    } catch (err) {
      console.error(err.name, 'on operation', err.index)
      console.error(err.operation);
    }
  } else {
    exitUsage();
  }
}

main(process.argv.slice(2));