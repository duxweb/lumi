import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { UI_LICENSE_SHA256 } from './ui-license-policy.mjs'

const root = resolve(import.meta.dirname, '..')
const packageRoot = join(root, 'packages/ui')
const manifestPath = join(packageRoot, 'upstream-manifest.json')
const SHADCN_REPOSITORY = 'https://github.com/shadcn-ui/ui'
const SHADCN_REVISION = '6261bd89f72d794aea491482cc2acfd8dc3d63e2'
const REUI_REPOSITORY = 'https://github.com/keenthemes/reui'
const REUI_REVISION = '020858ed0cd76713fd7f1c38579b5239a9674f7b'
const shadcnHashes = {
  'alert': ['2cc59b5f7bda91c1670884b1bf46bfc8a2a6f226cef184f5762acc037188885b', '5c0643d09e1c826e0f4b3148b0c6d19a5defa29d986e7586a75f2c371473e570'],
  'badge': ['46a0de5224f6a5d5d63d45246534288518dce888f031064bff925bbc7fe6ad97', 'fc8a563635dd9611f17f7d232c3db5053873b999f1866eda7a616f6839550d68'],
  'breadcrumb': ['d4c0831bba2212e778248f54a6ace6ef378df8bba4616d1abf27787a31eabae5', 'b2be8328ba1fa4f81c2361224d21526dff218560ba067349b3e8d3bbbbd00d05'],
  'button': ['cc36af0f8b5019c33cc039fbf03bb952a513072b15b55b53c592b78af3e5f4c4', '216aa5ef27020257d52ca0cc87d76f6b5525dd722ff7124bc17b38a55bb426c1'],
  'calendar': ['4e3b17462e7308b7d129ab6932a765a21bc9f8289368553fc8c395147a0f6c6e', '76c3c5f774a512e6840688b771fb489d1790f8cd050ed75608c861f711b1ac26'],
  'card': ['c48dd3b96be90a7066f1aebf294f0af9d00ebcdc367d5d4aca55429ade570c1c', '732e546a87ab33d0d656041338a3c9be930243593e755dcdb9d8acbdbcae2a13'],
  'carousel': ['cb48ae08c4de180e5e2c99d3adbb1529759de62511329826c5445e9385ff1a21', '05594fa3d569cca0a8765ab14fc4dacb8bc365632cc736e7c241ba18fa014ad5'],
  'checkbox': ['b23ab9d4deeedf2ac8f512c368361ede681aa383437ef48563a6f9b7dbe95f27', '6a22b60353077c9d07a60952716aace0463655838fc66ce7c6189fc8d671336a'],
  'dialog': ['604b7782195aef7666dc2ec09a8992d60977696c07f75382f22d3d1b33691559', '3c09283311805fcc11c3e4ce27191730475522ca047ecbfe3f649f6823b026ff'],
  'drawer': ['cb6eaf58eb0757ca91af284e5d925b89a42ad7eb19cb3f44c575a3487aa9350f', 'c12047d435fb57568ce7bfa367ba1cd3368f12ce3d81e99316fc50972eb09a58'],
  'empty': ['ae95bdcf367a076ae02e7925f14522a148798f72d9651749c6d55497dba584c0', 'c6447c158970b6f258d767b1e0ee8cbae6e9b6c05d7bb2e19e6821eb67b304ac'],
  'field': ['37f60b671549593f09c6c44d7a0c4147c4e8eaffefd49786fe7cda01456e0c65', '553aadb67cdc5fd25f4a3f36c57378b47ed5d8164f343a2f8c5da5c09399848f'],
  'input': ['8c4612a7c41319ac5049daa3b34b080f9784b6245c17780eb87c127e58e473db', 'b9c7fd2e6d5e409ea1c823d21fb56f151de6cefefe3db725f1892df0bfbb841b'],
  'kbd': ['6088c3a5432338b1719c17e9b5d0e1fa74fd1f66060f248fc88909d33a82cd13', 'c8bd054ac5718c7c6055e7efa9331cff25c40ec6821e42a6e23ca1b247682386'],
  'label': ['a476e41f08b9de5bd447de66a33d8bc2ad18f2fa6b96c064778bab4b6f439f4c', 'c1c16039214a3428d40aabb6c49e8fc291abb0bf59376fa06bf49ed861b7223e'],
  'pagination': ['0caeb5bd450412573d6acb2d32b2be65c946b676791ac60e0b7aef4908229124', '3823f94793bca5f79811b161e90fe1f044b3cdfc3eb9a7ed475974eb6b523757'],
  'popover': ['31c350309ff5d3034e6ecf1b0eda75ba8855bdbf987fc7ad6d71f0ef07c5a447', '1b606fabb56234d533311ed69e7e049e9507e52223d9026376bdba4ef61c0f9e'],
  'radio-group': ['fe5ce39636d0818c2bf9c4eebddff893d1225fa2c81b5fa4bb8cbb39a8c913ce', '9983f9e1ab39dcee5e2dd7f2ea736c2ae872750ad58acf2b4a379dee77aa4efc'],
  'scroll-area': ['8bd9d986b2844c9a87de825c6de4787b6739b36c3dc9a05ccf3eb107160e4043', 'daa432b5b4805feb20b11ff033f1b429a9210abf9359440ecd28a9eac7078394'],
  'select': ['0b796a108a4eb5ba52d9ad938b7aea36dc56ae66c703a6d0a23dbc24f96daff3', 'b418cd3f7f572cd814382e4a5e07e0913667d8bb840a606e2164e19e0ef011a0'],
  'separator': ['6da346505c8629a4668420d2a5ca48891383bbe0b0ceb14163537c671879427e', '13b975ffdaec5a3919c69843572301ab77c20ef4aa115c64ae7ae03059b99bed'],
  'slider': ['0e37484f4b416e79ac18c655cac961aefacf6e67085cfc2b320ea8af545635a3', '7c61e593f5b1283054dbad3e32a340dcde8f0c83c8714ac7c3714ed0e96b86c1'],
  'spinner': ['3e6e6e8d37fb4069f8e43e55318f8db06fbc36e6c8be0096da3c9337c1c798b9', '38e9be395471184d87bad0156c3c530f78b69355c51159e8225eb6622937fc23'],
  'switch': ['386d4d4deb39f34126f9700fe9bf5393d238485dd94018bba9d154dda84c62ae', 'd026a38554686494a15c11f3ff9c0980ea2e78ab49aa1b0d28ba55add96e8b54'],
  'table': ['20e5a7f224959c6b75802995706a97e9da171f693d4b6b1b436388fcd9df96f3', 'a5201d7ac405621b39958f89ee274149450b1368c9d4eb05e01a9f464fceb4f6'],
  'tabs': ['865d0194331b9b2be36723fa79d3575dc83078b4cb941cafee87cb72fc2cff46', '0bd4cf26cca1a47c91b34bedcfdb87a5cf896ea38018b20cb12f6c78f1048aa0'],
  'textarea': ['253cdeb487c73beaaccdf47fc163e36e7d5b7ae6ddf09a4f64998a109a112979', '5717e72c7a7b3d02ecf4a94cc81b40fa5f8ccd58bca5ffd1ae2e2ca5d4c750e5'],
  'toggle-group': ['674bb386fb56b6cf67fa2b9120d26e8a1afc8e4a975ad9fe02c6b4a2053d8707', '84c4e7194529607e3dbee0c3080825f2c26c1ce85d78f94547f3848ff75aa8ff'],
}
const reuiHashes = {
  filters: ['b6acbabb5f501223feff2cba1ebe666281c02dd3436ddadcb9327cdfa790fbf0', '5d88ca9a53041ad40eafc3f16b4279f7cfad749c8ca56507dfd814149b50f27e'],
  frame: ['92d77797a44f1ef486000df26cdda3702d10682393b4381635496f18c9ffc10e', '2b2fa6ea54b64b0ff9b463603eac0c1db9d94a2e517bb91e36ace170106c482b'],
  stepper: ['60f155a93ee4b4c8c5b3534e32daf39476891500c6b0de04250efab5cf1b6aa4', 'f0f2b40569f430edae4d99b2ed263b3381e49b00c356bfe30b60b0bd254077ab'],
  timeline: ['d24df14cec3a82f6566db5facc2ba9d468f00ce0420268ad3dbf154b3adfecae', '7be9a1f30fb71a9252afb33d4796d77515815b46a1d2de4251781ba9de8691ac'],
}
function sourceRecord(repository, revision, licenseEvidence, family, item, hashes, upstreamPath) {
  return {
    repository,
    revision,
    license: 'MIT',
    licenseEvidence,
    notice: 'THIRD_PARTY_NOTICES.md',
    upstreamItem: item,
    upstreamPath,
    destination: `src/internal/${family}/${item}.tsx`,
    upstreamSha256: hashes[0],
    localSha256: hashes[1],
  }
}
const expectedSources = [
  ...Object.entries(shadcnHashes).map(([item, hashes]) => sourceRecord(SHADCN_REPOSITORY, SHADCN_REVISION, 'LICENSES/shadcn-ui-MIT.txt', 'shadcn', item, hashes, `apps/v4/registry/new-york-v4/ui/${item}.tsx`)),
  ...Object.entries(reuiHashes).map(([item, hashes]) => sourceRecord(REUI_REPOSITORY, REUI_REVISION, 'LICENSES/reui-MIT.txt', 'reui', item, hashes, `registry-reui/bases/radix/reui/${item}.tsx`)),
]
const forbiddenName = /(?:^|[._/-])(?:pro|site|sites|example|examples|storybook|stories|preview|previews|screenshot|screenshots|snapshot|snapshots|baseline|baselines|asset|assets|image|images|icon|icons)(?:[._/-]|$)/iu
const forbiddenExtensions = new Set(['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const provenanceMarker = /ReUI\s*Pro|reui-pro|@reui|Keenthemes/iu
const provenanceFiles = new Set([
  'LICENSES/reui-MIT.txt',
  'THIRD_PARTY_NOTICES.md',
  'UPSTREAM_SOURCES.md',
  'upstream-manifest.json',
])
const textExtensions = new Set(['.css', '.json', '.js', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.txt'])

for (const [path, expectedHash] of Object.entries(UI_LICENSE_SHA256)) {
  const contents = await readFile(join(packageRoot, path))
  const actualHash = createHash('sha256').update(contents).digest('hex')
  if (actualHash !== expectedHash)
    throw new Error(`License SHA-256 mismatch for ${path}: expected ${expectedHash}, received ${actualHash}`)
}

async function filesUnder(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'node_modules')
      continue
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      files.push(...await filesUnder(path))
    else if (entry.isFile())
      files.push(path)
  }
  return files
}

function localPath(path) {
  const destination = resolve(packageRoot, path)
  const pathFromRoot = relative(packageRoot, destination)
  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`))
    throw new Error(`Manifest path escapes the UI package: ${path}`)
  return destination
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.formatVersion !== 2 || !Array.isArray(manifest.sources))
  throw new Error('Unsupported UI upstream manifest format')
if (JSON.stringify(manifest.sources) !== JSON.stringify(expectedSources))
  throw new Error('UI upstream manifest does not match the fixed release inventory')

const internalDirectories = [join(packageRoot, 'src/internal/shadcn'), join(packageRoot, 'src/internal/reui')]
const actual = (await Promise.all(internalDirectories.map(filesUnder))).flat().map(path => relative(packageRoot, path).split(sep).join('/')).sort()
const declared = manifest.sources.map(source => source.destination).sort()
if (new Set(declared).size !== declared.length || JSON.stringify(actual) !== JSON.stringify(declared))
  throw new Error(`UI internal sources and upstream manifest differ\nactual: ${actual.join(', ')}\ndeclared: ${declared.join(', ')}`)

for (const source of manifest.sources) {
  const licensePath = localPath(source.licenseEvidence)
  const noticePath = localPath(source.notice)
  await Promise.all([stat(licensePath), stat(noticePath)])
  const [notice, contents] = await Promise.all([readFile(noticePath, 'utf8'), readFile(localPath(source.destination))])
  if (!Object.hasOwn(UI_LICENSE_SHA256, source.licenseEvidence))
    throw new Error(`License evidence is not part of the fixed release policy for ${source.destination}`)
  const project = source.repository === SHADCN_REPOSITORY ? 'shadcn/ui' : 'ReUI'
  if (!notice.includes(project) || !notice.includes(source.licenseEvidence))
    throw new Error(`Third-party notice does not reference ${project} and ${source.licenseEvidence}`)
  const digest = createHash('sha256').update(contents).digest('hex')
  if (digest !== source.localSha256)
    throw new Error(`Local SHA-256 mismatch for ${source.destination}: expected ${source.localSha256}, received ${digest}`)
  if (forbiddenName.test(source.destination) || forbiddenExtensions.has(extname(source.destination).toLowerCase()))
    throw new Error(`Forbidden internal source or asset: ${source.destination}`)
}

for (const path of await filesUnder(packageRoot)) {
  const relativePath = relative(packageRoot, path).split(sep).join('/')
  if (!textExtensions.has(extname(path).toLowerCase()) || provenanceFiles.has(relativePath))
    continue
  if (provenanceMarker.test(await readFile(path, 'utf8')))
    throw new Error(`Third-party/Pro provenance marker escaped the approved ledger: ${relativePath}`)
}

const publicEntry = await readFile(join(packageRoot, 'src/index.ts'), 'utf8')
if (publicEntry.split('\n').some(line => line.trimStart().startsWith('export') && (line.includes('/internal/shadcn') || line.includes('/internal/reui'))))
  throw new Error('The public UI entry exports a raw internal shadcn or ReUI module')

process.stdout.write(`UI upstream verification passed for ${manifest.sources.length} fixed owned sources.\n`)
