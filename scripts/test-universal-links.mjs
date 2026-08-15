import assert from 'node:assert/strict';
import { parseLokinUniversalLink } from '../src/lib/lokinUniversalLink.js';

const host = 'app.lokin.example';
const cases = [
  ['valid pause', `https://${host}/command?command=pause&source=siri&v=1`, true],
  ['valid ask', `https://${host}/command?command=ask&source=shortcut&v=1&q=Find%20my%20next%20stop`, true],
  ['http rejected', `http://${host}/command?command=pause&source=siri&v=1`, false, 'https_required'],
  ['wrong host', `https://evil.example/command?command=pause&source=siri&v=1`, false, 'host_mismatch'],
  ['credentials rejected', `https://user:pass@${host}/command?command=pause&source=siri&v=1`, false, 'authority_not_allowed'],
  ['port rejected', `https://${host}:8443/command?command=pause&source=siri&v=1`, false, 'authority_not_allowed'],
  ['fragment rejected', `https://${host}/command?command=pause&source=siri&v=1#x`, false, 'fragment_not_allowed'],
  ['wrong path', `https://${host}/other?command=pause&source=siri&v=1`, false, 'unsupported_path'],
  ['unknown parameter', `https://${host}/command?command=pause&source=siri&v=1&redirect=https://evil.example`, false, 'unknown_parameter'],
  ['duplicate command', `https://${host}/command?command=pause&command=tap_out&source=siri&v=1`, false, 'duplicate_parameter'],
  ['missing command', `https://${host}/command?source=siri&v=1`, false, 'command_required'],
  ['missing source', `https://${host}/command?command=pause&v=1`, false, 'source_required'],
  ['missing version', `https://${host}/command?command=pause&source=siri`, false, 'version_required'],
  ['unsupported command', `https://${host}/command?command=delete_account&source=siri&v=1`, false, 'unsupported_command'],
  ['unsupported source', `https://${host}/command?command=pause&source=unknown&v=1`, false, 'unsupported_source'],
  ['unsupported version', `https://${host}/command?command=pause&source=siri&v=2`, false, 'unsupported_version'],
  ['short nonce', `https://${host}/command?command=pause&source=siri&v=1&nonce=abc`, false, 'invalid_nonce'],
  ['query on pause', `https://${host}/command?command=pause&source=siri&v=1&q=hello`, false, 'query_not_allowed'],
  ['oversized ask', `https://${host}/command?command=ask&source=siri&v=1&q=${'a'.repeat(121)}`, false, 'invalid_query'],
  ['encoded script chars', `https://${host}/command?command=ask&source=siri&v=1&q=%3Cscript%3E`, false, 'invalid_query'],
  ['malformed URL', `not a url`, false, 'malformed_url'],
];

let passed = 0;
for (const [name, url, ok, reason] of cases) {
  const result = parseLokinUniversalLink(url, host);
  try {
    assert.equal(result.ok, ok);
    if (!ok && reason) assert.equal(result.reason, reason);
    passed++;
  } catch (e) {
    console.error(`FAIL: ${name}`, result);
    throw e;
  }
}
console.log(`Universal-link security corpus: ${passed}/${cases.length} passed`);
