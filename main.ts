import { compare, applyPatch, Operation } from 'fast-json-patch';
import { mapObjectArraysById, unmapObjectArraysById, TRANSFORMED_KEY } from './sortObjectArraysById';
import { readFileSync } from 'fs';

function exitUsage() {
  console.log('Invalid args. Usage: {diff, patch, partial} file1.json {file2.json, file2.patch.json}');
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
  return mapObjectArraysById(JSON.parse(readFileSync(path, 'utf8')));
}

function patch(file2: string, sortedFile1: Record<any, any>) {
  // Need to change array with ID into map
  // Calculate patch/apply patch
  // After apply patch turn ID map into array
  const patch = JSON.parse(readFileSync(file2, 'utf8'));
  try {
    const result = applyPatch(sortedFile1, patch as Operation[]);
    console.log(JSON.stringify(unmapObjectArraysById(result.newDocument), null, 4));
  }
  catch (err) {
    console.error(err.name, 'on operation', err.index);
    console.error(err.operation);
  }
}

interface KeycloakRoles {
  realm: Record<string, any>,
  client: Record<string, Record<string, any>>
}

interface KeycloakPartial {
  id: string,
  realm: string,
  groups: Record<string, any>,
  defaultDefaultClientScopes: string[],
  clientScopes: Record<string, any>,
  clients: Record<string, any>,
  roles: KeycloakRoles,
}

function partial(file2: string, sortedFile1: Record<any, any>) {
  // Takes a patch's operations and selectively builds a partial JSON for import
  // Can only import groups, clients, realm roles, and client roles
  // So we strip out anything that cannot be used and doesn't introduce a change
  const patch: Operation[] = JSON.parse(readFileSync(file2, 'utf8'));
  const result: KeycloakPartial = {
    id: sortedFile1.id,
    realm: sortedFile1.realm,
    groups: {},
    clients: {},
    defaultDefaultClientScopes: [],
    clientScopes: {},
    roles: {
      realm: {},
      client: {}
    }
  };
  try {
    const patched = applyPatch(sortedFile1, patch).newDocument;
    patch.forEach(operation => {
      if (operation.op === 'test') return;

      const splitPath  = operation.path.split('/').slice(1);
      if (['groups', 'clients', 'clientScopes'].includes(splitPath[0])) {
        const target = result[splitPath[0] as keyof KeycloakPartial] as Record<string, any>;
        target[splitPath[1]] = patched[splitPath[0]][splitPath[1]];
        (result[splitPath[0] as keyof KeycloakPartial] as Record<string, any>)[TRANSFORMED_KEY] = true;
      }
      if (splitPath[0] === 'defaultDefaultClientScopes') {
        result.defaultDefaultClientScopes = patched.defaultDefaultClientScopes;
      }
      if (splitPath[0] === 'roles') {
        if (splitPath[1] === 'realm') {
          result.roles.realm[splitPath[2]] = patched.roles.realm[splitPath[2]];
          result.roles.realm[TRANSFORMED_KEY] = true;
        }
        if (splitPath[1] === 'client' && patched.roles.client[splitPath[2]] != null) {
          result.roles.client[splitPath[2]][splitPath[3]] = patched.roles.client[splitPath[2]][splitPath[3]];
          result.roles.client[splitPath[2]][TRANSFORMED_KEY] = true;
        }
      }
    });
    console.log(JSON.stringify(unmapObjectArraysById(result), null, 4));
  }
  catch (err) {
    console.error(err);
    console.error(err.name, 'on operation', err.index);
    console.error(err.operation);
  }
}

function main(arg: string[]) {
  if (arg.length < 3) {
    exitUsage();
  }

  const [action, file1, file2] = arg;

  const sortedFile1 = readSortedJSON(file1);

  if (action === 'diff') {
    const sortedFile2 = readSortedJSON(file2);
    console.log(JSON.stringify(
      compare(
        removeNoisyKeys(sortedFile1),
        removeNoisyKeys(sortedFile2),
        true
      ),
      null, 4));
  } else if (action === 'patch') {
    patch(file2, sortedFile1);
  } else if (action === 'partial') {
    partial(file2, sortedFile1);
  } else {
    exitUsage();
  }
}

main(process.argv.slice(2));
